// src/warehouses/warehouses.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Warehouse } from './entities/warehouse.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { Client } from '../client/entities/client.entity';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    private dataSource: DataSource,
  ) {}

  async create(createWarehouseDto: CreateWarehouseDto): Promise<Warehouse> {
    // Verificar si ya existe una bodega con el mismo nombre
    const existingWarehouse = await this.warehouseRepo.findOne({
      where: { nombre: createWarehouseDto.nombre },
    });

    if (existingWarehouse) {
      throw new ConflictException(
        `Ya existe una bodega con el nombre "${createWarehouseDto.nombre}"`,
      );
    }

    // Crear la bodega sin cliente inicialmente
    const warehouseData: Partial<Warehouse> = {
      nombre: createWarehouseDto.nombre,
      descripcion: createWarehouseDto.descripcion,
      direccion: createWarehouseDto.direccion,
      activa: true,
    };

    // Si se especificó un cliente, verificar que exista
    if (createWarehouseDto.clienteId) {
      const cliente = await this.clientRepo.findOne({
        where: { idCliente: createWarehouseDto.clienteId },
      });

      if (!cliente) {
        throw new NotFoundException(
          `Cliente con ID ${createWarehouseDto.clienteId} no encontrado`,
        );
      }

      warehouseData.cliente = cliente;
      warehouseData.clienteId = createWarehouseDto.clienteId;
    } else {
      warehouseData.cliente = null;
      warehouseData.clienteId = null;
    }

    const warehouse = this.warehouseRepo.create(warehouseData);
    return await this.warehouseRepo.save(warehouse);
  }

  async findAll(includeInactive = false): Promise<Warehouse[]> {
    const where = includeInactive ? {} : { activa: true };
    return await this.warehouseRepo.find({
      where,
      order: { nombre: 'ASC' },
      relations: ['inventarios', 'cliente'],
    });
  }

  async findOne(id: number): Promise<Warehouse> {
    const warehouse = await this.warehouseRepo.findOne({
      where: { bodegaId: id },
      relations: ['inventarios', 'cliente'],
    });

    if (!warehouse) {
      throw new NotFoundException(`Bodega con ID ${id} no encontrada`);
    }

    return warehouse;
  }

  async update(
    id: number,
    updateWarehouseDto: UpdateWarehouseDto,
  ): Promise<Warehouse> {
    const warehouse = await this.findOne(id);

    // Si se intenta cambiar el nombre, verificar que no exista otro con ese nombre
    if (updateWarehouseDto.nombre && updateWarehouseDto.nombre !== warehouse.nombre) {
      const existingWithName = await this.warehouseRepo.findOne({
        where: { nombre: updateWarehouseDto.nombre },
      });

      if (existingWithName && existingWithName.bodegaId !== id) {
        throw new ConflictException(
          `Ya existe una bodega con el nombre "${updateWarehouseDto.nombre}"`,
        );
      }
    }

    // Si se intenta cambiar el cliente
    if (updateWarehouseDto.clienteId !== undefined) {
      if (updateWarehouseDto.clienteId === null) {
        // Desasignar cliente
        warehouse.cliente = null;
        warehouse.clienteId = null;
      } else if (updateWarehouseDto.clienteId !== warehouse.clienteId) {
        const cliente = await this.clientRepo.findOne({
          where: { idCliente: updateWarehouseDto.clienteId },
        });

        if (!cliente) {
          throw new NotFoundException(
            `Cliente con ID ${updateWarehouseDto.clienteId} no encontrado`,
          );
        }

        warehouse.cliente = cliente;
        warehouse.clienteId = updateWarehouseDto.clienteId;
      }
    }

    // Actualizar otros campos
    if (updateWarehouseDto.nombre !== undefined) {
      warehouse.nombre = updateWarehouseDto.nombre;
    }
    if (updateWarehouseDto.descripcion !== undefined) {
      warehouse.descripcion = updateWarehouseDto.descripcion;
    }
    if (updateWarehouseDto.direccion !== undefined) {
      warehouse.direccion = updateWarehouseDto.direccion;
    }
    if (updateWarehouseDto.activa !== undefined) {
      warehouse.activa = updateWarehouseDto.activa;
    }

    return await this.warehouseRepo.save(warehouse);
  }

  async findByClienteId(clienteId: number, includeInactive = false): Promise<Warehouse[]> {
    const where: any = { clienteId };
    if (!includeInactive) {
      where.activa = true;
    }

    return await this.warehouseRepo.find({
      where,
      order: { nombre: 'ASC' },
      relations: ['inventarios', 'cliente'],
    });
  }

  async findWithoutCliente(includeInactive = false): Promise<Warehouse[]> {
    const where: any = { clienteId: null };
    if (!includeInactive) {
      where.activa = true;
    }

    return await this.warehouseRepo.find({
      where,
      order: { nombre: 'ASC' },
      relations: ['inventarios', 'cliente'],
    });
  }

  async remove(id: number): Promise<{ message: string }> {
    const warehouse = await this.findOne(id);

    // Verificar si la bodega tiene inventario asociado
    if (warehouse.inventarios && warehouse.inventarios.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar la bodega porque tiene items en inventario asociados. ' +
        'Primero debe reubicar los items a otra bodega.',
      );
    }

    await this.warehouseRepo.softDelete(id);
    return { message: 'Bodega eliminada exitosamente' };
  }

  async getStats(id: number): Promise<any> {
    const warehouse = await this.findOne(id);
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const stats = await queryRunner.manager
        .createQueryBuilder()
        .select([
          'COUNT(CASE WHEN i.insumo_id IS NOT NULL THEN 1 END) as insumos',
          'COUNT(CASE WHEN i.herramienta_id IS NOT NULL THEN 1 END) as herramientas',
          'SUM(i.cantidad_actual) as total_cantidad',
        ])
        .from('inventario', 'i')
        .where('i.bodega_id = :id', { id })
        .getRawOne();

      return {
        bodegaId: warehouse.bodegaId,
        nombre: warehouse.nombre,
        clienteId: warehouse.clienteId,
        clienteNombre: warehouse.cliente?.nombre || null,
        clienteNit: warehouse.cliente?.nit || null,
        totalItems: parseInt(stats.insumos) + parseInt(stats.herramientas),
        insumos: parseInt(stats.insumos),
        herramientas: parseInt(stats.herramientas),
        totalCantidad: parseFloat(stats.total_cantidad) || 0,
      };
    } finally {
      await queryRunner.release();
    }
  }

  async findAllWithStats(): Promise<any[]> {
    const warehouses = await this.findAll();
    const warehousesWithStats: any[] = [];

    for (const warehouse of warehouses) {
      const stats = await this.getStats(warehouse.bodegaId);
      warehousesWithStats.push(stats);
    }

    return warehousesWithStats;
  }
}