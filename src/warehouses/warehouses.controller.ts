// src/warehouses/warehouses.controller.ts
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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('warehouses')
@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
   
  @ApiOperation({ summary: 'Crear una nueva bodega' })
  @ApiResponse({
    status: 201,
    description: 'Bodega creada exitosamente',
  })
  @ApiResponse({ status: 409, description: 'El nombre de bodega ya existe' })
  async create(@Body() createWarehouseDto: CreateWarehouseDto) {
    const warehouse = await this.warehousesService.create(createWarehouseDto);
    return {
      message: 'Bodega creada exitosamente',
      data: warehouse,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las bodegas' })
  @ApiQuery({
    name: 'inactive',
    required: false,
    type: Boolean,
    description: 'Incluir bodegas inactivas',
  })
  @ApiQuery({
    name: 'stats',
    required: false,
    type: Boolean,
    description: 'Incluir estadísticas de inventario',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de bodegas obtenida exitosamente',
  })
  async findAll(
    @Query('inactive') inactive?: boolean,
    @Query('stats') stats?: boolean,
  ) {
    if (stats) {
      const data = await this.warehousesService.findAllWithStats();
      return {
        message: 'Bodegas con estadísticas obtenidas',
        data,
      };
    }

    const data = await this.warehousesService.findAll(inactive === true);
    return {
      message: 'Bodegas obtenidas exitosamente',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una bodega por ID' })
  @ApiResponse({
    status: 200,
    description: 'Bodega obtenida exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Bodega no encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const warehouse = await this.warehousesService.findOne(id);
    return {
      message: 'Bodega obtenida exitosamente',
      data: warehouse,
    };
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Obtener estadísticas de inventario de una bodega' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  async getStats(@Param('id', ParseIntPipe) id: number) {
    const stats = await this.warehousesService.getStats(id);
    return {
      message: 'Estadísticas de bodega obtenidas',
      data: stats,
    };
  }

  @Patch(':id')
   
  @ApiOperation({ summary: 'Actualizar una bodega' })
  @ApiResponse({
    status: 200,
    description: 'Bodega actualizada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Bodega no encontrada' })
  @ApiResponse({ status: 409, description: 'El nombre de bodega ya existe' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
  ) {
    const warehouse = await this.warehousesService.update(
      id,
      updateWarehouseDto,
    );
    return {
      message: 'Bodega actualizada exitosamente',
      data: warehouse,
    };
  }

  @Delete(':id')
   
  @ApiOperation({ summary: 'Eliminar una bodega (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Bodega eliminada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Bodega no encontrada' })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar porque tiene inventario asociado',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.warehousesService.remove(id);
    return result;
  }

  @Get('cliente/:clienteId')
  @ApiOperation({ summary: 'Obtener bodegas por cliente' })
  @ApiQuery({
    name: 'inactive',
    required: false,
    type: Boolean,
    description: 'Incluir bodegas inactivas',
  })
  @ApiResponse({
    status: 200,
    description: 'Bodegas del cliente obtenidas exitosamente',
  })
  async findByClienteId(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Query('inactive') inactive?: boolean,
  ) {
    const data = await this.warehousesService.findByClienteId(
      clienteId,
      inactive === true,
    );
    return {
      message: 'Bodegas del cliente obtenidas exitosamente',
      data,
    };
  }

  @Get('sin-cliente')
  @ApiOperation({ summary: 'Obtener bodegas sin cliente asignado' })
  @ApiQuery({
    name: 'inactive',
    required: false,
    type: Boolean,
    description: 'Incluir bodegas inactivas',
  })
  @ApiResponse({
    status: 200,
    description: 'Bodegas sin cliente obtenidas exitosamente',
  })
  async findWithoutCliente(@Query('inactive') inactive?: boolean) {
    const data = await this.warehousesService.findWithoutCliente(
      inactive === true,
    );
    return {
      message: 'Bodegas sin cliente obtenidas exitosamente',
      data,
    };
  }
}
