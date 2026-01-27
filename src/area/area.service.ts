// src/area/area.service.ts
import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Area } from './entities/area.entity';
import { Client } from '../client/entities/client.entity';
import { SubArea } from '../sub-area/entities/sub-area.entity';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@Injectable()
export class AreaService {
  private readonly logger = new Logger(AreaService.name);

  constructor(
    @InjectRepository(Area)
    private areaRepository: Repository<Area>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    @InjectRepository(SubArea)
    private subAreaRepository: Repository<SubArea>,
  ) {}

  async create(createAreaDto: CreateAreaDto): Promise<Area> {
    const client = await this.clientRepository.findOne({
      where: { idCliente: createAreaDto.clienteId },
    });
    
    if (!client) {
      throw new NotFoundException(`Cliente con ID ${createAreaDto.clienteId} no encontrado`);
    }

    const existingArea = await this.areaRepository.findOne({
      where: {
        nombreArea: createAreaDto.nombreArea,
        clienteId: createAreaDto.clienteId,
      },
    });
    
    if (existingArea) {
      throw new ConflictException('Ya existe un área con este nombre para este cliente');
    }

    const area = this.areaRepository.create({
      ...createAreaDto,
      cliente: client,
    });

    const savedArea = await this.areaRepository.save(area);
    
    this.logger.log(`Área creada: ${savedArea.idArea} - ${savedArea.nombreArea}`);
    return savedArea;
  }

  async findAll(): Promise<Area[]> {
    return await this.areaRepository.find({
      relations: ['cliente', 'subAreas'],
      order: { nombreArea: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Area> {
    const area = await this.areaRepository.findOne({
      where: { idArea: id },
      relations: ['cliente', 'subAreas'],
    });
    
    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }
    
    return area;
  }

  async findByClientId(clientId: number): Promise<Area[]> {
    return await this.areaRepository.find({
      where: { clienteId: clientId },
      relations: ['cliente', 'subAreas'],
      order: { nombreArea: 'ASC' },
    });
  }

  async update(id: number, updateAreaDto: UpdateAreaDto): Promise<Area> {
    const area = await this.findOne(id);
    
    if (updateAreaDto.clienteId && updateAreaDto.clienteId !== area.clienteId) {
      const client = await this.clientRepository.findOne({
        where: { idCliente: updateAreaDto.clienteId },
      });
      
      if (!client) {
        throw new NotFoundException(`Cliente con ID ${updateAreaDto.clienteId} no encontrado`);
      }
      area.cliente = client;
    }
    
    if (updateAreaDto.nombreArea && updateAreaDto.nombreArea !== area.nombreArea) {
      const clientId = updateAreaDto.clienteId || area.clienteId;
      const existingArea = await this.areaRepository.findOne({
        where: {
          nombreArea: updateAreaDto.nombreArea,
          clienteId: clientId,
        },
      });
      
      if (existingArea && existingArea.idArea !== id) {
        throw new ConflictException('Ya existe un área con este nombre para este cliente');
      }
    }
    
    Object.assign(area, updateAreaDto);
    return await this.areaRepository.save(area);
  }

  async remove(id: number): Promise<void> {
    const area = await this.findOne(id);
    await this.areaRepository.remove(area);
    this.logger.log(`Área eliminada: ${id}`);
  }

  async getAreaWithSubAreas(id: number): Promise<Area> {
    const area = await this.areaRepository.findOne({
      where: { idArea: id },
      relations: ['cliente', 'subAreas'],
    });
    
    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }
    
    return area;
  }

  async countSubAreas(areaId: number): Promise<number> {
    return await this.subAreaRepository.count({
      where: { areaId: areaId },
    });
  }
}