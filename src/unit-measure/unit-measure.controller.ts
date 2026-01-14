// src/unit-measure/unit-measure.controller.ts
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
import { UnitMeasureService } from './unit-measure.service';
import { CreateUnitMeasureDto } from './dto/create-unit-measure.dto';
import { UpdateUnitMeasureDto } from './dto/update-unit-measure.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('unit-measure')
@Controller('unit-measure')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UnitMeasureController {
  constructor(private readonly unitMeasureService: UnitMeasureService) {}

  @Post()
  @Roles('Administrador', 'Técnico')
  @ApiOperation({ summary: 'Crear una nueva unidad de medida' })
  @ApiResponse({
    status: 201,
    description: 'Unidad de medida creada exitosamente',
  })
  @ApiResponse({ status: 409, description: 'El nombre ya existe' })
  async create(@Body() createUnitMeasureDto: CreateUnitMeasureDto) {
    const unitMeasure = await this.unitMeasureService.create(createUnitMeasureDto);
    return {
      message: 'Unidad de medida creada exitosamente',
      data: unitMeasure,
    };
  }

  @Post('find-or-create')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Buscar o crear unidad de medida (para autocompletado)',
  })
  @ApiResponse({
    status: 200,
    description: 'Unidad de medida encontrada o creada',
  })
  async findOrCreate(@Body() createUnitMeasureDto: CreateUnitMeasureDto) {
    const unitMeasure = await this.unitMeasureService.createOrFind(
      createUnitMeasureDto,
    );
    return {
      message: 'Unidad de medida procesada exitosamente',
      data: unitMeasure,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las unidades de medida' })
  @ApiQuery({
    name: 'inactive',
    required: false,
    type: Boolean,
    description: 'Incluir unidades inactivas',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de unidades obtenida exitosamente',
  })
  async findAll(@Query('inactive') inactive?: boolean) {
    const data = await this.unitMeasureService.findAll(inactive === true);
    return {
      message: 'Unidades de medida obtenidas exitosamente',
      data,
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar unidades de medida por nombre' })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Término de búsqueda',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultados de búsqueda obtenidos',
  })
  async search(@Query('q') keyword: string) {
    const data = await this.unitMeasureService.search(keyword);
    return {
      message: 'Resultados de búsqueda obtenidos',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una unidad de medida por ID' })
  @ApiResponse({
    status: 200,
    description: 'Unidad de medida obtenida exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Unidad de medida no encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const unitMeasure = await this.unitMeasureService.findOne(id);
    return {
      message: 'Unidad de medida obtenida exitosamente',
      data: unitMeasure,
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({ summary: 'Actualizar una unidad de medida' })
  @ApiResponse({
    status: 200,
    description: 'Unidad de medida actualizada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Unidad de medida no encontrada' })
  @ApiResponse({ status: 409, description: 'El nombre ya existe' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUnitMeasureDto: UpdateUnitMeasureDto,
  ) {
    const unitMeasure = await this.unitMeasureService.update(
      id,
      updateUnitMeasureDto,
    );
    return {
      message: 'Unidad de medida actualizada exitosamente',
      data: unitMeasure,
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Eliminar una unidad de medida' })
  @ApiResponse({
    status: 200,
    description: 'Unidad de medida eliminada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Unidad de medida no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'No se puede eliminar porque está en uso por insumos',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.unitMeasureService.remove(id);
    return result;
  }
}