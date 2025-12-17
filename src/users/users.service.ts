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
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    public usersRepository: Repository<User>,
    @InjectRepository(Role)
    public rolesRepository: Repository<Role>,
    private readonly mailService: MailService,
  ) {
    // Verificar y corregir la secuencia al inicializar el servicio
    this.initializeSequence().catch((error) => {
      this.logger.warn(
        `No se pudo inicializar la secuencia: ${error.message}`,
      );
    });
  }

  /**
   * Inicializa y corrige la secuencia de usuario_id si es necesario
   */
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

  /**
   * Corrige la secuencia si está desincronizada
   */
  async fixSequenceIfNeeded(): Promise<{
    corrected: boolean;
    message: string;
  }> {
    try {
      // Obtener el máximo ID actual en la tabla
      const maxIdResult = await this.usersRepository.query(`
        SELECT MAX(usuario_id) as max_id FROM usuarios
      `);
      const maxId = maxIdResult[0]?.max_id || 0;

      // Obtener el último valor de la secuencia
      const sequenceResult = await this.usersRepository.query(`
        SELECT last_value FROM usuarios_usuario_id_seq
      `);
      const lastSequenceValue = sequenceResult[0]?.last_value || 0;

      this.logger.debug(
        `🔍 Verificando secuencia: Max ID=${maxId}, Secuencia=${lastSequenceValue}`,
      );

      // Si la secuencia está detrás del máximo ID, corregirla
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

  /**
   * Crea un nuevo usuario con contraseña hasheada
   * y envía correo con usuario + contraseña (en texto plano)
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Verificar secuencia antes de crear
    await this.fixSequenceIfNeeded();

    // Guardamos la contraseña en texto plano para usarla en el correo
    const plainPassword = createUserDto.password;

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.createWithPasswordHash({
      ...createUserDto,
      passwordHash,
    });

    // Enviar correo con usuario y contraseña (ustedes ya conocen la contraseña)
    try {
      await this.mailService.sendCredentialsEmail({
        to: user.email,
        username: user.username,
        plainPassword, // la contraseña que ustedes ya saben
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

  /**
   * Crea usuario con hash de contraseña proporcionado
   */
  async createWithPasswordHash(
    userData: CreateUserDto & { passwordHash: string },
  ): Promise<User> {
    // Verificar secuencia antes de insertar
    await this.fixSequenceIfNeeded();

    // Verificar si el rol existe
    const role = await this.rolesRepository.findOne({
      where: { rolId: userData.rolId },
    });

    if (!role) {
      throw new BadRequestException('El rol especificado no existe');
    }

    // Verificar si el email ya existe
    const existingUserByEmail = await this.findByEmail(userData.email);
    if (existingUserByEmail) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    // Verificar si el username ya existe
    const existingUserByUsername = await this.findByUsername(
      userData.username,
    );
    if (existingUserByUsername) {
      throw new ConflictException('El nombre de usuario ya está registrado');
    }

    // Crear y guardar el usuario
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
      resetToken: userData.resetToken,
      resetTokenExpiry: userData.resetTokenExpiry,
    });

    let savedUser: User;

    try {
      savedUser = await this.usersRepository.save(user);
      this.logger.log(
        `👤 Usuario creado exitosamente: ${savedUser.usuarioId} - ${savedUser.email}`,
      );
    } catch (error) {
      // Si hay error de duplicado, verificar y corregir secuencia
      if (error.code === '23505' && error.constraint === 'usuarios_pkey') {
        this.logger.warn(
          '⚠️ Error de duplicado en PK, corrigiendo secuencia...',
        );
        await this.fixSequenceIfNeeded();

        // Reintentar la inserción
        savedUser = await this.usersRepository.save(user);
      } else {
        throw error;
      }
    }

    // Recargar el usuario con la relación del rol
    const userWithRole = await this.usersRepository.findOne({
      where: { usuarioId: savedUser.usuarioId },
      relations: ['role'],
    });

    if (!userWithRole) {
      throw new NotFoundException('Usuario no encontrado después de guardar');
    }

    return userWithRole;
  }

  /**
   * Obtiene todos los usuarios
   */
  async findAll(): Promise<User[]> {
    return await this.usersRepository.find({
      relations: ['role'],
      order: { fechaCreacion: 'DESC' },
    });
  }

  /**
   * Obtiene un usuario por ID
   */
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

  /**
   * Busca usuario por email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { email },
      relations: ['role'],
    });
  }

  /**
   * Busca usuario por username
   */
  async findByUsername(username: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { username },
      relations: ['role'],
    });
  }

  /**
   * Actualiza un usuario existente
   */
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Verificar si se está actualizando el email y si ya existe
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUserByEmail = await this.findByEmail(updateUserDto.email);
      if (existingUserByEmail) {
        throw new ConflictException('El correo electrónico ya está registrado');
      }
    }

    // Verificar si se está actualizando el username y si ya existe
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUserByUsername = await this.findByUsername(
        updateUserDto.username,
      );
      if (existingUserByUsername) {
        throw new ConflictException(
          'El nombre de usuario ya está registrado',
        );
      }
    }

    // Verificar si se está actualizando el rol
    if (updateUserDto.rolId) {
      const role = await this.rolesRepository.findOne({
        where: { rolId: updateUserDto.rolId },
      });

      if (!role) {
        throw new BadRequestException('El rol especificado no existe');
      }
    }

    // Hash de la contraseña si se está actualizando
    if (updateUserDto.password) {
      const passwordHash = await bcrypt.hash(updateUserDto.password, 10);
      await this.usersRepository.update(id, { ...updateUserDto, passwordHash });
    } else {
      await this.usersRepository.update(id, updateUserDto);
    }

    // Recargar con relaciones después de actualizar
    const updatedUser = await this.usersRepository.findOne({
      where: { usuarioId: id },
      relations: ['role'],
    });

    if (!updatedUser) {
      throw new NotFoundException(
        `Usuario con ID ${id} no encontrado después de actualizar`,
      );
    }

    return updatedUser;
  }

  /**
   * Elimina un usuario permanentemente
   */
  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
    this.logger.log(`👤 Usuario eliminado: ${id}`);
  }

  /**
   * Desactiva un usuario
   */
  async deactivate(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.activo = false;
    await this.usersRepository.save(user);

    // Recargar con relaciones después de desactivar
    const deactivatedUser = await this.usersRepository.findOne({
      where: { usuarioId: id },
      relations: ['role'],
    });

    if (!deactivatedUser) {
      throw new NotFoundException(
        `Usuario con ID ${id} no encontrado después de desactivar`,
      );
    }

    this.logger.log(`👤 Usuario desactivado: ${id}`);
    return deactivatedUser;
  }

  /**
   * Activa un usuario
   */
  async activate(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.activo = true;
    await this.usersRepository.save(user);

    // Recargar con relaciones después de activar
    const activatedUser = await this.usersRepository.findOne({
      where: { usuarioId: id },
      relations: ['role'],
    });

    if (!activatedUser) {
      throw new NotFoundException(
        `Usuario con ID ${id} no encontrado después de activar`,
      );
    }

    this.logger.log(`👤 Usuario activado: ${id}`);
    return activatedUser;
  }

  /**
   * Obtiene usuarios por rol
   */
  async getUsersByRole(roleName: string): Promise<User[]> {
    return await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('role.nombre_rol = :roleName', { roleName })
      .andWhere('user.activo = :activo', { activo: true })
      .getMany();
  }

  /**
   * Obtiene todos los técnicos
   */
  async getTechnicians(): Promise<User[]> {
    return await this.getUsersByRole('Técnico');
  }

  /**
   * Obtiene todos los clientes
   */
  async getClients(): Promise<User[]> {
    return await this.getUsersByRole('Cliente');
  }

  /**
   * Actualiza la contraseña de un usuario
   */
  async updatePassword(userId: number, newPassword: string): Promise<void> {
    const user = await this.findOne(userId);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await this.usersRepository.save(user);
    this.logger.log(`🔐 Contraseña actualizada para usuario: ${userId}`);
  }

  /**
   * Establece token de reset de contraseña
   */
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

  /**
   * Limpia token de reset de contraseña
   */
  async clearResetToken(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      resetToken: undefined as any,
      resetTokenExpiry: undefined as any,
    });
    this.logger.log(`🔑 Token de reset limpiado para usuario: ${userId}`);
  }

  /**
   * Busca usuario por token de reset
   */
  async findByResetToken(resetToken: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { resetToken },
      relations: ['role'],
    });
  }

  /**
   * Obtiene todos los roles
   */
  async findAllRoles(): Promise<Role[]> {
    return await this.rolesRepository.find({
      order: { rolId: 'ASC' },
    });
  }

  /**
   * Obtiene roles activos
   */
  async findActiveRoles(): Promise<Role[]> {
    return await this.rolesRepository.find({
      order: { rolId: 'ASC' },
    });
  }

  /**
   * Busca rol por ID
   */
  async findRoleById(rolId: number): Promise<Role | null> {
    return await this.rolesRepository.findOne({
      where: { rolId },
    });
  }

  /**
   * Método de diagnóstico - Verifica estado de la secuencia
   */
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