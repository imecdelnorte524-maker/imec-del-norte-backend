import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from '../mail/mail.service';
import { Genero } from './enums/genero.enum';
import { WebsocketGateway } from '../websockets/websocket.gateway';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    public usersRepository: Repository<User>,
    @InjectRepository(Role)
    public rolesRepository: Repository<Role>,
    private readonly mailService: MailService,
    private readonly websocketGateway: WebsocketGateway,
  ) {
    this.initializeSequence().catch((error) => {
      this.logger.warn(`No se pudo inicializar la secuencia: ${error.message}`);
    });
  }

  private async initializeSequence(): Promise<void> {
    try {
      const result = await this.usersRepository.query(`
        SELECT setval('usuarios_usuario_id_seq', 
          COALESCE((SELECT MAX(usuario_id) FROM usuarios), 1), 
          true
        ) as last_value;
      `);

      this.logger.log(
        `✅ Secuencia de usuarios inicializada correctamente. Último valor: ${
          result[0]?.last_value || 'N/A'
        }`,
      );
    } catch (error) {
      this.logger.warn(
        `⚠️ No se pudo inicializar la secuencia de usuarios: ${error.message}`,
      );
    }
  }

  async fixSequenceIfNeeded(): Promise<{
    corrected: boolean;
    message: string;
  }> {
    try {
      const maxIdResult = await this.usersRepository.query(`
        SELECT MAX(usuario_id) as max_id FROM usuarios
      `);
      const maxId = maxIdResult[0]?.max_id || 0;

      const sequenceResult = await this.usersRepository.query(`
        SELECT last_value FROM usuarios_usuario_id_seq
      `);
      const lastSequenceValue = sequenceResult[0]?.last_value || 0;

      this.logger.debug(
        `🔍 Verificando secuencia: Max ID=${maxId}, Secuencia=${lastSequenceValue}`,
      );

      if (lastSequenceValue <= maxId) {
        await this.usersRepository.query(
          `
          SELECT setval('usuarios_usuario_id_seq', $1, true)
        `,
          [maxId],
        );

        const message = `✅ Secuencia corregida: ${lastSequenceValue} → ${maxId}`;
        this.logger.log(message);
        return { corrected: true, message };
      }

      return { corrected: false, message: 'Secuencia ya está actualizada' };
    } catch (error) {
      const errorMessage = `❌ Error corrigiendo secuencia: ${error.message}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    await this.fixSequenceIfNeeded();

    const plainPassword = createUserDto.password;
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.createWithPasswordHash({
      ...createUserDto,
      passwordHash,
    });

    try {
      await this.mailService.sendCredentialsEmail({
        to: user.email,
        username: user.username,
        plainPassword,
      });
      this.logger.log(
        `Correo de credenciales enviado a nuevo usuario: ${user.usuarioId} - ${user.email}`,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo enviar correo de credenciales a ${user.email}: ${error.message}`,
      );
    }

    return user;
  }

  async createWithPasswordHash(
    userData: CreateUserDto & { passwordHash: string },
  ): Promise<User> {
    await this.fixSequenceIfNeeded();

    const role = await this.rolesRepository.findOne({
      where: { rolId: userData.rolId },
    });

    if (!role) {
      throw new BadRequestException('El rol especificado no existe');
    }

    const existingUserByEmail = await this.findByEmail(userData.email);
    if (existingUserByEmail) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const existingUserByUsername = await this.findByUsername(userData.username);
    if (existingUserByUsername) {
      throw new ConflictException('El nombre de usuario ya está registrado');
    }

    // Convertir fecha de nacimiento de string a Date si existe
    let fechaNacimientoDate: Date | undefined;
    if (userData.fechaNacimiento) {
      try {
        fechaNacimientoDate = new Date(userData.fechaNacimiento);
        // Validar que sea una fecha válida
        if (isNaN(fechaNacimientoDate.getTime())) {
          throw new BadRequestException('Fecha de nacimiento inválida');
        }
      } catch (error) {
        throw new BadRequestException('Fecha de nacimiento inválida');
      }
    }

    // Validar que el género sea válido si se proporciona
    if (
      userData.genero &&
      !Object.values(Genero).includes(userData.genero as Genero)
    ) {
      throw new BadRequestException('Género inválido');
    }

    const user = this.usersRepository.create({
      nombre: userData.nombre,
      apellido: userData.apellido,
      tipoCedula: userData.tipoCedula,
      cedula: userData.cedula,
      email: userData.email,
      username: userData.username,
      passwordHash: userData.passwordHash,
      telefono: userData.telefono,
      rolId: userData.rolId,
      activo: userData.activo ?? true,
      fechaNacimiento: fechaNacimientoDate,
      genero: userData.genero as Genero,
      position: userData.position,
      resetToken: userData.resetToken,
      resetTokenExpiry: userData.resetTokenExpiry
        ? new Date(userData.resetTokenExpiry)
        : undefined,
      mustChangePassword: true,

      // campos adicionales opcionales
      ubicacionResidencia: (userData as any).ubicacionResidencia ?? null,
      arl: (userData as any).arl ?? null,
      eps: (userData as any).eps ?? null,
      afp: (userData as any).afp ?? null,
      contactoEmergenciaNombre:
        (userData as any).contactoEmergenciaNombre ?? null,
      contactoEmergenciaTelefono:
        (userData as any).contactoEmergenciaTelefono ?? null,
      contactoEmergenciaParentesco:
        (userData as any).contactoEmergenciaParentesco ?? null,
    });

    let savedUser: User;

    try {
      savedUser = await this.usersRepository.save(user);
      this.logger.log(
        `👤 Usuario creado exitosamente: ${savedUser.usuarioId} - ${savedUser.email}`,
      );
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'usuarios_pkey') {
        this.logger.warn(
          '⚠️ Error de duplicado en PK, corrigiendo secuencia...',
        );
        await this.fixSequenceIfNeeded();

        savedUser = await this.usersRepository.save(user);
      } else {
        throw error;
      }
    }

    const userWithRole = await this.usersRepository.findOne({
      where: { usuarioId: savedUser.usuarioId },
      relations: ['role'],
    });

    if (!userWithRole) {
      throw new NotFoundException('Usuario no encontrado después de guardar');
    }

    // 🔴 WebSocket: usuario creado
    this.websocketGateway.emit('users.created', userWithRole);

    return userWithRole;
  }

  async findAll(): Promise<User[]> {
    return await this.usersRepository.find({
      relations: ['role'],
      order: { fechaCreacion: 'DESC' },
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { usuarioId: id },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { email },
      relations: ['role'],
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { username },
      relations: ['role'],
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUserByEmail = await this.findByEmail(updateUserDto.email);
      if (existingUserByEmail) {
        throw new ConflictException('El correo electrónico ya está registrado');
      }
    }

    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUserByUsername = await this.findByUsername(
        updateUserDto.username,
      );
      if (existingUserByUsername) {
        throw new ConflictException('El nombre de usuario ya está registrado');
      }
    }

    if (updateUserDto.rolId !== undefined) {
      const role = await this.rolesRepository.findOne({
        where: { rolId: updateUserDto.rolId },
      });

      if (!role) {
        throw new BadRequestException('El rol especificado no existe');
      }
    }

    // Procesar fecha de nacimiento si se proporciona
    let fechaNacimientoDate: Date | undefined;
    if (updateUserDto.fechaNacimiento !== undefined) {
      if (updateUserDto.fechaNacimiento) {
        try {
          fechaNacimientoDate = new Date(updateUserDto.fechaNacimiento);
          if (isNaN(fechaNacimientoDate.getTime())) {
            throw new BadRequestException('Fecha de nacimiento inválida');
          }
        } catch (error) {
          throw new BadRequestException('Fecha de nacimiento inválida');
        }
      } else {
        fechaNacimientoDate = undefined; // Para eliminar la fecha
      }
    }

    // Validar género si se proporciona
    if (updateUserDto.genero !== undefined && updateUserDto.genero) {
      if (!Object.values(Genero).includes(updateUserDto.genero as Genero)) {
        throw new BadRequestException('Género inválido');
      }
    }

    // Preparar datos para actualizar
    const updateData: any = { ...updateUserDto };

    // Convertir fecha de nacimiento
    if (updateUserDto.fechaNacimiento !== undefined) {
      updateData.fechaNacimiento = fechaNacimientoDate;
    }

    // Convertir fecha de expiración del token si existe
    if (updateUserDto.resetTokenExpiry) {
      updateData.resetTokenExpiry = new Date(updateUserDto.resetTokenExpiry);
    }

    if (updateUserDto.password) {
      const passwordHash = await bcrypt.hash(updateUserDto.password, 10);
      updateData.passwordHash = passwordHash;
      delete updateData.password;
    }

    // Procesar campos de perfil: si están explícitamente presentes,
    // permitir guardar null (para limpiar) o el valor entregado.
    const profileFields = [
      'ubicacionResidencia',
      'arl',
      'eps',
      'afp',
      'contactoEmergenciaNombre',
      'contactoEmergenciaTelefono',
      'contactoEmergenciaParentesco',
    ];

    for (const field of profileFields) {
      if ((updateUserDto as any)[field] !== undefined) {
        // Si viene vacío ('') o null, guardamos null para limpiar el campo
        updateData[field] = (updateUserDto as any)[field] ?? null;
      }
    }

    await this.usersRepository.update(id, updateData);

    const updatedUser = await this.usersRepository.findOne({
      where: { usuarioId: id },
      relations: ['role'],
    });

    if (!updatedUser) {
      throw new NotFoundException(
        `Usuario con ID ${id} no encontrado después de actualizar`,
      );
    }

    // 🔴 WebSocket: usuario actualizado
    this.websocketGateway.emit('users.updated', updatedUser);

    return updatedUser;
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
    // 🔴 WebSocket
    this.websocketGateway.emit('users.deleted', { id });
  }

  async deactivate(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.activo = false;
    await this.usersRepository.save(user);

    const deactivatedUser = await this.usersRepository.findOne({
      where: { usuarioId: id },
      relations: ['role'],
    });

    if (!deactivatedUser) {
      throw new NotFoundException(
        `Usuario con ID ${id} no encontrado después de desactivar`,
      );
    }

    // 🔴 WebSocket
    this.websocketGateway.emit('users.updated', deactivatedUser);

    return deactivatedUser;
  }

  async activate(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.activo = true;
    await this.usersRepository.save(user);

    const activatedUser = await this.usersRepository.findOne({
      where: { usuarioId: id },
      relations: ['role'],
    });

    if (!activatedUser) {
      throw new NotFoundException(
        `Usuario con ID ${id} no encontrado después de activar`,
      );
    }

    // 🔴 WebSocket
    this.websocketGateway.emit('users.updated', activatedUser);

    return activatedUser;
  }

  async getUsersByRole(roleName: string): Promise<User[]> {
    return await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('role.nombre_rol = :roleName', { roleName })
      .andWhere('user.activo = :activo', { activo: true })
      .getMany();
  }

  async getTechnicians(): Promise<User[]> {
    return await this.getUsersByRole('Técnico');
  }

  async getClients(): Promise<User[]> {
    return await this.getUsersByRole('Cliente');
  }

  async updatePassword(userId: number, newPassword: string): Promise<void> {
    const user = await this.findOne(userId);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.mustChangePassword = false;
    await this.usersRepository.save(user);
    this.logger.log(`🔐 Contraseña actualizada para usuario: ${userId}`);
  }

  async setResetToken(
    userId: number,
    resetToken: string,
    resetTokenExpiry: Date,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      resetToken,
      resetTokenExpiry,
    });
    this.logger.log(`🔑 Token de reset establecido para usuario: ${userId}`);
  }

  async clearResetToken(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });
    this.logger.log(`🔑 Token de reset limpiado para usuario: ${userId}`);
  }

  async findByResetToken(resetToken: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { resetToken },
      relations: ['role'],
    });
  }

  async findAllRoles(): Promise<Role[]> {
    return await this.rolesRepository.find({
      order: { rolId: 'ASC' },
    });
  }

  async findActiveRoles(): Promise<Role[]> {
    return await this.rolesRepository.find({
      order: { rolId: 'ASC' },
    });
  }

  async findRoleById(rolId: number): Promise<Role | null> {
    return await this.rolesRepository.findOne({
      where: { rolId },
    });
  }

  async diagnoseSequence(): Promise<any> {
    try {
      const [maxIdResult, sequenceResult] = await Promise.all([
        this.usersRepository.query(
          'SELECT MAX(usuario_id) as max_id FROM usuarios',
        ),
        this.usersRepository.query(
          'SELECT last_value FROM usuarios_usuario_id_seq',
        ),
      ]);

      const maxId = maxIdResult[0]?.max_id || 0;
      const lastSequenceValue = sequenceResult[0]?.last_value || 0;

      return {
        maxId,
        lastSequenceValue,
        synchronized: lastSequenceValue >= maxId,
        needsCorrection: lastSequenceValue < maxId,
        difference: maxId - lastSequenceValue,
      };
    } catch (error) {
      throw new Error(`Error en diagnóstico: ${error.message}`);
    }
  }
}
