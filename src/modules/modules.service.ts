import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from './entities/module.entity';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { RolesService } from '../roles/roles.service'; // Asegúrate que esta ruta sea correcta
import { Role } from '../roles/entities/role.entity';

@Injectable()
export class ModulesService {
  private readonly logger = new Logger(ModulesService.name);

  constructor(
    @InjectRepository(Module)
    private modulesRepository: Repository<Module>,
    private readonly rolesService: RolesService,
  ) {}

  /**
   * Crea un nuevo módulo
   */
  async create(createModuleDto: CreateModuleDto): Promise<Module> {
    // 1. Verificar si el nombre del módulo ya existe
    const existingModuleByName = await this.modulesRepository.findOne({
      where: { nombreModulo: createModuleDto.nombreModulo }
    });
    if (existingModuleByName) {
      throw new ConflictException(`El módulo con nombre '${createModuleDto.nombreModulo}' ya existe.`);
    }

    // 2. Verificar si el código interno ya existe (si se proporciona)
    if (createModuleDto.codigoInterno) {
      const existingModuleByCode = await this.modulesRepository.findOne({
        where: { codigoInterno: createModuleDto.codigoInterno }
      });
      if (existingModuleByCode) { // En create, si ya existe es siempre un conflicto.
        throw new ConflictException(`El módulo con código interno '${createModuleDto.codigoInterno}' ya existe.`);
      }
    }

    // Separar los IDs de los roles del resto de los datos del módulo
    const { roles: roleIds, ...moduleData } = createModuleDto;

    // Crear la instancia del módulo SIN los roles todavía
    const module = this.modulesRepository.create(moduleData);

    // 3. Asociar roles si se proporcionan IDs
    if (roleIds && roleIds.length > 0) {
      module.roles = await this.getRolesByIds(roleIds);
    } else {
      module.roles = []; // Asegurar que es un array vacío si no se proporcionan roles
    }

    try {
      const savedModule = await this.modulesRepository.save(module);
      this.logger.log(`✅ Módulo creado exitosamente: ${savedModule.moduloId} - ${savedModule.nombreModulo}`);
      return savedModule;
    } catch (error) {
      this.logger.error(`❌ Error al crear módulo: ${error.message}`, error.stack);
      throw new BadRequestException('No se pudo crear el módulo. Revise los datos proporcionados.');
    }
  }

  /**
   * Obtiene todos los módulos
   */
  async findAll(): Promise<Module[]> {
    return await this.modulesRepository.find({
      relations: ['roles'],
      order: { orden: 'ASC', nombreModulo: 'ASC' },
    });
  }

  /**
   * Obtiene un módulo por ID
   */
  async findOne(id: number): Promise<Module> {
    const module = await this.modulesRepository.findOne({
      where: { moduloId: id },
      relations: ['roles'],
    });

    if (!module) {
      throw new NotFoundException(`Módulo con ID ${id} no encontrado`);
    }
    return module;
  }

  /**
   * Actualiza un módulo existente
   */
  async update(id: number, updateModuleDto: UpdateModuleDto): Promise<Module> {
    const moduleToUpdate = await this.findOne(id); // Reutiliza findOne para verificar existencia

    // 1. Verificar si el nombre del módulo está siendo actualizado y si ya existe
    if (updateModuleDto.nombreModulo && updateModuleDto.nombreModulo !== moduleToUpdate.nombreModulo) {
      const existingModuleByName = await this.modulesRepository.findOne({
        where: { nombreModulo: updateModuleDto.nombreModulo }
      });
      if (existingModuleByName && existingModuleByName.moduloId !== id) {
        throw new ConflictException(`El módulo con nombre '${updateModuleDto.nombreModulo}' ya existe.`);
      }
    }

    // 2. Verificar si el código interno está siendo actualizado y si ya existe
    if (updateModuleDto.codigoInterno && updateModuleDto.codigoInterno !== moduleToUpdate.codigoInterno) {
      const existingModuleByCode = await this.modulesRepository.findOne({
        where: { codigoInterno: updateModuleDto.codigoInterno }
      });
      if (existingModuleByCode && existingModuleByCode.moduloId !== id) {
        throw new ConflictException(`El módulo con código interno '${updateModuleDto.codigoInterno}' ya existe.`);
      }
    }

    // Separar los IDs de los roles del resto de los datos del módulo a actualizar
    const { roles: roleIdsToUpdate, ...moduleDataToUpdate } = updateModuleDto;

    // 3. Actualizar propiedades del módulo usando merge (sin los roles)
    this.modulesRepository.merge(moduleToUpdate, moduleDataToUpdate);

    // 4. Actualizar roles si se proporcionan nuevos roles
    if (roleIdsToUpdate !== undefined) { // Permite desasociar todos los roles pasando un array vacío
      moduleToUpdate.roles = await this.getRolesByIds(roleIdsToUpdate);
    }

    try {
      const updatedModule = await this.modulesRepository.save(moduleToUpdate);
      this.logger.log(`✅ Módulo actualizado exitosamente: ${id} - ${updatedModule.nombreModulo}`);
      return updatedModule;
    } catch (error) {
      this.logger.error(`❌ Error al actualizar módulo ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('No se pudo actualizar el módulo. Revise los datos proporcionados.');
    }
  }

  /**
   * Elimina un módulo
   */
  async remove(id: number): Promise<void> {
    const module = await this.findOne(id);
    await this.modulesRepository.remove(module);
    this.logger.log(`🗑️ Módulo eliminado: ${id}`);
  }

  /**
   * Método auxiliar para obtener entidades de Role por sus IDs
   */
  private async getRolesByIds(roleIds: number[]): Promise<Role[]> {
    if (!roleIds || roleIds.length === 0) {
      return [];
    }
    const roles = await this.rolesService.findManyByIds(roleIds);

    if (roles.length !== roleIds.length) {
      const foundIds = new Set(roles.map(r => r.rolId));
      const notFoundIds = roleIds.filter(id => !foundIds.has(id));
      throw new NotFoundException(`Algunos roles no fueron encontrados: IDs ${notFoundIds.join(', ')}`);
    }
    return roles;
  }

  /**
   * Reemplaza los roles asociados a un módulo (bulk)
   */
  async setRoles(id: number, roleIds: number[]): Promise<Module> {
    const moduleToUpdate = await this.findOne(id);

    const roles = roleIds && roleIds.length
      ? await this.rolesService.findManyByIds(roleIds)
      : [];

    if (roleIds && roleIds.length && roles.length !== roleIds.length) {
      const foundIds = new Set(roles.map(r => r.rolId));
      const notFound = roleIds.filter(rid => !foundIds.has(rid));
      throw new NotFoundException(`Algunos roles no fueron encontrados: IDs ${notFound.join(', ')}`);
    }

    moduleToUpdate.roles = roles;
    const updated = await this.modulesRepository.save(moduleToUpdate);
    this.logger.log(`🔗 Roles actualizados para módulo ${id}`);
    return updated;
  }

  /**
   * Añade un rol a un módulo (idempotente)
   */
  async addRole(moduleId: number, roleId: number): Promise<Module> {
    const module = await this.findOne(moduleId);
    const role = await this.rolesService.findOne(roleId); // arroja NotFoundException si no existe

    module.roles = module.roles || [];

    const exists = module.roles.some(r => r.rolId === roleId);
    if (!exists) {
      module.roles.push(role);
      const saved = await this.modulesRepository.save(module);
      this.logger.log(`🔗 Rol ${roleId} asignado al módulo ${moduleId}`);
      return saved;
    }
    return module;
  }

  /**
   * Remueve la asociación de un rol a un módulo
   */
  async removeRole(moduleId: number, roleId: number): Promise<void> {
    const module = await this.findOne(moduleId);
    const originalLength = (module.roles || []).length;
    module.roles = (module.roles || []).filter(r => r.rolId !== roleId);
    if (module.roles.length === originalLength) {
      // No existía la asociación; idempotente -> no error
      return;
    }
    await this.modulesRepository.save(module);
    this.logger.log(`❌ Rol ${roleId} removido del módulo ${moduleId}`);
  }
}