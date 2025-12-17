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
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryResponseDto } from './dto/inventory-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Inventory } from './entities/inventory.entity';

@ApiTags('inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  @Post()
  @Roles('Administrador', 'Técnico', 'Secretaria')
  @ApiOperation({
    summary: 'Crear registro de inventario',
    description: 'Crea un nuevo registro de inventario para insumo o herramienta'
  })
  @ApiResponse({ status: 201, description: 'Registro de inventario creado exitosamente' })
  @ApiResponse({ status: 409, description: 'Ya existe un registro para este item en esta ubicación' })
  async create(@Body() createInventoryDto: CreateInventoryDto) {
    const inventory = await this.inventoryService.create(createInventoryDto);
    return {
      message: 'Registro de inventario creado exitosamente',
      data: this.mapToResponseDto(inventory),
    };
  }

  @Get()
  @Roles('Administrador', 'Técnico', 'Secretaria')
  @ApiOperation({
    summary: 'Obtener todo el inventario',
    description: 'Obtiene la lista de todos los registros de inventario'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar en inventario por nombre de item o ubicación'
  })
  @ApiQuery({
    name: 'ubicacion',
    required: false,
    description: 'Filtrar por ubicación'
  })
  @ApiQuery({
    name: 'low-stock',
    required: false,
    description: 'Obtener items con stock bajo',
    type: Boolean
  })
  @ApiQuery({
    name: 'stats',
    required: false,
    description: 'Obtener estadísticas del inventario',
    type: Boolean
  })
  @ApiResponse({ status: 200, description: 'Inventario obtenido exitosamente' })
  async findAll(
    @Query('search') search?: string,
    @Query('ubicacion') ubicacion?: string,
    @Query('low-stock') lowStock?: boolean,
    @Query('stats') stats?: boolean,
  ) {
    let data;

    if (stats) {
      data = await this.inventoryService.getInventoryStats();
      return {
        message: 'Estadísticas del inventario obtenidas exitosamente',
        data,
      };
    }

    if (lowStock) {
      data = await this.inventoryService.getLowStockItems();
    } else if (search) {
      data = await this.inventoryService.searchInventory(search);
    } else if (ubicacion) {
      data = await this.inventoryService.getInventoryByLocation(ubicacion);
    } else {
      data = await this.inventoryService.findAll();
    }

    return {
      message: 'Inventario obtenido exitosamente',
      data: data.map(inventory => this.mapToResponseDto(inventory)),
    };
  }

  @Get(':id')
  @Roles('Administrador', 'Técnico', 'Secretaria')
  @ApiOperation({
    summary: 'Obtener registro de inventario por ID',
    description: 'Obtiene un registro específico de inventario por su ID'
  })
  @ApiResponse({ status: 200, description: 'Registro de inventario obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Registro de inventario no encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const inventory = await this.inventoryService.findOne(id);
    return {
      message: 'Registro de inventario obtenido exitosamente',
      data: this.mapToResponseDto(inventory),
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Técnico', 'Secretaria')
  @ApiOperation({
    summary: 'Actualizar registro de inventario',
    description: 'Actualiza un registro existente de inventario'
  })
  @ApiResponse({ status: 200, description: 'Registro de inventario actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Registro de inventario no encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInventoryDto: UpdateInventoryDto,
  ) {
    const inventory = await this.inventoryService.update(id, updateInventoryDto);
    return {
      message: 'Registro de inventario actualizado exitosamente',
      data: this.mapToResponseDto(inventory),
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Eliminar registro de inventario',
    description: 'Elimina un registro de inventario permanentemente'
  })
  @ApiResponse({ status: 200, description: 'Registro de inventario eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Registro de inventario no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.inventoryService.remove(id);
    return {
      message: 'Registro de inventario eliminado exitosamente',
    };
  }

  @Delete('complete/:id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Eliminar registro de inventario y item asociado',
    description: 'Elimina un registro de inventario y el herramienta/insumo asociado permanentemente'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Registro de inventario y item asociado eliminados exitosamente' 
  })
  @ApiResponse({ status: 404, description: 'Registro de inventario no encontrado' })
  async removeComplete(@Param('id', ParseIntPipe) id: number) {
    const result = await this.inventoryService.removeComplete(id);
    
    let message = 'Registro de inventario eliminado exitosamente';
    if (result.deletedItem) {
      message += ` y ${result.deletedItem.tipo === 'insumo' ? 'insumo' : 'herramienta'} asociado`;
    }
    
    return {
      message,
      deleted: result
    };
  }

  @Patch(':id/stock')
  @Roles('Administrador', 'Técnico', 'Secretaria')
  @ApiOperation({
    summary: 'Actualizar stock',
    description: 'Actualiza la cantidad de stock de un insumo en inventario'
  })
  @ApiResponse({ status: 200, description: 'Stock actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Registro de inventario no encontrado' })
  async updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('cantidad') cantidad: number,
  ) {
    const inventory = await this.inventoryService.updateStock(id, cantidad);
    return {
      message: 'Stock actualizado exitosamente',
      data: this.mapToResponseDto(inventory),
    };
  }

  private mapToResponseDto(inventory: Inventory): InventoryResponseDto {
    const response: InventoryResponseDto = {
      inventarioId: inventory.inventarioId,
      cantidadActual: inventory.cantidadActual,
      ubicacion: inventory.ubicacion,
      fechaUltimaActualizacion: inventory.fechaUltimaActualizacion,
      tipo: inventory.insumoId ? 'insumo' : 'herramienta',
      nombreItem: inventory.nombreItem,
    };

    if (inventory.supply) {
      response.supply = {
        insumoId: inventory.supply.insumoId,
        nombre: inventory.supply.nombre,
        categoria: inventory.supply.categoria,
        unidadMedida: inventory.supply.unidadMedida,
        fotoUrl: inventory.supply.fotoUrl,
        stockMin: inventory.supply.stockMin,
        estado: inventory.supply.estado,
        valorUnitario: inventory.supply.valorUnitario,
      };
    }

    if (inventory.tool) {
      response.tool = {
        herramientaId: inventory.tool.herramientaId,
        nombre: inventory.tool.nombre,
        marca: inventory.tool.marca,
        serial: inventory.tool.serial,
        modelo: inventory.tool.modelo,
        fotoUrl: inventory.tool.fotoUrl,
        estado: inventory.tool.estado,
        valorUnitario: inventory.tool.valorUnitario,
      };
    }

    return response;
  }
}