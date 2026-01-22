// src/services/services.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceCategory } from './enums/service.enums';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private servicesRepository: Repository<Service>,
  ) {}

  async create(createServiceDto: CreateServiceDto): Promise<Service> {
    // Verificar si el nombre del servicio ya existe
    const existingService = await this.findByName(createServiceDto.nombreServicio);
    if (existingService) {
      throw new ConflictException('El nombre del servicio ya existe');
    }

    const service = this.servicesRepository.create(createServiceDto);
    return await this.servicesRepository.save(service);
  }

  async findAll(): Promise<Service[]> {
    return await this.servicesRepository.find({
      order: { nombreServicio: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Service> {
    const service = await this.servicesRepository.findOne({
      where: { servicioId: id },
    });

    if (!service) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }

    return service;
  }

  async findByName(nombreServicio: string): Promise<Service | null> {
    return await this.servicesRepository.findOne({
      where: { nombreServicio: nombreServicio },
    });
  }

  async update(id: number, updateServiceDto: UpdateServiceDto): Promise<Service> {
    const service = await this.findOne(id);

    // Verificar si se está actualizando el nombre y si ya existe
    if (updateServiceDto.nombreServicio && updateServiceDto.nombreServicio !== service.nombreServicio) {
      const existingService = await this.findByName(updateServiceDto.nombreServicio);
      if (existingService) {
        throw new ConflictException('El nombre del servicio ya existe');
      }
    }

    await this.servicesRepository.update(id, updateServiceDto);
    return await this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const service = await this.findOne(id);
    
    // Verificar si el servicio está siendo usado en órdenes de trabajo
    const hasWorkOrders = await this.servicesRepository
      .createQueryBuilder('service')
      .innerJoin('service.workOrders', 'workOrder')
      .where('service.servicio_id = :id', { id })
      .getCount();

    if (hasWorkOrders > 0) {
      throw new ConflictException('No se puede eliminar el servicio porque está siendo usado en órdenes de trabajo');
    }

    await this.servicesRepository.remove(service);
  }

  async searchServices(keyword: string): Promise<Service[]> {
    return await this.servicesRepository
      .createQueryBuilder('service')
      .where('service.nombre_servicio ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('service.descripcion ILIKE :keyword', { keyword: `%${keyword}%` })
      .orderBy('service.nombre_servicio', 'ASC')
      .getMany();
  }

  async getServicesWithStats(): Promise<any[]> {
    return await this.servicesRepository
      .createQueryBuilder('service')
      .leftJoin('service.workOrders', 'workOrder')
      .select([
        'service.servicioId',
        'service.nombreServicio',
        'service.descripcion',
        'service.duracionEstimada',
        'service.categoriaServicio',
        'COUNT(workOrder.orden_id) as totalOrdenes',
      ])
      .groupBy('service.servicioId')
      .orderBy('service.nombreServicio', 'ASC')
      .getRawMany();
  }

  // Nuevo método: Obtener servicios por categoría
  async findByCategory(category: ServiceCategory): Promise<Service[]> {
    return await this.servicesRepository.find({
      where: { categoriaServicio: category },
      order: { nombreServicio: 'ASC' },
    });
  }
}