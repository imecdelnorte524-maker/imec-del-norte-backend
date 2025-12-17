// src/sub-area/sub-area.service.ts
import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubArea } from './entities/sub-area.entity';
import { Area } from '../area/entities/area.entity';
import { CreateSubAreaDto } from './dto/create-sub-area.dto';
import { UpdateSubAreaDto } from './dto/update-sub-area.dto';

@Injectable()
export class SubAreaService {
  private readonly logger = new Logger(SubAreaService.name);

  constructor(
    @InjectRepository(SubArea)
    private subAreaRepository: Repository<SubArea>,
    @InjectRepository(Area)
    private areaRepository: Repository<Area>,
  ) {}

  async create(createSubAreaDto: CreateSubAreaDto): Promise<SubArea> {
    const area = await this.areaRepository.findOne({
      where: { idArea: createSubAreaDto.areaId },
      relations: ['cliente', 'cliente.usuarioContacto'],
    });
    
    if (!area) {
      throw new NotFoundException(`Área con ID ${createSubAreaDto.areaId} no encontrada`);
    }

    const existingSubArea = await this.subAreaRepository.findOne({
      where: {
        nombreSubArea: createSubAreaDto.nombreSubArea,
        areaId: createSubAreaDto.areaId,
      },
    });
    
    if (existingSubArea) {
      throw new ConflictException('Ya existe una subárea con este nombre para esta área');
    }

    const subArea = this.subAreaRepository.create({
      ...createSubAreaDto,
      area: area,
    });

    const savedSubArea = await this.subAreaRepository.save(subArea);
    
    this.logger.log(`Subárea creada: ${savedSubArea.idSubArea} - ${savedSubArea.nombreSubArea}`);
    return savedSubArea;
  }

  async findAll(): Promise<SubArea[]> {
    return await this.subAreaRepository.find({
      relations: ['area', 'area.cliente', 'area.cliente.usuarioContacto'],
      order: { nombreSubArea: 'ASC' },
    });
  }

  async findOne(id: number): Promise<SubArea> {
    const subArea = await this.subAreaRepository.findOne({
      where: { idSubArea: id },
      relations: ['area', 'area.cliente', 'area.cliente.usuarioContacto'],
    });
    
    if (!subArea) {
      throw new NotFoundException(`Subárea con ID ${id} no encontrada`);
    }
    
    return subArea;
  }

  async findByAreaId(areaId: number): Promise<SubArea[]> {
    return await this.subAreaRepository.find({
      where: { areaId: areaId },
      relations: ['area', 'area.cliente', 'area.cliente.usuarioContacto'],
      order: { nombreSubArea: 'ASC' },
    });
  }

  async findByClientId(clientId: number): Promise<SubArea[]> {
    return await this.subAreaRepository
      .createQueryBuilder('subArea')
      .leftJoinAndSelect('subArea.area', 'area')
      .leftJoinAndSelect('area.cliente', 'cliente')
      .leftJoinAndSelect('cliente.usuarioContacto', 'usuarioContacto')
      .where('cliente.idCliente = :clientId', { clientId })
      .orderBy('subArea.nombreSubArea', 'ASC')
      .getMany();
  }

  async update(id: number, updateSubAreaDto: UpdateSubAreaDto): Promise<SubArea> {
    const subArea = await this.findOne(id);
    
    if (updateSubAreaDto.areaId && updateSubAreaDto.areaId !== subArea.areaId) {
      const area = await this.areaRepository.findOne({
        where: { idArea: updateSubAreaDto.areaId },
        relations: ['cliente', 'cliente.usuarioContacto'],
      });
      
      if (!area) {
        throw new NotFoundException(`Área con ID ${updateSubAreaDto.areaId} no encontrada`);
      }
      subArea.area = area;
    }
    
    if (updateSubAreaDto.nombreSubArea && updateSubAreaDto.nombreSubArea !== subArea.nombreSubArea) {
      const areaId = updateSubAreaDto.areaId || subArea.areaId;
      const existingSubArea = await this.subAreaRepository.findOne({
        where: {
          nombreSubArea: updateSubAreaDto.nombreSubArea,
          areaId: areaId,
        },
      });
      
      if (existingSubArea && existingSubArea.idSubArea !== id) {
        throw new ConflictException('Ya existe una subárea con este nombre para esta área');
      }
    }
    
    Object.assign(subArea, updateSubAreaDto);
    return await this.subAreaRepository.save(subArea);
  }

  async remove(id: number): Promise<void> {
    const subArea = await this.findOne(id);
    await this.subAreaRepository.remove(subArea);
    this.logger.log(`Subárea eliminada: ${id}`);
  }

  async getHierarchy(subAreaId: number): Promise<any> {
    const subArea = await this.subAreaRepository.findOne({
      where: { idSubArea: subAreaId },
      relations: ['area', 'area.cliente', 'area.cliente.usuarioContacto'],
    });
    
    if (!subArea) {
      throw new NotFoundException(`Subárea con ID ${subAreaId} no encontrada`);
    }
    
    return {
      subArea: {
        idSubArea: subArea.idSubArea,
        nombreSubArea: subArea.nombreSubArea,
      },
      area: {
        idArea: subArea.area.idArea,
        nombreArea: subArea.area.nombreArea,
      },
      cliente: {
        idCliente: subArea.area.cliente.idCliente,
        nombre: subArea.area.cliente.nombre,
        nit: subArea.area.cliente.nit,
      },
      usuarioContacto: {
        usuarioId: subArea.area.cliente.usuarioContacto.usuarioId,
        nombre: subArea.area.cliente.usuarioContacto.nombre,
        email: subArea.area.cliente.usuarioContacto.email,
      },
    };
  }
}