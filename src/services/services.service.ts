import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceCategory } from '../shared/index';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private servicesRepository: Repository<Service>,
    private readonly realtime: RealtimeService,
  ) {}

  async create(createServiceDto: CreateServiceDto): Promise<Service> {
    const existingService = await this.findByName(
      createServiceDto.nombreServicio,
    );
    if (existingService) {
      throw new ConflictException('El nombre del servicio ya existe');
    }

    const service = this.servicesRepository.create(createServiceDto);
    const saved = await this.servicesRepository.save(service);

    // WebSocket
    this.realtime.emitEntityUpdate('services', 'created', saved);

    return saved;
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

  async update(
    id: number,
    updateServiceDto: UpdateServiceDto,
  ): Promise<Service> {
    const service = await this.findOne(id);

    if (
      updateServiceDto.nombreServicio &&
      updateServiceDto.nombreServicio !== service.nombreServicio
    ) {
      const existingService = await this.findByName(
        updateServiceDto.nombreServicio,
      );
      if (existingService) {
        throw new ConflictException('El nombre del servicio ya existe');
      }
    }

    await this.servicesRepository.update(id, updateServiceDto);
    const updated = await this.findOne(id);

    // WebSocket
    this.realtime.emitEntityUpdate('services', 'updated', updated);

    return updated;
  }

  async remove(id: number): Promise<void> {
    const service = await this.findOne(id);

    const hasWorkOrders = await this.servicesRepository
      .createQueryBuilder('service')
      .innerJoin('service.workOrders', 'workOrder')
      .where('service.servicio_id = :id', { id })
      .getCount();

    if (hasWorkOrders > 0) {
      throw new ConflictException(
        'No se puede eliminar el servicio porque está siendo usado en órdenes de trabajo',
      );
    }

    await this.servicesRepository.remove(service);

    // WebSocket
    this.realtime.emitEntityUpdate('services', 'deleted', { id });
  }

  async searchServices(keyword: string): Promise<Service[]> {
    return await this.servicesRepository
      .createQueryBuilder('service')
      .where('service.nombre_servicio ILIKE :keyword', {
        keyword: `%${keyword}%`,
      })
      .orWhere('service.descripcion ILIKE :keyword', {
        keyword: `%${keyword}%`,
      })
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

  async findByCategory(category: ServiceCategory): Promise<Service[]> {
    return await this.servicesRepository.find({
      where: { categoriaServicio: category },
      order: { nombreServicio: 'ASC' },
    });
  }
}
