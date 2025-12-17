import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) {
    // Verificar y corregir la secuencia al inicializar el servicio
    this.initializeSequence().catch(error => {
      this.logger.warn(`No se pudo inicializar la secuencia de roles: ${error.message}`);
    });
  }

  /**
   * Inicializa y corrige la secuencia de rol_id si es necesario
   */
  private async initializeSequence(): Promise<void> {
    try {
      const result = await this.rolesRepository.query(`
        SELECT setval('roles_rol_id_seq', 
          COALESCE((SELECT MAX(rol_id) FROM roles), 1), 
          true
        ) as last_value;
      `);
      
      this.logger.log(`✅ Secuencia de roles inicializada correctamente. Último valor: ${result[0]?.last_value || 'N/A'}`);
    } catch (error) {
      this.logger.warn(`⚠️ No se pudo inicializar la secuencia de roles: ${error.message}`);
    }
  }

  /**
   * Corrige la secuencia si está desincronizada
   */
  async fixSequenceIfNeeded(): Promise<{ corrected: boolean; message: string }> {
    try {
      // Obtener el máximo ID actual en la tabla
      const maxIdResult = await this.rolesRepository.query(`
        SELECT MAX(rol_id) as max_id FROM roles
      `);
      const maxId = maxIdResult[0]?.max_id || 0;

      // Obtener el último valor de la secuencia
      const sequenceResult = await this.rolesRepository.query(`
        SELECT last_value FROM roles_rol_id_seq
      `);
      const lastSequenceValue = sequenceResult[0]?.last_value || 0;

      this.logger.debug(`🔍 Verificando secuencia de roles: Max ID=${maxId}, Secuencia=${lastSequenceValue}`);

      // Si la secuencia está detrás del máximo ID, corregirla
      if (lastSequenceValue <= maxId) {
        await this.rolesRepository.query(`
          SELECT setval('roles_rol_id_seq', $1, true)
        `, [maxId]);
        
        const message = `✅ Secuencia de roles corregida: ${lastSequenceValue} → ${maxId}`;
        this.logger.log(message);
        return { corrected: true, message };
      }

      return { corrected: false, message: 'Secuencia de roles ya está actualizada' };
    } catch (error) {
      const errorMessage = `❌ Error corrigiendo secuencia de roles: ${error.message}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Crea un nuevo rol
   */
  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    // Verificar secuencia antes de crear
    await this.fixSequenceIfNeeded();

    // Verificar si el nombre del rol ya existe
    const existingRole = await this.rolesRepository.findOne({
      where: { nombreRol: createRoleDto.nombreRol }
    });

    if (existingRole) {
      throw new ConflictException('El nombre del rol ya existe');
    }

    const role = this.rolesRepository.create(createRoleDto);
    
    let savedRole: Role;
    
    try {
      savedRole = await this.rolesRepository.save(role);
      this.logger.log(`🎭 Rol creado exitosamente: ${savedRole.rolId} - ${savedRole.nombreRol}`);
    } catch (error) {
      // Si hay error de duplicado, verificar y corregir secuencia
      if (error.code === '23505' && error.constraint === 'roles_pkey') {
        this.logger.warn('⚠️ Error de duplicado en PK de roles, corrigiendo secuencia...');
        await this.fixSequenceIfNeeded();
        
        // Reintentar la inserción
        savedRole = await this.rolesRepository.save(role);
      } else {
        throw error;
      }
    }

    return savedRole;
  }

  /**
   * Obtiene todos los roles
   */
  async findAll(): Promise<Role[]> {
    return await this.rolesRepository.find({
      order: { rolId: 'ASC' },
    });
  }

  /**
   * Obtiene un rol por ID
   */
  async findOne(id: number): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { rolId: id }
    });

    if (!role) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    return role;
  }

  /**
   * Busca rol por nombre
   */
  async findByName(nombreRol: string): Promise<Role | null> {
    return await this.rolesRepository.findOne({
      where: { nombreRol }
    });
  }

  /**
   * Actualiza un rol existente
   */
  async update(id: number, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);

    // Verificar si se está actualizando el nombre y si ya existe
    if (updateRoleDto.nombreRol && updateRoleDto.nombreRol !== role.nombreRol) {
      const existingRole = await this.findByName(updateRoleDto.nombreRol);
      if (existingRole) {
        throw new ConflictException('El nombre del rol ya existe');
      }
    }

    await this.rolesRepository.update(id, updateRoleDto);
    const updatedRole = await this.findOne(id);
    
    this.logger.log(`🎭 Rol actualizado: ${id}`);
    return updatedRole;
  }

  /**
   * Elimina un rol
   */
  async remove(id: number): Promise<void> {
    const role = await this.rolesRepository.findOne({
      where: { rolId: id },
      relations: ['users']
    });

    if (!role) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    // Verificar si el rol tiene usuarios asignados
    if (role.users && role.users.length > 0) {
      throw new BadRequestException('No se puede eliminar un rol que tiene usuarios asignados');
    }

    await this.rolesRepository.remove(role);
    this.logger.log(`🎭 Rol eliminado: ${id}`);
  }

  /**
   * Obtiene roles por nombre (búsqueda)
   */
  async searchRoles(nombre?: string): Promise<Role[]> {
    const queryBuilder = this.rolesRepository.createQueryBuilder('role');

    if (nombre) {
      queryBuilder.where('role.nombreRol ILIKE :nombre', { nombre: `%${nombre}%` });
    }

    return await queryBuilder.orderBy('role.rolId', 'ASC').getMany();
  }

  /**
   * Método de diagnóstico - Verifica estado de la secuencia de roles
   */
  async diagnoseSequence(): Promise<any> {
    try {
      const [maxIdResult, sequenceResult] = await Promise.all([
        this.rolesRepository.query('SELECT MAX(rol_id) as max_id FROM roles'),
        this.rolesRepository.query('SELECT last_value FROM roles_rol_id_seq')
      ]);

      const maxId = maxIdResult[0]?.max_id || 0;
      const lastSequenceValue = sequenceResult[0]?.last_value || 0;

      return {
        maxId,
        lastSequenceValue,
        synchronized: lastSequenceValue >= maxId,
        needsCorrection: lastSequenceValue < maxId,
        difference: maxId - lastSequenceValue
      };
    } catch (error) {
      throw new Error(`Error en diagnóstico de secuencia de roles: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas de roles
   */
  async getRoleStats(): Promise<any> {
    try {
      const stats = await this.rolesRepository
        .createQueryBuilder('role')
        .leftJoin('role.users', 'user')
        .select('role.rolId', 'rolId')
        .addSelect('role.nombreRol', 'nombreRol')
        .addSelect('COUNT(user.usuarioId)', 'totalUsuarios')
        .addSelect('SUM(CASE WHEN user.activo = true THEN 1 ELSE 0 END)', 'usuariosActivos')
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
}