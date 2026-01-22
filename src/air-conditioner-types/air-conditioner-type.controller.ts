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
import { AirConditionerTypesService } from './air-conditioner-type.service';
import { CreateAirConditionerTypeDto } from './dto/create-air-conditioner-type.dto';
import { UpdateAirConditionerTypeDto } from './dto/update-air-conditioner-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('air-conditioner-types')
@Controller('air-conditioner-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AirConditionerTypesController {
  constructor(
    private readonly airConditionerTypesService: AirConditionerTypesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear tipo de aire acondicionado' })
  @ApiResponse({ status: 201, description: 'Tipo creado exitosamente' })
  async create(@Body() createDto: CreateAirConditionerTypeDto) {
    const type = await this.airConditionerTypesService.create(createDto);
    return { message: 'Tipo creado exitosamente', data: type };
  }

  @Get()
  @ApiOperation({ summary: 'Listar tipos de aires' })
  async findAll() {
    const types = await this.airConditionerTypesService.findAll();
    return { message: 'Tipos obtenidos exitosamente', data: types };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener tipo por ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const type = await this.airConditionerTypesService.findOne(id);
    return { message: 'Tipo obtenido exitosamente', data: type };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar tipo de aire' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAirConditionerTypeDto,
  ) {
    const type = await this.airConditionerTypesService.update(id, updateDto);
    return { message: 'Tipo actualizado exitosamente', data: type };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar tipo de aire' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.airConditionerTypesService.remove(id);
    return { message: 'Tipo eliminado exitosamente' };
  }
}