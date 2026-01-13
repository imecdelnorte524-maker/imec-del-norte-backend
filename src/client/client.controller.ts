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
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('clients')
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @Roles('Administrador', 'Secretaria', 'Cliente')
  @ApiOperation({
    summary: 'Crear cliente',
    description: 'Crea un nuevo cliente',
  })
  @ApiResponse({ status: 201, description: 'Cliente creado exitosamente' })
  @ApiResponse({ status: 409, description: 'El NIT o email ya existe' })
  async create(
    @Body() createClientDto: CreateClientDto,
    @Req() req: any,
  ) {
    const client = await this.clientService.create(createClientDto, req.user);
    return {
      message: 'Cliente creado exitosamente',
      data: client,
    };
  }

  @Get()
  @Roles('Administrador', 'Secretaria', 'Técnico')
  @ApiOperation({
    summary: 'Obtener todos los clientes',
    description: 'Obtiene la lista de todos los clientes',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes obtenida exitosamente',
  })
  async findAll() {
    const clients = await this.clientService.findAll();
    return {
      message: 'Clientes obtenidos exitosamente',
      data: clients,
    };
  }

  @Get('my')
  @Roles('Cliente')
  @ApiOperation({
    summary: 'Obtener mis clientes empresa',
    description:
      'Obtiene la lista de empresas donde el usuario autenticado es usuario contacto',
  })
  @ApiResponse({
    status: 200,
    description: 'Clientes obtenidos exitosamente',
  })
  async findMyClients(@Req() req: any) {
    const userId = req.user.userId;
    const clients = await this.clientService.findByUsuarioContacto(userId);
    return {
      message: 'Clientes obtenidos exitosamente',
      data: clients,
    };
  }

  @Get(':id')
  @Roles('Administrador', 'Secretaria', 'Técnico')
  @ApiOperation({
    summary: 'Obtener cliente por ID',
    description: 'Obtiene un cliente específico por su ID',
  })
  @ApiResponse({ status: 200, description: 'Cliente obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const client = await this.clientService.findOne(id);
    return {
      message: 'Cliente obtenido exitosamente',
      data: client,
    };
  }

  @Get('nit/:nit')
  @Roles('Administrador', 'Secretaria', 'Técnico')
  @ApiOperation({
    summary: 'Obtener cliente por NIT',
    description: 'Obtiene un cliente por su NIT',
  })
  @ApiResponse({ status: 200, description: 'Cliente obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async findByNit(@Param('nit') nit: string) {
    const client = await this.clientService.findByNit(nit);
    if (!client) {
      return {
        message: 'Cliente no encontrado',
        data: null,
      };
    }
    return {
      message: 'Cliente obtenido exitosamente',
      data: client,
    };
  }

  @Get('usuario-contacto/:usuarioId')
  @Roles('Administrador', 'Secretaria', 'Técnico')
  @ApiOperation({
    summary: 'Obtener clientes por usuario contacto',
    description:
      'Obtiene la lista de clientes donde el usuario es contacto',
  })
  @ApiResponse({ status: 200, description: 'Clientes obtenidos exitosamente' })
  async findByUsuarioContacto(
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
  ) {
    const clients = await this.clientService.findByUsuarioContacto(usuarioId);
    return {
      message: 'Clientes obtenidos exitosamente',
      data: clients,
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({
    summary: 'Actualizar cliente',
    description: 'Actualiza un cliente existente',
  })
  @ApiResponse({ status: 200, description: 'Cliente actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({ status: 409, description: 'El NIT o email ya existe' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    const client = await this.clientService.update(id, updateClientDto);
    return {
      message: 'Cliente actualizado exitosamente',
      data: client,
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Eliminar cliente',
    description: 'Elimina un cliente permanentemente',
  })
  @ApiResponse({ status: 200, description: 'Cliente eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.clientService.remove(id);
    return {
      message: 'Cliente eliminado exitosamente',
    };
  }
}