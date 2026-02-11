// src/unit-measure/unit-measure.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnitMeasure } from './entities/unit-measure.entity';
import { CreateUnitMeasureDto } from './dto/create-unit-measure.dto';
import { UpdateUnitMeasureDto } from './dto/update-unit-measure.dto';
import { WebsocketGateway } from '../websockets/websocket.gateway';

@Injectable()
export class UnitMeasureService {
  constructor(
    @InjectRepository(UnitMeasure)
    private unitMeasureRepo: Repository<UnitMeasure>,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async createOrFind(
    createUnitMeasureDto: CreateUnitMeasureDto,
  ): Promise<UnitMeasure> {
    // Buscar si ya existe (insensible a mayúsculas/minúsculas)
    const existingUnit = await this.unitMeasureRepo
      .createQueryBuilder('unit')
      .where('LOWER(unit.nombre) = LOWER(:nombre)', {
        nombre: createUnitMeasureDto.nombre,
      })
      .getOne();

    if (existingUnit) {
      return existingUnit;
    }

    const unitMeasure = this.unitMeasureRepo.create(createUnitMeasureDto);
    const saved = await this.unitMeasureRepo.save(unitMeasure);

    // 🔴 WebSocket (solo cuando se crea realmente)
    this.websocketGateway.emit('unitMeasures.created', saved);

    return saved;
  }

  async create(
    createUnitMeasureDto: CreateUnitMeasureDto,
  ): Promise<UnitMeasure> {
    // Verificar si ya existe (para creación estricta)
    const existingUnit = await this.unitMeasureRepo.findOne({
      where: { nombre: createUnitMeasureDto.nombre },
    });

    if (existingUnit) {
      throw new ConflictException(
        `Ya existe una unidad de medida con el nombre "${createUnitMeasureDto.nombre}"`,
      );
    }

    const unitMeasure = this.unitMeasureRepo.create(createUnitMeasureDto);
    const saved = await this.unitMeasureRepo.save(unitMeasure);

    // 🔴 WebSocket
    this.websocketGateway.emit('unitMeasures.created', saved);

    return saved;
  }

  async findAll(includeInactive = false): Promise<UnitMeasure[]> {
    const where = includeInactive ? {} : { activa: true };
    return await this.unitMeasureRepo.find({
      where,
      order: { nombre: 'ASC' },
      relations: ['supplies'],
    });
  }

  async findOne(id: number): Promise<UnitMeasure> {
    const unitMeasure = await this.unitMeasureRepo.findOne({
      where: { unidadMedidaId: id },
      relations: ['supplies'],
    });

    if (!unitMeasure) {
      throw new NotFoundException(
        `Unidad de medida con ID ${id} no encontrada`,
      );
    }

    return unitMeasure;
  }

  async findByName(nombre: string): Promise<UnitMeasure | null> {
    return await this.unitMeasureRepo.findOne({
      where: { nombre },
    });
  }

  async update(
    id: number,
    updateUnitMeasureDto: UpdateUnitMeasureDto,
  ): Promise<UnitMeasure> {
    const unitMeasure = await this.findOne(id);

    // Si se intenta cambiar el nombre, verificar que no exista otro con ese nombre
    if (
      updateUnitMeasureDto.nombre &&
      updateUnitMeasureDto.nombre !== unitMeasure.nombre
    ) {
      const existingWithName = await this.unitMeasureRepo.findOne({
        where: { nombre: updateUnitMeasureDto.nombre },
      });

      if (existingWithName && existingWithName.unidadMedidaId !== id) {
        throw new ConflictException(
          `Ya existe una unidad de medida con el nombre "${updateUnitMeasureDto.nombre}"`,
        );
      }
    }

    Object.assign(unitMeasure, updateUnitMeasureDto);
    const updated = await this.unitMeasureRepo.save(unitMeasure);

    // 🔴 WebSocket
    this.websocketGateway.emit('unitMeasures.updated', updated);

    return updated;
  }

  async remove(id: number): Promise<{ message: string }> {
    const unitMeasure = await this.findOne(id);

    // Verificar si la unidad tiene insumos asociados
    if (unitMeasure.supplies && unitMeasure.supplies.length > 0) {
      throw new ConflictException(
        'No se puede eliminar la unidad de medida porque está siendo utilizada por uno o más insumos.',
      );
    }

    await this.unitMeasureRepo.softDelete(id);

    // 🔴 WebSocket
    this.websocketGateway.emit('unitMeasures.deleted', { id });

    return { message: 'Unidad de medida eliminada exitosamente' };
  }

  async search(keyword: string): Promise<UnitMeasure[]> {
    return await this.unitMeasureRepo
      .createQueryBuilder('unit')
      .where('unit.nombre ILIKE :keyword OR unit.abreviatura ILIKE :keyword', {
        keyword: `%${keyword}%`,
      })
      .orderBy('unit.nombre', 'ASC')
      .getMany();
  }
}
