import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from './entities/user.entity';
import { UploadImageSwaggerDto } from 'src/images/dto/upload-image.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImagesService } from 'src/images/images.service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly imagesService: ImagesService,
  ) {}

  @Post()
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Crear usuario',
    description: 'Crea un nuevo usuario (Solo Administrador)',
  })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 409, description: 'El email o username ya existe' })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return {
      message: 'Usuario creado exitosamente',
      user: this.mapToResponseDto(user),
    };
  }

  @Get()
  @Roles('Administrador', 'Secretaria', 'Técnico', 'SGSST')
  @ApiOperation({
    summary: 'Obtener todos los usuarios',
    description:
      'Obtiene la lista de todos los usuarios (Administrador y Secretaria)',
  })
  @ApiQuery({ name: 'role', required: false, description: 'Filtrar por rol' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
  })
  async findAll(@Query('role') role?: string) {
    let users;

    if (role) {
      users = await this.usersService.getUsersByRole(role);
    } else {
      users = await this.usersService.findAll();
    }

    return {
      message: 'Usuarios obtenidos exitosamente',
      data: users.map((user) => this.mapToResponseDto(user)),
    };
  }

  @Get('technicians')
  @ApiOperation({
    summary: 'Obtener técnicos',
    description: 'Obtiene la lista de todos los técnicos activos',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de técnicos obtenida exitosamente',
  })
  async getTechnicians() {
    const technicians = await this.usersService.getTechnicians();
    return {
      message: 'Técnicos obtenidos exitosamente',
      data: technicians.map((user) => this.mapToResponseDto(user)),
    };
  }

  @Get('clients')
  @ApiOperation({
    summary: 'Obtener clientes',
    description: 'Obtiene la lista de todos los clientes activos',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes obtenida exitosamente',
  })
  async getClients() {
    const clients = await this.usersService.getClients();
    return {
      message: 'Clientes obtenidos exitosamente',
      data: clients.map((user) => this.mapToResponseDto(user)),
    };
  }

  @Get(':id')
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description: 'Obtiene un usuario específico por su ID',
  })
  @ApiResponse({ status: 200, description: 'Usuario obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOne(id);
    return {
      message: 'Usuario obtenido exitosamente',
      data: this.mapToResponseDto(user),
    };
  }

  @Patch(':id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Actualizar usuario',
    description: 'Actualiza un usuario existente (Solo Administrador)',
  })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 409, description: 'El email o username ya existe' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, updateUserDto);
    return {
      message: 'Usuario actualizado exitosamente',
      data: this.mapToResponseDto(user),
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Eliminar usuario',
    description: 'Elimina un usuario permanentemente (Solo Administrador)',
  })
  @ApiResponse({ status: 200, description: 'Usuario eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.usersService.remove(id);
    return {
      message: 'Usuario eliminado exitosamente',
    };
  }

  @Patch(':id/deactivate')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Desactivar usuario',
    description: 'Desactiva un usuario (Solo Administrador)',
  })
  @ApiResponse({ status: 200, description: 'Usuario desactivado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.deactivate(id);
    return {
      message: 'Usuario desactivado exitosamente',
      data: this.mapToResponseDto(user),
    };
  }

  @Patch(':id/activate')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Activar usuario',
    description:
      'Activa un usuario previamente desactivado (Solo Administrador)',
  })
  @ApiResponse({ status: 200, description: 'Usuario activado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async activate(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.activate(id);
    return {
      message: 'Usuario activado exitosamente',
      data: this.mapToResponseDto(user),
    };
  }

  @Get('roles/all')
  @ApiOperation({
    summary: 'Obtener todos los roles',
    description: 'Obtiene la lista de todos los roles disponibles',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de roles obtenida exitosamente',
  })
  async getAllRoles() {
    const roles = await this.usersService.findAllRoles();
    return {
      message: 'Roles obtenidos exitosamente',
      data: roles,
    };
  }

  @Get('roles/active')
  @ApiOperation({
    summary: 'Obtener roles activos',
    description: 'Obtiene la lista de roles para uso en formularios',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de roles activos obtenida exitosamente',
  })
  async getActiveRoles() {
    const roles = await this.usersService.findActiveRoles();
    return {
      message: 'Roles activos obtenidos exitosamente',
      data: roles,
    };
  }

  @Get(':id/photo')
  @ApiOperation({ summary: 'Obtener la foto de perfil del usuario' })
  @ApiResponse({ status: 200, description: 'Foto obtenida correctamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async getUserPhoto(@Param('id', ParseIntPipe) id: number) {
    return this.imagesService.getUserProfilePhoto(id);
  }

  @Post(':id/photo')
  @ApiOperation({ summary: 'Subir o reemplazar la foto de perfil del usuario' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadImageSwaggerDto })
  @ApiResponse({ status: 201, description: 'Foto subida correctamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.imagesService.uploadForUser(id, file);
  }

  @Delete(':id/photo')
  @ApiOperation({ summary: 'Eliminar la foto de perfil del usuario' })
  @ApiResponse({ status: 200, description: 'Foto eliminada correctamente' })
  @ApiResponse({ status: 404, description: 'Usuario o foto no encontrada' })
  async deleteUserPhoto(@Param('id', ParseIntPipe) id: number) {
    return this.imagesService.deleteUserImages(id);
  }

  private mapToResponseDto(user: User): UserResponseDto {
    return {
      usuarioId: user.usuarioId,
      nombre: user.nombre,
      apellido: user.apellido,
      tipoCedula: user.tipoCedula,
      cedula: user.cedula,
      email: user.email,
      username: user.username,
      telefono: user.telefono,
      activo: user.activo,
      fechaCreacion: user.fechaCreacion,
      resetToken: user.resetToken,
      resetTokenExpiry: user.resetTokenExpiry,
      role: {
        rolId: user.role.rolId,
        nombreRol: user.role.nombreRol,
      },
    };
  }
}
