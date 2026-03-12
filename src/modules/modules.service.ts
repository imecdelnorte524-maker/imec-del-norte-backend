import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from './entities/module.entity';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { RolesService } from '../roles/roles.service';
import { Role } from '../roles/entities/role.entity';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class ModulesService {
  private readonly logger = new Logger(ModulesService.name);

  constructor(
    @InjectRepository(Module)
    private modulesRepository: Repository<Module>,
    private readonly rolesService: RolesService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(createModuleDto: CreateModuleDto): Promise<Module> {
    const existingModuleByName = await this.modulesRepository.findOne({
      where: { nombreModulo: createModuleDto.nombreModulo },
    });
    if (existingModuleByName) {
      throw new ConflictException(
        `El módulo con nombre '${createModuleDto.nombreModulo}' ya existe.`,
      );
    }

    if (createModuleDto.codigoInterno) {
      const existingModuleByCode = await this.modulesRepository.findOne({
        where: { codigoInterno: createModuleDto.codigoInterno },
      });
      if (existingModuleByCode) {
        throw new ConflictException(
          `El módulo con código interno '${createModuleDto.codigoInterno}' ya existe.`,
        );
      }
    }

    const { roles: roleIds, ...moduleData } = createModuleDto;
    const module = this.modulesRepository.create(moduleData);

    if (roleIds && roleIds.length > 0) {
      module.roles = await this.getRolesByIds(roleIds);
    } else {
      module.roles = [];
    }

    try {
      const savedModule = await this.modulesRepository.save(module);
      this.logger.log(
        `✅ Módulo creado exitosamente: ${savedModule.moduloId} - ${savedModule.nombreModulo}`,
      );

      // Evento WebSocket
      this.realtime.emitEntityUpdate('modules', 'created', savedModule);

      return savedModule;
    } catch (error) {
      this.logger.error(
        `❌ Error al crear módulo: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        'No se pudo crear el módulo. Revise los datos proporcionados.',
      );
    }
  }

  async findAll(): Promise<Module[]> {
    return await this.modulesRepository.find({
      relations: ['roles'],
      order: { orden: 'ASC', nombreModulo: 'ASC' },
    });
  }

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

  async update(id: number, updateModuleDto: UpdateModuleDto): Promise<Module> {
    const moduleToUpdate = await this.findOne(id);

    if (
      updateModuleDto.nombreModulo &&
      updateModuleDto.nombreModulo !== moduleToUpdate.nombreModulo
    ) {
      const existingModuleByName = await this.modulesRepository.findOne({
        where: { nombreModulo: updateModuleDto.nombreModulo },
      });
      if (existingModuleByName && existingModuleByName.moduloId !== id) {
        throw new ConflictException(
          `El módulo con nombre '${updateModuleDto.nombreModulo}' ya existe.`,
        );
      }
    }

    if (
      updateModuleDto.codigoInterno &&
      updateModuleDto.codigoInterno !== moduleToUpdate.codigoInterno
    ) {
      const existingModuleByCode = await this.modulesRepository.findOne({
        where: { codigoInterno: updateModuleDto.codigoInterno },
      });
      if (existingModuleByCode && existingModuleByCode.moduloId !== id) {
        throw new ConflictException(
          `El módulo con código interno '${updateModuleDto.codigoInterno}' ya existe.`,
        );
      }
    }

    const { roles: roleIdsToUpdate, ...moduleDataToUpdate } = updateModuleDto;

    this.modulesRepository.merge(moduleToUpdate, moduleDataToUpdate);

    if (roleIdsToUpdate !== undefined) {
      moduleToUpdate.roles = await this.getRolesByIds(roleIdsToUpdate);
    }

    try {
      const updatedModule = await this.modulesRepository.save(moduleToUpdate);
      this.logger.log(
        `✅ Módulo actualizado exitosamente: ${id} - ${updatedModule.nombreModulo}`,
      );

      // Evento WebSocket
      this.realtime.emitEntityUpdate('modules', 'updated', updatedModule);

      return updatedModule;
    } catch (error) {
      this.logger.error(
        `❌ Error al actualizar módulo ${id}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        'No se pudo actualizar el módulo. Revise los datos proporcionados.',
      );
    }
  }

  async remove(id: number): Promise<void> {
    const module = await this.findOne(id);
    await this.modulesRepository.remove(module);
    this.logger.log(`🗑️ Módulo eliminado: ${id}`);

    // Evento WebSocket
    this.realtime.emitEntityUpdate('modules', 'deleted', { id });
  }

  private async getRolesByIds(roleIds: number[]): Promise<Role[]> {
    if (!roleIds || roleIds.length === 0) {
      return [];
    }
    const roles = await this.rolesService.findManyByIds(roleIds);

    if (roles.length !== roleIds.length) {
      const foundIds = new Set(roles.map((r) => r.rolId));
      const notFoundIds = roleIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Algunos roles no fueron encontrados: IDs ${notFoundIds.join(', ')}`,
      );
    }
    return roles;
  }

  async setRoles(id: number, roleIds: number[]): Promise<Module> {
    const moduleToUpdate = await this.findOne(id);

    const roles =
      roleIds && roleIds.length
        ? await this.rolesService.findManyByIds(roleIds)
        : [];

    if (roleIds && roleIds.length && roles.length !== roleIds.length) {
      const foundIds = new Set(roles.map((r) => r.rolId));
      const notFound = roleIds.filter((rid) => !foundIds.has(rid));
      throw new NotFoundException(
        `Algunos roles no fueron encontrados: IDs ${notFound.join(', ')}`,
      );
    }

    moduleToUpdate.roles = roles;
    const updated = await this.modulesRepository.save(moduleToUpdate);
    this.logger.log(`🔗 Roles actualizados para módulo ${id}`);

    // Evento WebSocket
    this.realtime.emitEntityUpdate('modules', 'updated', updated);

    return updated;
  }

  async addRole(moduleId: number, roleId: number): Promise<Module> {
    const module = await this.findOne(moduleId);
    const role = await this.rolesService.findOne(roleId);

    module.roles = module.roles || [];

    const exists = module.roles.some((r) => r.rolId === roleId);
    if (!exists) {
      module.roles.push(role);
      const saved = await this.modulesRepository.save(module);
      this.logger.log(`🔗 Rol ${roleId} asignado al módulo ${moduleId}`);

      // Evento WebSocket
      this.realtime.emitEntityUpdate('modules', 'updated', saved);

      return saved;
    }
    return module;
  }

  async removeRole(moduleId: number, roleId: number): Promise<void> {
    const module = await this.findOne(moduleId);
    const originalLength = (module.roles || []).length;
    module.roles = (module.roles || []).filter((r) => r.rolId !== roleId);
    if (module.roles.length === originalLength) {
      return;
    }
    const saved = await this.modulesRepository.save(module);
    this.logger.log(`❌ Rol ${roleId} removido del módulo ${moduleId}`);

    // Evento WebSocket
    this.realtime.emitEntityUpdate('modules', 'updated', saved);
  }
}
