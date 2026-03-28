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
  Req,
  ForbiddenException,
  Logger,
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
import { UploadImageSwaggerDto } from '../images/dto/upload-image.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImagesService } from '../images/images.service';
import { Request } from 'express';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly imagesService: ImagesService,
  ) {}

  // Utilidad para obtener el id del usuario autenticado
  private async getRequesterIdFromReq(req: Request): Promise<number | null> {
    const requester = (req as any).user ?? {};
    let raw = requester.usuarioId ?? requester.id ?? requester.sub ?? null;
    if (raw !== null && raw !== undefined) {
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string') {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    if (requester.username) {
      try {
        const found = await this.usersService.findByUsername(
          requester.username,
        );
        return found?.usuarioId ?? null;
      } catch {}
    }
    if (requester.email) {
      try {
        const found = await this.usersService.findByEmail(requester.email);
        return found?.usuarioId ?? null;
      } catch {}
    }
    return null;
  }

  @Post()
   
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

  @Get('me')
  @ApiOperation({
    summary: 'Obtener perfil del usuario autenticado',
    description: 'Devuelve la información del usuario autenticado (me)',
  })
  @ApiResponse({ status: 200, description: 'Usuario obtenido exitosamente' })
  async getMe(@Req() req: Request) {
    const requesterId = await this.getRequesterIdFromReq(req);
    if (!requesterId) {
      throw new ForbiddenException(
        'No se pudo identificar el usuario autenticado',
      );
    }

    const user = await this.usersService.findOne(requesterId);
    return {
      message: 'Usuario obtenido exitosamente',
      data: this.mapToResponseDto(user),
    };
  }

  @Get(':id')
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
  @ApiOperation({
    summary: 'Actualizar usuario',
    description:
      'Actualiza un usuario existente. Administradores pueden actualizar cualquier usuario. Un usuario autenticado puede actualizar su propio perfil.',
  })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 409, description: 'El email o username ya existe' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: Request,
  ) {
    const requesterId = await this.getRequesterIdFromReq(req);

    // Determinar si requester es Admin (si viene en token)
    const requester = (req as any).user ?? {};
    let isAdmin = false;
    if (requester?.role?.nombreRol) {
      isAdmin =
        String(requester.role.nombreRol).toLowerCase() === 'administrador';
    } else if (requesterId) {
      try {
        const requesterUser = await this.usersService.findOne(requesterId);
        isAdmin =
          requesterUser.role?.nombreRol?.toLowerCase() === 'administrador';
      } catch {
        isAdmin = false;
      }
    }

    // Si no es admin y no es el dueño del recurso -> forbidden
    if (!isAdmin) {
      if (!requesterId || Number(requesterId) !== Number(id)) {
        throw new ForbiddenException(
          'No autorizado para actualizar este usuario',
        );
      }
    }

    // Si no es admin y intenta cambiar rol -> forbidden
    if (!isAdmin && (updateUserDto as any).rolId !== undefined) {
      throw new ForbiddenException('No autorizado para modificar el rol');
    }

    // Si no es admin y intenta cambiar estado -> forbidden
    if (!isAdmin && (updateUserDto as any).activo !== undefined) {
      throw new ForbiddenException('No autorizado para modificar el estado');
    }

    const user = await this.usersService.update(id, updateUserDto);
    return {
      message: 'Usuario actualizado exitosamente',
      data: this.mapToResponseDto(user),
    };
  }

  @Delete(':id')
   
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
    const safeFormatDate = (
      dateValue: any,
      format: 'iso' | 'date-only' = 'iso',
    ): string | undefined => {
      if (!dateValue) return undefined;
      let date: Date;
      if (dateValue instanceof Date) {
        date = dateValue;
      } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          return undefined;
        }
      } else {
        date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          return undefined;
        }
      }
      if (format === 'date-only') {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } else {
        return date.toISOString();
      }
    };

    const fechaCreacionString =
      user.fechaCreacion instanceof Date
        ? user.fechaCreacion.toISOString()
        : new Date(user.fechaCreacion).toISOString();

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
      fechaCreacion: fechaCreacionString,
      fechaNacimiento: safeFormatDate(user.fechaNacimiento, 'date-only'),
      genero: user.genero,
      resetToken: user.resetToken,
      resetTokenExpiry: safeFormatDate(user.resetTokenExpiry, 'iso'),
      role: {
        rolId: user.role.rolId,
        nombreRol: user.role.nombreRol,
      },
      // nuevos campos
      ubicacionResidencia: (user as any).ubicacionResidencia ?? null,
      arl: (user as any).arl ?? null,
      eps: (user as any).eps ?? null,
      afp: (user as any).afp ?? null,
      contactoEmergenciaNombre: (user as any).contactoEmergenciaNombre ?? null,
      contactoEmergenciaTelefono:
        (user as any).contactoEmergenciaTelefono ?? null,
      contactoEmergenciaParentesco:
        (user as any).contactoEmergenciaParentesco ?? null,
      mustChangePassword: user.mustChangePassword,
      position: user.position,
    } as UserResponseDto;
  }
}
