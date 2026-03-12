import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceType } from './entities/maintenance-type.entity';
import { CreateMaintenanceTypeDto } from './dto/create-maintenance-type.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class MaintenanceTypesService {
  constructor(
    @InjectRepository(MaintenanceType)
    private repository: Repository<MaintenanceType>,
    private readonly realtime: RealtimeService,
  ) {}

  async create(dto: CreateMaintenanceTypeDto): Promise<MaintenanceType> {
    const existing = await this.repository.findOne({
      where: { nombre: dto.nombre },
    });
    if (existing) {
      throw new ConflictException(
        'Ya existe un tipo de mantenimiento con este nombre',
      );
    }
    const type = this.repository.create(dto);
    const saved = await this.repository.save(type);

    // Evento WebSocket
    this.realtime.emitEntityUpdate('maintenanceTypes', 'created', saved);

    return saved;
  }

  async findAll(): Promise<MaintenanceType[]> {
    return this.repository.find({ where: { activo: true } });
  }

  async findAllForAdmin(): Promise<MaintenanceType[]> {
    return this.repository.find();
  }

  async findOne(id: number): Promise<MaintenanceType> {
    const type = await this.repository.findOne({ where: { id } });
    if (!type)
      throw new NotFoundException(`Tipo de mantenimiento ${id} no encontrado`);
    return type;
  }

  async remove(id: number): Promise<void> {
    const type = await this.findOne(id);
    type.activo = false;
    const saved = await this.repository.save(type);

    this.realtime.emitEntityUpdate('maintenanceTypes', 'deleted', { id });
  }
}
