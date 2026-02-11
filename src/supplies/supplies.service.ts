// src/supplies/supplies.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Not } from 'typeorm';
import { Supply } from './entities/supply.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { UnitMeasure } from '../unit-measure/entities/unit-measure.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import { SupplyStatus, SupplyCategory } from '../shared/enums/inventory.enum';
import { ImagesService } from '../images/images.service';
import { WebsocketGateway } from '../websockets/websocket.gateway';

@Injectable()
export class SuppliesService {
  private readonly logger = new Logger(SuppliesService.name);

  constructor(
    @InjectRepository(Supply)
    private suppliesRepository: Repository<Supply>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(UnitMeasure)
    private unitMeasureRepository: Repository<UnitMeasure>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    private dataSource: DataSource,
    private readonly imagesService: ImagesService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  private async findOrCreateUnitMeasure(
    nombre: string,
    queryRunnerManager: any,
  ): Promise<UnitMeasure> {
    const cleanName = nombre.trim();
    let unit = await queryRunnerManager.findOne(UnitMeasure, {
      where: { nombre: cleanName },
    });

    if (!unit) {
      unit = queryRunnerManager.create(UnitMeasure, { nombre: cleanName });
      unit = await queryRunnerManager.save(unit);
    }

    return unit;
  }

  async create(dto: CreateSupplyDto): Promise<Supply> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validar nombre único
      const exists = await queryRunner.manager.findOne(Supply, {
        where: { nombre: dto.nombre },
      });
      if (exists) {
        throw new ConflictException('Ya existe un insumo con este nombre');
      }

      // Buscar o crear unidad de medida
      const unitMeasure = await this.findOrCreateUnitMeasure(
        dto.unidadMedida,
        queryRunner.manager,
      );

      // Buscar bodega si se proporciona
      let bodega: Warehouse | null = null;
      if (dto.bodegaId) {
        bodega = await queryRunner.manager.findOne(Warehouse, {
          where: { bodegaId: dto.bodegaId },
        });
        if (!bodega) {
          throw new NotFoundException('Bodega no encontrada');
        }
      }

      // Crear insumo
      const supply = queryRunner.manager.create(Supply, {
        nombre: dto.nombre,
        categoria: dto.categoria as SupplyCategory,
        unidadMedida: unitMeasure,
        estado: SupplyStatus.DISPONIBLE,
        stockMin: dto.stockMin ?? 0,
        valorUnitario: dto.valorUnitario,
      });

      const savedSupply = await queryRunner.manager.save(supply);

      // Crear inventario asociado
      const inventory = queryRunner.manager.create(Inventory, {
        insumoId: savedSupply.insumoId,
        cantidadActual: dto.cantidadInicial ?? 0,
        bodega: bodega,
        fechaUltimaActualizacion: new Date(),
        supply: savedSupply,
      });

      const savedInventory = await queryRunner.manager.save(inventory);

      // Asociar inventario al insumo
      savedSupply.inventory = savedInventory;

      // Calcular y actualizar estado del insumo según stock
      savedSupply.estado = this.calculateSupplyStatus(
        savedInventory.cantidadActual,
        savedSupply.stockMin,
      );

      await queryRunner.manager.save(savedSupply);
      await queryRunner.commitTransaction();

      const full = await this.findOne(savedSupply.insumoId);

      // 🔴 WebSocket
      this.websocketGateway.emit('supplies.created', full);

      return full;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(includeDeleted = false): Promise<Supply[]> {
    return this.suppliesRepository.find({
      relations: ['inventory', 'inventory.bodega', 'unidadMedida', 'images'],
      order: { fechaRegistro: 'DESC' },
      withDeleted: includeDeleted,
    });
  }

  async findOne(id: number, includeDeleted = false): Promise<Supply> {
    const supply = await this.suppliesRepository.findOne({
      where: { insumoId: id },
      relations: ['inventory', 'inventory.bodega', 'unidadMedida', 'images'],
      withDeleted: includeDeleted,
    });

    if (!supply) {
      throw new NotFoundException(`Insumo con ID ${id} no encontrado`);
    }

    return supply;
  }

  async update(id: number, dto: UpdateSupplyDto): Promise<Supply> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const supply = await this.findOne(id);

      // Validar nombre único si se cambia
      if (dto.nombre && dto.nombre !== supply.nombre) {
        const exists = await queryRunner.manager.findOne(Supply, {
          where: { nombre: dto.nombre },
        });
        if (exists) {
          throw new ConflictException('Ya existe un insumo con este nombre');
        }
        supply.nombre = dto.nombre;
      }

      // Actualizar categoría si se proporciona
      if (dto.categoria) {
        supply.categoria = dto.categoria as SupplyCategory;
      }

      // Actualizar unidad de medida si se proporciona
      if (dto.unidadMedida) {
        const unitMeasure = await this.findOrCreateUnitMeasure(
          dto.unidadMedida,
          queryRunner.manager,
        );
        supply.unidadMedida = unitMeasure;
      }

      // Actualizar stock mínimo
      if (dto.stockMin !== undefined) {
        supply.stockMin = dto.stockMin;
      }

      // Actualizar valor unitario
      if (dto.valorUnitario !== undefined) {
        supply.valorUnitario = dto.valorUnitario;
      }

      // Actualizar bodega en el inventario
      if (dto.bodegaId !== undefined) {
        const inventory = supply.inventory;
        if (inventory) {
          if (dto.bodegaId === null) {
            inventory.bodega = null;
          } else {
            const bodega = await queryRunner.manager.findOne(Warehouse, {
              where: { bodegaId: dto.bodegaId },
            });
            if (!bodega) {
              throw new NotFoundException('Bodega no encontrada');
            }
            inventory.bodega = bodega;
          }
          await queryRunner.manager.save(inventory);
        }
      }

      // Actualizar stock si se proporciona
      if (dto.cantidadActual !== undefined) {
        await this.updateStock(id, dto.cantidadActual, queryRunner);
      }

      // Guardar cambios del insumo
      await queryRunner.manager.save(supply);
      await queryRunner.commitTransaction();

      const updated = await this.findOne(id);

      // 🔴 WebSocket
      this.websocketGateway.emit('supplies.updated', updated);

      return updated;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number): Promise<void> {
    const supply = await this.findOne(id);

    // Eliminar imágenes asociadas
    await this.imagesService.deleteBySupply(supply);

    // Soft delete del insumo
    await this.suppliesRepository.softDelete(id);
    // 🔴 WebSocket
    this.websocketGateway.emit('supplies.deleted', { id, soft: true });
  }

  async updateStock(
    id: number,
    cantidad: number,
    queryRunnerManager?: any,
  ): Promise<Supply> {
    if (cantidad < 0) {
      throw new BadRequestException('La cantidad no puede ser negativa');
    }

    const manager = queryRunnerManager || this.suppliesRepository.manager;
    const supply = await this.findOne(id);

    const inventory = await manager.findOne(Inventory, {
      where: { insumoId: id },
    });

    if (!inventory) {
      throw new NotFoundException('Inventario no encontrado para este insumo');
    }

    // Actualizar inventario
    inventory.cantidadActual = cantidad;
    inventory.fechaUltimaActualizacion = new Date();
    await manager.save(inventory);

    supply.estado = this.calculateSupplyStatus(cantidad, supply.stockMin);
    await manager.save(supply);

    const full = await this.findOne(id);

    // 🔴 WebSocket
    this.websocketGateway.emit('supplies.stockUpdated', full);
    this.websocketGateway.emit('supplies.updated', full);

    return full;
  }

  async incrementStock(id: number, cantidad: number): Promise<Supply> {
    const supply = await this.findOne(id);
    const inventory = supply.inventory;

    if (!inventory) {
      throw new NotFoundException('Inventario no encontrado');
    }

    const nuevaCantidad = inventory.cantidadActual + cantidad;
    return this.updateStock(id, nuevaCantidad);
  }

  async decrementStock(id: number, cantidad: number): Promise<Supply> {
    const supply = await this.findOne(id);
    const inventory = supply.inventory;

    if (!inventory) {
      throw new NotFoundException('Inventario no encontrado');
    }

    if (inventory.cantidadActual < cantidad) {
      throw new BadRequestException('No hay suficiente stock para descontar');
    }

    const nuevaCantidad = inventory.cantidadActual - cantidad;
    return this.updateStock(id, nuevaCantidad);
  }

  async getSuppliesStats(): Promise<any> {
    const total = await this.suppliesRepository.count();
    const disponibles = await this.suppliesRepository.count({
      where: { estado: SupplyStatus.DISPONIBLE },
    });
    const agotados = await this.suppliesRepository.count({
      where: { estado: SupplyStatus.AGOTADO },
    });
    const stockBajo = await this.suppliesRepository.count({
      where: { estado: SupplyStatus.STOCK_BAJO },
    });

    return {
      total,
      disponibles,
      agotados,
      stockBajo,
    };
  }

  async searchSupplies(keyword: string): Promise<Supply[]> {
    return this.suppliesRepository
      .createQueryBuilder('supply')
      .leftJoinAndSelect('supply.inventory', 'inventory')
      .leftJoinAndSelect('inventory.bodega', 'bodega')
      .leftJoinAndSelect('supply.unidadMedida', 'unidadMedida')
      .leftJoinAndSelect('supply.images', 'images')
      .where('supply.nombre ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('unidadMedida.nombre ILIKE :keyword', {
        keyword: `%${keyword}%`,
      })
      .orderBy('supply.fecha_registro', 'DESC')
      .getMany();
  }

  async getSuppliesByCategory(categoria: string): Promise<Supply[]> {
    return this.suppliesRepository.find({
      where: { categoria: categoria as SupplyCategory },
      relations: ['inventory', 'inventory.bodega', 'unidadMedida'],
      order: { nombre: 'ASC' },
    });
  }

  async getSuppliesByStatus(estado: string): Promise<Supply[]> {
    return this.suppliesRepository.find({
      where: { estado: estado as SupplyStatus },
      relations: ['inventory', 'inventory.bodega', 'unidadMedida'],
      order: { nombre: 'ASC' },
    });
  }

  async getLowStockSupplies(): Promise<Supply[]> {
    return this.suppliesRepository
      .createQueryBuilder('supply')
      .leftJoinAndSelect('supply.inventory', 'inventory')
      .leftJoinAndSelect('inventory.bodega', 'bodega')
      .leftJoinAndSelect('supply.unidadMedida', 'unidadMedida')
      .leftJoinAndSelect('supply.images', 'images')
      .where('inventory.cantidad_actual <= supply.stock_min')
      .andWhere('supply.stock_min > 0')
      .orderBy('inventory.cantidad_actual', 'ASC')
      .getMany();
  }

  async getDeleted(): Promise<Supply[]> {
    return this.suppliesRepository.find({
      where: { fechaEliminacion: Not(IsNull()) },
      relations: ['inventory', 'unidadMedida'],
      withDeleted: true,
      order: { fechaEliminacion: 'DESC' },
    });
  }

  async restore(id: number): Promise<Supply> {
    const supply = await this.suppliesRepository.findOne({
      where: { insumoId: id },
      withDeleted: true,
    });

    if (!supply) {
      throw new NotFoundException(`Insumo con ID ${id} no encontrado`);
    }

    await this.suppliesRepository.restore(id);
    const restored = await this.findOne(id);

    // 🔴 WebSocket
    this.websocketGateway.emit('supplies.restored', restored);
    this.websocketGateway.emit('supplies.updated', restored);

    return restored;
  }

  private calculateSupplyStatus(
    cantidad: number,
    stockMin: number = 0,
  ): SupplyStatus {
    if (cantidad === 0) return SupplyStatus.AGOTADO;
    if (stockMin > 0 && cantidad <= stockMin) return SupplyStatus.STOCK_BAJO;
    return SupplyStatus.DISPONIBLE;
  }
}
