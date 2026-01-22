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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from './entities/role.entity';
import { AssignModulesDto } from './dto/assign-modules.dto';
import { ModuleResponseDto } from '../modules/dto/module-response.dto';

@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles('Administrador')
  @ApiOperation({ 
    summary: 'Crear rol', 
    description: 'Crea un nuevo rol (Solo Administrador)' 
  })
  @ApiResponse({ status: 201, description: 'Rol creado exitosamente' })
  @ApiResponse({ status: 409, description: 'El nombre del rol ya existe' })
  async create(@Body() createRoleDto: CreateRoleDto) {
    const role = await this.rolesService.create(createRoleDto);
    return {
      message: 'Rol creado exitosamente',
      data: this.mapToResponseDto(role),
    };
  }

  @Get()
  @Roles('Administrador', 'Secretaria', 'Técnico', 'SGSST')
  @ApiOperation({ 
    summary: 'Obtener todos los roles', 
    description: 'Obtiene la lista de todos los roles' 
  })
  @ApiResponse({ status: 200, description: 'Lista de roles obtenida exitosamente' })
  async findAll() {
    const roles = await this.rolesService.findAll();
    return {
      message: 'Roles obtenidos exitosamente',
      data: roles.map(role => this.mapToResponseDto(role)),
    };
  }

  @Get(':id')
  @Roles('Administrador', 'Secretaria', 'Técnico', 'SGSST')
  @ApiOperation({ 
    summary: 'Obtener rol por ID', 
    description: 'Obtiene un rol específico por su ID' 
  })
  @ApiResponse({ status: 200, description: 'Rol obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const role = await this.rolesService.findOne(id);
    return {
      message: 'Rol obtenido exitosamente',
      data: this.mapToResponseDto(role),
    };
  }

  @Patch(':id')
  @Roles('Administrador')
  @ApiOperation({ 
    summary: 'Actualizar rol', 
    description: 'Actualiza un rol existente (Solo Administrador)' 
  })
  @ApiResponse({ status: 200, description: 'Rol actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  @ApiResponse({ status: 409, description: 'El nombre del rol ya existe' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    const role = await this.rolesService.update(id, updateRoleDto);
    return {
      message: 'Rol actualizado exitosamente',
      data: this.mapToResponseDto(role),
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({ 
    summary: 'Eliminar rol', 
    description: 'Elimina un rol permanentemente (Solo Administrador)' 
  })
  @ApiResponse({ status: 200, description: 'Rol eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar un rol con usuarios asignados' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.rolesService.remove(id);
    return {
      message: 'Rol eliminado exitosamente',
    };
  }

  /**
   * --- Nuevos endpoints para gestionar módulos asignados a un rol ---
   */

  @Get(':id/modulos')
  @Roles('Administrador', 'Secretaria', 'Técnico', 'SGSST')
  @ApiOperation({ summary: 'Obtener módulos asociados a un rol', description: 'Retorna la lista de módulos que tiene asociado un rol.' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Módulos obtenidos exitosamente', type: [ModuleResponseDto] })
  async getModules(@Param('id', ParseIntPipe) id: number) {
    const modules = await this.rolesService.findModulesByRole(id);
    const data: ModuleResponseDto[] = (modules || []).map(m => ({
      moduloId: m.moduloId,
      nombreModulo: m.nombreModulo,
      descripcion: m.descripcion,
      activo: m.activo,
      orden: m.orden,
      rutaFrontend: m.rutaFrontend,
      icono: m.icono,
      codigoInterno: m.codigoInterno,
      fechaCreacion: m.fechaCreacion,
      fechaActualizacion: m.fechaActualizacion,
      roles: (m.roles || []).map(r => ({
        rolId: r.rolId,
        nombreRol: r.nombreRol,
        descripcion: r.descripcion,
        fechaCreacion: r.fechaCreacion,
      })),
    }));
    return {
      message: 'Módulos del rol obtenidos exitosamente',
      data,
    };
  }

  @Patch(':id/modulos')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Asignar (reemplazar) módulos a un rol', description: 'Reemplaza los módulos asociados a un rol. Enviar array vacío para desasignar todos.' })
  @ApiResponse({ status: 200, description: 'Módulos asignados al rol exitosamente' })
  async setModules(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignModulesDto: AssignModulesDto,
  ) {
    const role = await this.rolesService.setModulesForRole(id, assignModulesDto.moduloIds || []);
    return { message: 'Módulos asignados al rol exitosamente', data: this.mapToResponseDto(role) };
  }

  @Post(':id/modulos/:moduloId')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Asignar un módulo a un rol', description: 'Asigna un módulo al rol si no está ya asignado.' })
  @ApiResponse({ status: 200, description: 'Módulo asignado al rol exitosamente' })
  async addModule(
    @Param('id', ParseIntPipe) id: number,
    @Param('moduloId', ParseIntPipe) moduloId: number,
  ) {
    const role = await this.rolesService.addModuleToRole(id, moduloId);
    return { message: 'Módulo asignado al rol exitosamente', data: this.mapToResponseDto(role) };
  }

  @Delete(':id/modulos/:moduloId')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Quitar un módulo a un rol', description: 'Quita la asociación entre módulo y rol.' })
  @ApiResponse({ status: 200, description: 'Módulo removido del rol exitosamente' })
  async removeModule(
    @Param('id', ParseIntPipe) id: number,
    @Param('moduloId', ParseIntPipe) moduloId: number,
  ) {
    await this.rolesService.removeModuleFromRole(id, moduloId);
    return { message: 'Módulo removido del rol exitosamente' };
  }

  private mapToResponseDto(role: Role): RoleResponseDto {
    return {
      rolId: role.rolId,
      nombreRol: role.nombreRol,
      descripcion: role.descripcion,
      fechaCreacion: role.fechaCreacion,
    };
  }
}