import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ModulesService } from './modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModuleResponseDto } from './dto/module-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Module } from './entities/module.entity';
import { RoleResponseDto } from '../roles/dto/role-response.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

@ApiTags('modulos')
@Controller('modulos')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Post()
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Crear un nuevo módulo',
    description: 'Permite crear un nuevo módulo y asociarle roles (Solo Dev)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Módulo creado exitosamente',
    type: ModuleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'El nombre o código interno del módulo ya existe',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Algunos roles no fueron encontrados',
  })
  async create(@Body() createModuleDto: CreateModuleDto) {
    const module = await this.modulesService.create(createModuleDto);
    return {
      message: 'Módulo creado exitosamente',
      data: this.mapToResponseDto(module),
    };
  }

  @Get()
  @Roles('Administrador', 'Secretaria', 'Técnico', 'Cliente')
  @ApiOperation({
    summary: 'Obtener todos los módulos',
    description:
      'Retorna una lista de todos los módulos disponibles con sus roles asociados. La visibilidad para el usuario final se determina en el frontend (o un endpoint específico).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de módulos obtenida exitosamente',
    type: [ModuleResponseDto],
  })
  async findAll() {
    const modules = await this.modulesService.findAll();
    return {
      message: 'Módulos obtenidos exitosamente',
      data: modules.map((module) => this.mapToResponseDto(module)),
    };
  }

  @Get(':id')
  @Roles('Administrador', 'Secretaria', 'Técnico', 'Cliente')
  @ApiOperation({
    summary: 'Obtener módulo por ID',
    description:
      'Retorna un módulo específico por su ID con sus roles asociados (Solo Dev)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Módulo obtenido exitosamente',
    type: ModuleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Módulo no encontrado',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const module = await this.modulesService.findOne(id);
    return {
      message: 'Módulo obtenido exitosamente',
      data: this.mapToResponseDto(module),
    };
  }

  @Patch(':id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Actualizar un módulo',
    description:
      'Actualiza la información de un módulo existente y sus roles asociados (Solo Dev)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Módulo actualizado exitosamente',
    type: ModuleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Módulo no encontrado',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'El nombre o código interno del módulo ya existe',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Algunos roles no fueron encontrados',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateModuleDto: UpdateModuleDto,
  ) {
    const module = await this.modulesService.update(id, updateModuleDto);
    return {
      message: 'Módulo actualizado exitosamente',
      data: this.mapToResponseDto(module),
    };
  }

  @Delete(':id')
  @Roles('DEV')
  @ApiOperation({
    summary: 'Eliminar un módulo',
    description: 'Elimina un módulo permanentemente (Solo Dev)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Módulo eliminado exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Módulo no encontrado',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.modulesService.remove(id);
    return {
      message: 'Módulo eliminado exitosamente',
    };
  }

  /**
   * --- Nuevos endpoints para gestionar roles asignados a un módulo ---
   */

  @Post(':id/roles')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Asignar (reemplazar) roles a un módulo', description: 'Reemplaza los roles asociados a un módulo.' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Roles asignados al módulo', type: ModuleResponseDto })
  async setRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignRolesDto: AssignRolesDto,
  ) {
    const module = await this.modulesService.setRoles(id, assignRolesDto.roles || []);
    return { message: 'Roles asignados al módulo', data: this.mapToResponseDto(module) };
  }

  @Post(':id/roles/:rolId')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Añadir un rol a un módulo' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Rol añadido al módulo' })
  async addRole(
    @Param('id', ParseIntPipe) id: number,
    @Param('rolId', ParseIntPipe) rolId: number,
  ) {
    const module = await this.modulesService.addRole(id, rolId);
    return { message: 'Rol añadido al módulo', data: this.mapToResponseDto(module) };
  }

  @Delete(':id/roles/:rolId')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Quitar un rol de un módulo' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Rol removido del módulo' })
  async removeRole(
    @Param('id', ParseIntPipe) id: number,
    @Param('rolId', ParseIntPipe) rolId: number,
  ) {
    await this.modulesService.removeRole(id, rolId);
    return { message: 'Rol removido del módulo' };
  }

  private mapToResponseDto(module: Module): ModuleResponseDto {
    const rolesDto: RoleResponseDto[] = module.roles
      ? module.roles.map((role) => ({
          rolId: role.rolId,
          nombreRol: role.nombreRol,
          descripcion: role.descripcion,
          fechaCreacion: role.fechaCreacion,
        }))
      : [];

    return {
      moduloId: module.moduloId,
      nombreModulo: module.nombreModulo,
      descripcion: module.descripcion,
      activo: module.activo,
      orden: module.orden,
      rutaFrontend: module.rutaFrontend,
      icono: module.icono,
      codigoInterno: module.codigoInterno,
      fechaCreacion: module.fechaCreacion,
      fechaActualizacion: module.fechaActualizacion,
      roles: rolesDto,
    };
  }
}