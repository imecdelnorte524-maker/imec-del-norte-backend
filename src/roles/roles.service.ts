import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,

    @InjectRepository(ModuleEntity)
    private modulesRepository: Repository<ModuleEntity>,
    private readonly realtime: RealtimeService,
  ) {
    this.initializeSequence().catch((error) => {
      this.logger.warn(
        `No se pudo inicializar la secuencia de roles: ${error.message}`,
      );
    });
  }

  private async initializeSequence(): Promise<void> {
    try {
      const result = await this.rolesRepository.query(`
        SELECT setval('roles_rol_id_seq', 
          COALESCE((SELECT MAX(rol_id) FROM roles), 1), 
          true
        ) as last_value;
      `);

      this.logger.log(
        `✅ Secuencia de roles inicializada correctamente. Último valor: ${result[0]?.last_value || 'N/A'}`,
      );
    } catch (error) {
      this.logger.warn(
        `⚠️ No se pudo inicializar la secuencia de roles: ${error.message}`,
      );
    }
  }

  async fixSequenceIfNeeded(): Promise<{
    corrected: boolean;
    message: string;
  }> {
    try {
      const maxIdResult = await this.rolesRepository.query(`
        SELECT MAX(rol_id) as max_id FROM roles
      `);
      const maxId = maxIdResult[0]?.max_id || 0;

      const sequenceResult = await this.rolesRepository.query(`
        SELECT last_value FROM roles_rol_id_seq
      `);
      const lastSequenceValue = sequenceResult[0]?.last_value || 0;

      this.logger.debug(
        `🔍 Verificando secuencia de roles: Max ID=${maxId}, Secuencia=${lastSequenceValue}`,
      );

      if (lastSequenceValue <= maxId) {
        await this.rolesRepository.query(
          `
          SELECT setval('roles_rol_id_seq', $1, true)
        `,
          [maxId],
        );

        const message = `✅ Secuencia de roles corregida: ${lastSequenceValue} → ${maxId}`;
        this.logger.log(message);
        return { corrected: true, message };
      }

      return {
        corrected: false,
        message: 'Secuencia de roles ya está actualizada',
      };
    } catch (error) {
      const errorMessage = `❌ Error corrigiendo secuencia de roles: ${error.message}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    await this.fixSequenceIfNeeded();

    const existingRole = await this.rolesRepository.findOne({
      where: { nombreRol: createRoleDto.nombreRol },
    });

    if (existingRole) {
      throw new ConflictException('El nombre del rol ya existe');
    }

    const role = this.rolesRepository.create(createRoleDto);

    let savedRole: Role;

    try {
      savedRole = await this.rolesRepository.save(role);
      // WebSocket
      this.realtime.emitEntityUpdate('roles', 'created', savedRole);

      return savedRole;
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'roles_pkey') {
        this.logger.warn(
          '⚠️ Error de duplicado en PK de roles, corrigiendo secuencia...',
        );
        await this.fixSequenceIfNeeded();

        savedRole = await this.rolesRepository.save(role);
      } else {
        throw error;
      }
    }

    return savedRole;
  }

  async findAll(): Promise<Role[]> {
    return await this.rolesRepository.find({
      order: { rolId: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { rolId: id },
    });

    if (!role) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    return role;
  }

  async findByName(nombreRol: string): Promise<Role | null> {
    return await this.rolesRepository.findOne({
      where: { nombreRol },
    });
  }

  async update(id: number, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);

    if (updateRoleDto.nombreRol && updateRoleDto.nombreRol !== role.nombreRol) {
      const existingRole = await this.findByName(updateRoleDto.nombreRol);
      if (existingRole) {
        throw new ConflictException('El nombre del rol ya existe');
      }
    }

    await this.rolesRepository.update(id, updateRoleDto);
    const updatedRole = await this.findOne(id);

    // WebSocket
    this.realtime.emitEntityUpdate('roles', 'updated', updatedRole);

    return updatedRole;
  }

  async remove(id: number): Promise<void> {
    const role = await this.rolesRepository.findOne({
      where: { rolId: id },
      relations: ['users'],
    });

    if (!role) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    if (role.users && role.users.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar un rol que tiene usuarios asignados',
      );
    }

    await this.rolesRepository.remove(role);

    // WebSocket
    this.realtime.emitEntityUpdate('roles', 'deleted', { id });
  }

  async searchRoles(nombre?: string): Promise<Role[]> {
    const queryBuilder = this.rolesRepository.createQueryBuilder('role');

    if (nombre) {
      queryBuilder.where('role.nombreRol ILIKE :nombre', {
        nombre: `%${nombre}%`,
      });
    }

    return await queryBuilder.orderBy('role.rolId', 'ASC').getMany();
  }

  async diagnoseSequence(): Promise<any> {
    try {
      const [maxIdResult, sequenceResult] = await Promise.all([
        this.rolesRepository.query('SELECT MAX(rol_id) as max_id FROM roles'),
        this.rolesRepository.query('SELECT last_value FROM roles_rol_id_seq'),
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
      throw new Error(
        `Error en diagnóstico de secuencia de roles: ${error.message}`,
      );
    }
  }

  async getRoleStats(): Promise<any> {
    try {
      const stats = await this.rolesRepository
        .createQueryBuilder('role')
        .leftJoin('role.users', 'user')
        .select('role.rolId', 'rolId')
        .addSelect('role.nombreRol', 'nombreRol')
        .addSelect('COUNT(user.usuarioId)', 'totalUsuarios')
        .addSelect(
          'SUM(CASE WHEN user.activo = true THEN 1 ELSE 0 END)',
          'usuariosActivos',
        )
        .groupBy('role.rolId')
        .addGroupBy('role.nombreRol')
        .orderBy('role.rolId', 'ASC')
        .getRawMany();

      return stats;
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas de roles:', error);
      throw new BadRequestException('Error al obtener estadísticas de roles');
    }
  }

  async findManyByIds(ids: number[]): Promise<Role[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return await this.rolesRepository.findBy({ rolId: In(ids) });
  }

  async findModulesByRole(id: number): Promise<ModuleEntity[]> {
    const role = await this.rolesRepository.findOne({
      where: { rolId: id },
      relations: ['modules'],
    });

    if (!role) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    return role.modules || [];
  }

  async setModulesForRole(id: number, moduloIds: number[]): Promise<Role> {
    const role = await this.findOne(id);

    const modules =
      moduloIds && moduloIds.length
        ? await this.modulesRepository.findBy({ moduloId: In(moduloIds) })
        : [];

    if (moduloIds && moduloIds.length && modules.length !== moduloIds.length) {
      const foundIds = new Set(modules.map((m) => m.moduloId));
      const notFound = moduloIds.filter((mid) => !foundIds.has(mid));
      throw new NotFoundException(
        `Algunos módulos no fueron encontrados: IDs ${notFound.join(', ')}`,
      );
    }

    role.modules = modules;
    const saved = await this.rolesRepository.save(role);

    // WebSocket
    this.realtime.emitEntityUpdate('roles', 'updated', saved);

    return saved;
  }

  async addModuleToRole(rolId: number, moduloId: number): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { rolId },
      relations: ['modules'],
    });
    if (!role) throw new NotFoundException(`Rol con ID ${rolId} no encontrado`);

    const module = await this.modulesRepository.findOne({
      where: { moduloId },
    });
    if (!module)
      throw new NotFoundException(`Módulo con ID ${moduloId} no encontrado`);

    role.modules = role.modules || [];

    const already = role.modules.some((m) => m.moduloId === moduloId);
    if (already) {
      return role;
    }

    role.modules.push(module);
    const saved = await this.rolesRepository.save(role);
    this.logger.log(`🔗 Módulo ${moduloId} asignado al rol ${rolId}`);
    return saved;
  }

  async removeModuleFromRole(rolId: number, moduloId: number): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { rolId },
      relations: ['modules'],
    });
    if (!role) throw new NotFoundException(`Rol con ID ${rolId} no encontrado`);

    role.modules = (role.modules || []).filter((m) => m.moduloId !== moduloId);
    const saved = await this.rolesRepository.save(role);

    // WebSocket
    this.realtime.emitEntityUpdate('roles', 'updated', saved);

    return saved;
  }
}
