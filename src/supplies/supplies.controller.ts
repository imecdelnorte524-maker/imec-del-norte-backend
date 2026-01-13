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

@ApiTags('supplies')
@Controller('supplies')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Post()
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({ summary: 'Crear insumo' })
  async create(@Body() createSupplyDto: CreateSupplyDto) {
    const supply = await this.suppliesService.create(createSupplyDto);
    return {
      message: 'Insumo creado exitosamente',
      data: this.mapToResponseDto(supply),
    };
  }

  @Get()
  @Roles('Administrador', 'Técnico', 'Secretaria')
  @ApiOperation({ summary: 'Obtener insumos' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoria', required: false })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'low-stock', required: false, type: Boolean })
  @ApiQuery({ name: 'stats', required: false, type: Boolean })
  async findAll(
    @Query('search') search?: string,
    @Query('categoria') categoria?: string,
    @Query('estado') estado?: string,
    @Query('low-stock') lowStock?: boolean,
    @Query('stats') stats?: boolean,
  ) {
    if (stats) {
      return {
        message: 'Estadísticas obtenidas',
        data: await this.suppliesService.getSuppliesStats(),
      };
    }

    const data = lowStock
      ? await this.suppliesService.getLowStockSupplies()
      : search
      ? await this.suppliesService.searchSupplies(search)
      : categoria
      ? await this.suppliesService.getSuppliesByCategory(categoria)
      : estado
      ? await this.suppliesService.getSuppliesByStatus(estado)
      : await this.suppliesService.findAll();

    return {
      message: 'Insumos obtenidos',
      data: data.map(s => this.mapToResponseDto(s)),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const supply = await this.suppliesService.findOne(id);
    return {
      message: 'Insumo obtenido',
      data: this.mapToResponseDto(supply),
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Secretaria')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplyDto,
  ) {
    const supply = await this.suppliesService.update(id, dto);
    return {
      message: 'Insumo actualizado',
      data: this.mapToResponseDto(supply),
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.suppliesService.remove(id);
    return { message: 'Insumo eliminado' };
  }

  private mapToResponseDto(supply: Supply): SupplyResponseDto {
    return {
      insumoId: supply.insumoId,
      nombre: supply.nombre,
      categoria: supply.categoria,
      unidadMedida: supply.unidadMedida,
      stock: supply.inventory?.cantidadActual ?? 0,
      estado: supply.estado,
      fechaRegistro: supply.fechaRegistro,
      stockMin: supply.stockMin,
      valorUnitario: supply.valorUnitario,
      ubicacion: supply.inventory?.ubicacion ?? '',
      cantidadActual: supply.inventory?.cantidadActual ?? 0,
      inventarioId: supply.inventory?.inventarioId,
    };
  }
}