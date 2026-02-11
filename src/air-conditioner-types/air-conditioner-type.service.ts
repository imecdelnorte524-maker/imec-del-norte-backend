import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AirConditionerType } from './entities/air-conditioner-type.entity';
import { CreateAirConditionerTypeDto } from './dto/create-air-conditioner-type.dto';
import { UpdateAirConditionerTypeDto } from './dto/update-air-conditioner-type.dto';
import { WebsocketGateway } from '../websockets/websocket.gateway'; // <-- NUEVO

@Injectable()
export class AirConditionerTypesService {
  constructor(
    @InjectRepository(AirConditionerType)
    private readonly acTypeRepository: Repository<AirConditionerType>,
    private readonly websocketGateway: WebsocketGateway,              // <-- NUEVO
  ) {}

  async create(
    createDto: CreateAirConditionerTypeDto,
  ): Promise<AirConditionerType> {
    const existing = await this.acTypeRepository.findOne({
      where: { name: createDto.name },
    });
    if (existing) {
      throw new ConflictException('El nombre del tipo ya existe');
    }
    const acType = this.acTypeRepository.create(createDto);
    const saved = await this.acTypeRepository.save(acType);

    // Emitir evento de creación
    this.websocketGateway.emit('airConditionerTypes.created', saved);

    return saved;
  }

  async findAll(): Promise<AirConditionerType[]> {
    return await this.acTypeRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<AirConditionerType> {
    const acType = await this.acTypeRepository.findOne({ where: { id } });
    if (!acType) {
      throw new NotFoundException(`Tipo de aire con ID ${id} no encontrado`);
    }
    return acType;
  }

  async update(
    id: number,
    updateDto: UpdateAirConditionerTypeDto,
  ): Promise<AirConditionerType> {
    const acType = await this.findOne(id);

    if (updateDto.name && updateDto.name !== acType.name) {
      const existing = await this.acTypeRepository.findOne({
        where: { name: updateDto.name },
      });
      if (existing) {
        throw new ConflictException('El nombre del tipo ya existe');
      }
    }

    Object.assign(acType, updateDto);
    const updated = await this.acTypeRepository.save(acType);

    // Emitir evento de actualización
    this.websocketGateway.emit('airConditionerTypes.updated', updated);

    return updated;
  }

  async remove(id: number): Promise<void> {
    const acType = await this.findOne(id);
    await this.acTypeRepository.remove(acType);

    // Emitir evento de eliminación (enviamos solo el id)
    this.websocketGateway.emit('airConditionerTypes.deleted', { id });
  }
}