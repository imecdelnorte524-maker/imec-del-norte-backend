// src/supplies/supplies.controller.ts
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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SuppliesService } from './supplies.service';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import { SupplyResponseDto } from './dto/supply-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Supply } from './entities/supply.entity';
import { SupplyCategory, SupplyStatus } from '../shared/index';

@ApiTags('supplies')
@Controller('supplies')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Post()
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({ summary: 'Crear insumo' })
  @ApiResponse({
    status: 201,
    description: 'Insumo creado exitosamente',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un insumo con este nombre',
  })
  async create(@Body() createSupplyDto: CreateSupplyDto) {
    const supply = await this.suppliesService.create(createSupplyDto);
    return {
      message: 'Insumo creado exitosamente',
      data: this.mapToResponseDto(supply),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Obtener insumos' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoria', required: false })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'low-stock', required: false, type: Boolean })
  @ApiQuery({ name: 'stats', required: false, type: Boolean })
  @ApiQuery({ name: 'deleted', required: false, type: Boolean })
  async findAll(
    @Query('search') search?: string,
    @Query('categoria') categoria?: string,
    @Query('estado') estado?: string,
    @Query('low-stock', new ParseBoolPipe({ optional: true }))
    lowStock?: boolean,
    @Query('stats', new ParseBoolPipe({ optional: true })) stats?: boolean,
    @Query('deleted', new ParseBoolPipe({ optional: true }))
    deleted?: boolean,
  ) {
    if (stats) {
      const data = await this.suppliesService.getSuppliesStats();
      return {
        message: 'Estadísticas obtenidas',
        data,
      };
    }

    let data: Supply[];
    if (deleted) {
      data = await this.suppliesService.getDeleted();
    } else if (lowStock) {
      data = await this.suppliesService.getLowStockSupplies();
    } else if (search) {
      data = await this.suppliesService.searchSupplies(search);
    } else if (categoria) {
      const categoriaEnum = categoria as SupplyCategory;
      data = await this.suppliesService.getSuppliesByCategory(categoriaEnum);
    } else if (estado) {
      const estadoEnum = estado as SupplyStatus;
      data = await this.suppliesService.getSuppliesByStatus(estadoEnum);
    } else {
      data = await this.suppliesService.findAll();
    }

    return {
      message: 'Insumos obtenidos',
      data: data.map((s) => this.mapToResponseDto(s)),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener insumo por ID' })
  @ApiResponse({
    status: 200,
    description: 'Insumo obtenido exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Insumo no encontrado',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const supply = await this.suppliesService.findOne(id);
    return {
      message: 'Insumo obtenido exitosamente',
      data: this.mapToResponseDto(supply),
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({ summary: 'Actualizar insumo' })
  @ApiResponse({
    status: 200,
    description: 'Insumo actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Insumo no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un insumo con este nombre',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplyDto,
  ) {
    const supply = await this.suppliesService.update(id, dto);
    return {
      message: 'Insumo actualizado exitosamente',
      data: this.mapToResponseDto(supply),
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Eliminar insumo (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Insumo eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Insumo no encontrado',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.suppliesService.remove(id);
    return { message: 'Insumo eliminado exitosamente' };
  }

  @Patch(':id/restore')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Restaurar insumo eliminado' })
  @ApiResponse({
    status: 200,
    description: 'Insumo restaurado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Insumo no encontrado',
  })
  async restore(@Param('id', ParseIntPipe) id: number) {
    const supply = await this.suppliesService.restore(id);
    return {
      message: 'Insumo restaurado exitosamente',
      data: this.mapToResponseDto(supply),
    };
  }

  @Patch(':id/stock')
  @Roles('Administrador', 'Técnico', 'Secretaria')
  @ApiOperation({ summary: 'Actualizar stock de insumo' })
  @ApiResponse({
    status: 200,
    description: 'Stock actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Insumo no encontrado',
  })
  async updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('cantidad') cantidad: number,
  ) {
    const supply = await this.suppliesService.updateStock(id, cantidad);
    return {
      message: 'Stock actualizado exitosamente',
      data: this.mapToResponseDto(supply),
    };
  }

  @Post(':id/increment')
  @Roles('Administrador', 'Técnico', 'Secretaria')
  @ApiOperation({ summary: 'Incrementar stock de insumo' })
  async incrementStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('cantidad') cantidad: number,
  ) {
    const supply = await this.suppliesService.incrementStock(id, cantidad);
    return {
      message: 'Stock incrementado exitosamente',
      data: this.mapToResponseDto(supply),
    };
  }

  @Post(':id/decrement')
  @Roles('Administrador', 'Técnico', 'Secretaria')
  @ApiOperation({ summary: 'Decrementar stock de insumo' })
  async decrementStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('cantidad') cantidad: number,
  ) {
    const supply = await this.suppliesService.decrementStock(id, cantidad);
    return {
      message: 'Stock decrementado exitosamente',
      data: this.mapToResponseDto(supply),
    };
  }

  private mapToResponseDto(supply: Supply): SupplyResponseDto {
    const inventory = supply.inventories?.[0];

    const response: SupplyResponseDto = {
      insumoId: supply.insumoId,
      nombre: supply.nombre,
      categoria: supply.categoria,
      unidadMedida: supply.unidadMedida ? supply.unidadMedida.nombre : '',
      stock: inventory?.cantidadActual ?? 0,
      estado: supply.estado,
      fechaRegistro: supply.fechaRegistro,
      stockMin: supply.stockMin,
      valorUnitario: supply.valorUnitario,
      cantidadActual: inventory?.cantidadActual ?? 0,
      inventarioId: inventory?.inventarioId,
    };

    if (inventory?.bodega) {
      response.bodega = {
        bodegaId: inventory.bodega.bodegaId,
        nombre: inventory.bodega.nombre,
      };
    }

    if (supply.images && supply.images.length > 0) {
      response.imagenes = supply.images.map((img) => img.url);
    }

    return response;
  }
}
