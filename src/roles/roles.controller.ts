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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from './entities/role.entity';

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

  private mapToResponseDto(role: Role): RoleResponseDto {
    return {
      rolId: role.rolId,
      nombreRol: role.nombreRol,
      descripcion: role.descripcion,
      fechaCreacion: role.fechaCreacion,
    };
  }
}