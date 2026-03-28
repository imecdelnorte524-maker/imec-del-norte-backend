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
  ParseBoolPipe,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryResponseDto } from './dto/inventory-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Inventory } from './entities/inventory.entity';
import { Response } from 'express';

@ApiTags('inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('export')
  @ApiOperation({
    summary: 'Exportar inventario a Excel',
    description:
      'Exporta la lista de inventario a un archivo Excel con filtros opcionales',
  })
  @ApiQuery({
    name: 'bodegaId',
    required: false,
    description:
      'ID de la bodega para filtrar (opcional - si no se envía, exporta todo)',
    type: Number,
  })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    description: 'Incluir registros eliminados (opcional - por defecto false)',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'Archivo Excel generado exitosamente',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async exportInventory(
    @Res() res: Response,
    @Query('bodegaId') bodegaId?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const parsedBodegaId =
      bodegaId && bodegaId !== '' ? Number(bodegaId) : undefined;
    const parsedIncludeDeleted = includeDeleted === 'true';

    const buffer = await this.inventoryService.generateInventoryExcel(
      parsedBodegaId,
      parsedIncludeDeleted,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="inventario.xlsx"',
    );
    res.send(buffer);
  }

  @Post()
   
  @ApiOperation({
    summary: 'Crear registro de inventario',
    description:
      'Crea un nuevo registro de inventario para insumo o herramienta',
  })
  @ApiResponse({
    status: 201,
    description: 'Registro de inventario creado exitosamente',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un registro para este item en esta bodega',
  })
  async create(@Body() createInventoryDto: CreateInventoryDto) {
    const inventory = await this.inventoryService.create(createInventoryDto);
    return {
      message: 'Registro de inventario creado exitosamente',
      data: this.mapToResponseDto(inventory),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todo el inventario',
    description: 'Obtiene la lista de todos los registros de inventario',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar en inventario por nombre de item o bodega',
  })
  @ApiQuery({
    name: 'bodega',
    required: false,
    description: 'Filtrar por ID de bodega',
    type: Number,
  })
  @ApiQuery({
    name: 'low-stock',
    required: false,
    description: 'Obtener items con stock bajo',
    type: Boolean,
  })
  @ApiQuery({
    name: 'stats',
    required: false,
    description: 'Obtener estadísticas del inventario',
    type: Boolean,
  })
  @ApiQuery({
    name: 'deleted',
    required: false,
    description: 'Incluir registros eliminados',
    type: Boolean,
  })
  @ApiQuery({
    name: 'tipo',
    required: false,
    description: 'Filtrar por tipo (insumo o herramienta)',
    enum: ['insumo', 'herramienta'],
  })
  @ApiResponse({
    status: 200,
    description: 'Inventario obtenido exitosamente',
  })
  async findAll(
    @Query('search') search?: string,
    @Query('bodega', new ParseIntPipe({ optional: true })) bodegaId?: number,
    @Query('low-stock', new ParseBoolPipe({ optional: true }))
    lowStock?: boolean,
    @Query('stats', new ParseBoolPipe({ optional: true })) stats?: boolean,
    @Query('deleted', new ParseBoolPipe({ optional: true })) deleted?: boolean,
    @Query('tipo') tipo?: 'insumo' | 'herramienta',
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
    } else if (bodegaId) {
      data = await this.inventoryService.getInventoryByBodega(bodegaId);
    } else if (deleted) {
      data = await this.inventoryService.getDeleted();
    } else {
      data = await this.inventoryService.findAll();
    }

    if (tipo && ['insumo', 'herramienta'].includes(tipo)) {
      data = data.filter((item: Inventory) => item.tipo === tipo);
    }

    return {
      message: 'Inventario obtenido exitosamente',
      data: data.map((inventory: Inventory) =>
        this.mapToResponseDto(inventory),
      ),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener registro de inventario por ID',
    description: 'Obtiene un registro específico de inventario por su ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Registro de inventario obtenido exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Registro de inventario no encontrado',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const inventory = await this.inventoryService.findOne(id);
    return {
      message: 'Registro de inventario obtenido exitosamente',
      data: this.mapToResponseDto(inventory),
    };
  }

  @Patch(':id')
   
  @ApiOperation({
    summary: 'Actualizar registro de inventario',
    description: 'Actualiza un registro existente de inventario',
  })
  @ApiResponse({
    status: 200,
    description: 'Registro de inventario actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Registro de inventario no encontrado',
  })
  @ApiResponse({
    status: 400,
    description: 'Campos no permitidos en la actualización',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInventoryDto: UpdateInventoryDto,
  ) {
    const inventory = await this.inventoryService.update(
      id,
      updateInventoryDto,
    );
    return {
      message: 'Registro de inventario actualizado exitosamente',
      data: this.mapToResponseDto(inventory),
    };
  }

  @Delete(':id')
   
  @ApiOperation({
    summary: 'Eliminar registro de inventario (soft delete)',
    description: 'Elimina un registro de inventario de forma lógica',
  })
  @ApiResponse({
    status: 200,
    description: 'Registro de inventario eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Registro de inventario no encontrado',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.inventoryService.remove(id);
    return {
      message: 'Registro de inventario eliminado exitosamente',
    };
  }

  @Delete('complete/:id')
   
  @ApiOperation({
    summary: 'Eliminar registro de inventario y item asociado',
    description:
      'Elimina un registro de inventario y la herramienta/insumo asociado permanentemente',
  })
  @ApiResponse({
    status: 200,
    description:
      'Registro de inventario y item asociado eliminados exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Registro de inventario no encontrado',
  })
  async removeComplete(@Param('id', ParseIntPipe) id: number) {
    const result = await this.inventoryService.removeComplete(id);

    let message = 'Registro de inventario eliminado exitosamente';
    if (result?.deletedItem) {
      message += ` y ${
        result.deletedItem.tipo === 'insumo' ? 'insumo' : 'herramienta'
      } asociado`;
    }

    return {
      message,
      deleted: result,
    };
  }

  @Patch(':id/restore')
   
  @ApiOperation({
    summary: 'Restaurar registro de inventario eliminado',
    description:
      'Restaura un registro de inventario que fue eliminado lógicamente',
  })
  @ApiResponse({
    status: 200,
    description: 'Registro de inventario restaurado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Registro de inventario no encontrado',
  })
  async restore(@Param('id', ParseIntPipe) id: number) {
    const inventory = await this.inventoryService.restore(id);
    return {
      message: 'Registro de inventario restaurado exitosamente',
      data: this.mapToResponseDto(inventory),
    };
  }

  @Patch(':id/stock')
   
  @ApiOperation({
    summary: 'Actualizar stock',
    description: 'Actualiza la cantidad de stock de un insumo en inventario',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Registro de inventario no encontrado',
  })
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
    let estado: string | undefined;

    if (inventory.insumoId && inventory.supply) {
      estado = this.inventoryService.getInventoryStatus(
        Number(inventory.cantidadActual),
        inventory.supply.stockMin,
      );
    }

    const response: InventoryResponseDto = {
      inventarioId: inventory.inventarioId,
      cantidadActual: Number(inventory.cantidadActual),
      ubicacion: inventory.ubicacion ?? undefined,
      fechaUltimaActualizacion: inventory.fechaUltimaActualizacion,
      tipo: inventory.tipo,
      nombreItem: inventory.nombreItem,
      unidadMedida: inventory.unidadMedida,
      valorUnitario: inventory.valorUnitario,
      estado,
    };

    if (inventory.bodega) {
      response.bodega = {
        bodegaId: inventory.bodega.bodegaId,
        nombre: inventory.bodega.nombre,
        descripcion: inventory.bodega.descripcion,
        direccion: inventory.bodega.direccion,
        activa: inventory.bodega.activa,
        clienteId: inventory.bodega.clienteId,
        clienteNombre: inventory.bodega.cliente?.nombre,
      };
    }

    if (inventory.supply) {
      response.supply = {
        insumoId: inventory.supply.insumoId,
        nombre: inventory.supply.nombre,
        categoria: inventory.supply.categoria,
        unidadMedida: inventory.supply.unidadMedida
          ? inventory.supply.unidadMedida.nombre
          : '',
        stockMin: inventory.supply.stockMin,
        estado: inventory.supply.estado,
        valorUnitario: inventory.supply.valorUnitario,
      };
    }

    if (inventory.tool) {
      // 👇 Aquí usamos el tipo para saber si es herramienta o equipo
      const tipoItem = inventory.tool.tipo || 'Herramienta';

      response.tool = {
        herramientaId: inventory.tool.herramientaId,
        nombre: inventory.tool.nombre,
        marca: inventory.tool.marca || '',
        serial: inventory.tool.serial || '',
        modelo: inventory.tool.modelo || '',
        estado: inventory.tool.estado,
        valorUnitario: inventory.tool.valorUnitario,
        caracteristicasTecnicas: inventory.tool.caracteristicasTecnicas || '',
        observacion: inventory.tool.observacion || '',
        tipo: tipoItem, // 👈 Agregar el tipo al response
      };
    }

    return response;
  }
}
