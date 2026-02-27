import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Not } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Supply } from '../supplies/entities/supply.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { SupplyStatus } from '../shared';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { buildInventoryExcel } from '../../templates/excel/inventory-inventory.template';
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Supply)
    private supplyRepository: Repository<Supply>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    private dataSource: DataSource,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(createInventoryDto: CreateInventoryDto): Promise<Inventory> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (createInventoryDto.insumoId && createInventoryDto.herramientaId) {
        throw new BadRequestException(
          'Solo se puede proporcionar insumoId o herramientaId, no ambos',
        );
      }

      if (!createInventoryDto.insumoId && !createInventoryDto.herramientaId) {
        throw new BadRequestException(
          'Debe proporcionar insumoId o herramientaId',
        );
      }

      let bodega: Warehouse | null = null;
      if (createInventoryDto.bodegaId) {
        bodega = await queryRunner.manager.findOne(Warehouse, {
          where: { bodegaId: createInventoryDto.bodegaId },
        });
        if (!bodega) {
          throw new NotFoundException(
            `Bodega con ID ${createInventoryDto.bodegaId} no encontrada`,
          );
        }
      }

      let supply: Supply | null = null;
      let tool: Tool | null = null;

      let existingInventory: Inventory | null = null;

      if (createInventoryDto.herramientaId) {
        existingInventory = await queryRunner.manager.findOne(Inventory, {
          where: { herramientaId: createInventoryDto.herramientaId },
        });

        if (existingInventory) {
          this.logger.warn(
            `⚠️ La herramienta ${createInventoryDto.herramientaId} ya tiene inventario. Actualizando...`,
          );

          if (bodega) existingInventory.bodega = bodega;
          if (createInventoryDto.ubicacion !== undefined) {
            existingInventory.ubicacion = createInventoryDto.ubicacion ?? null;
          }
          if (createInventoryDto.cantidadActual !== undefined) {
            if (createInventoryDto.cantidadActual !== 1) {
              throw new BadRequestException(
                'Las herramientas siempre deben tener cantidad 1 en inventario',
              );
            }
            existingInventory.cantidadActual =
              createInventoryDto.cantidadActual;
          }
          existingInventory.fechaUltimaActualizacion = new Date();

          const updatedInventory =
            await queryRunner.manager.save(existingInventory);
          await queryRunner.commitTransaction();

          const fullInventory = await this.findOne(
            updatedInventory.inventarioId,
          );
          this.notificationsGateway.server.emit(
            'inventory.updated',
            fullInventory,
          );

          return fullInventory;
        }

        tool = await queryRunner.manager.findOne(Tool, {
          where: { herramientaId: createInventoryDto.herramientaId },
        });
        if (!tool) {
          throw new NotFoundException(
            `Herramienta con ID ${createInventoryDto.herramientaId} no encontrada`,
          );
        }
      }

      if (createInventoryDto.insumoId) {
        const whereCondition: any = {
          insumoId: createInventoryDto.insumoId,
        };

        if (bodega) {
          whereCondition.bodega = { bodegaId: bodega.bodegaId };
        } else {
          whereCondition.bodega = IsNull();
        }

        existingInventory = await queryRunner.manager.findOne(Inventory, {
          where: whereCondition,
        });

        if (existingInventory) {
          this.logger.warn(
            `⚠️ El insumo ${createInventoryDto.insumoId} ya tiene inventario en esta bodega. Actualizando...`,
          );

          if (createInventoryDto.ubicacion !== undefined) {
            existingInventory.ubicacion = createInventoryDto.ubicacion ?? null;
          }
          if (createInventoryDto.cantidadActual !== undefined) {
            existingInventory.cantidadActual =
              Number(existingInventory.cantidadActual) +
              Number(createInventoryDto.cantidadActual);
          }
          existingInventory.fechaUltimaActualizacion = new Date();

          const updatedInventory =
            await queryRunner.manager.save(existingInventory);

          const supplyToUpdate = await queryRunner.manager.findOne(Supply, {
            where: { insumoId: createInventoryDto.insumoId },
          });
          if (supplyToUpdate) {
            const supplyEstado = this.calculateSupplyStatus(
              Number(updatedInventory.cantidadActual),
              supplyToUpdate.stockMin,
            );
            await queryRunner.manager.update(Supply, supplyToUpdate.insumoId, {
              estado: supplyEstado as SupplyStatus,
            });
          }

          await queryRunner.commitTransaction();

          const fullInventory = await this.findOne(
            updatedInventory.inventarioId,
          );
          this.notificationsGateway.server.emit(
            'inventory.updated',
            fullInventory,
          );

          return fullInventory;
        }

        supply = await queryRunner.manager.findOne(Supply, {
          where: { insumoId: createInventoryDto.insumoId },
          relations: ['unidadMedida'],
        });
        if (!supply) {
          throw new NotFoundException(
            `Insumo con ID ${createInventoryDto.insumoId} no encontrado`,
          );
        }
      }

      const cantidadInicial = createInventoryDto.cantidadActual || 0;

      if (tool && cantidadInicial !== 1) {
        throw new BadRequestException(
          'Las herramientas siempre deben tener cantidad 1 en inventario',
        );
      }

      const inventoryData: Partial<Inventory> = {
        insumoId: createInventoryDto.insumoId ?? null,
        herramientaId: createInventoryDto.herramientaId ?? null,
        cantidadActual: cantidadInicial,
        ubicacion: createInventoryDto.ubicacion ?? null,
        bodega: bodega || null,
        fechaUltimaActualizacion: new Date(),
      };

      const inventory = queryRunner.manager.create(Inventory, inventoryData);

      if (supply) {
        inventory.supply = supply;
      }

      if (tool) {
        inventory.tool = tool;
      }

      const savedInventory = await queryRunner.manager.save(inventory);

      if (supply && savedInventory.cantidadActual !== undefined) {
        const supplyEstado = this.calculateSupplyStatus(
          Number(savedInventory.cantidadActual),
          supply.stockMin,
        );
        await queryRunner.manager.update(Supply, supply.insumoId, {
          estado: supplyEstado as SupplyStatus,
        });
      }

      await queryRunner.commitTransaction();

      const fullInventory = await this.findOne(savedInventory.inventarioId);

      this.notificationsGateway.server.emit('inventory.created', fullInventory);

      return fullInventory;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(includeDeleted = false): Promise<Inventory[]> {
    return await this.inventoryRepository.find({
      relations: [
        'supply',
        'supply.unidadMedida',
        'tool',
        'bodega',
        'bodega.cliente',
      ],
      order: { fechaUltimaActualizacion: 'DESC' },
      withDeleted: includeDeleted,
    });
  }

  async findOne(id: number, includeDeleted = false): Promise<Inventory> {
    const inventory = await this.inventoryRepository.findOne({
      where: { inventarioId: id },
      relations: [
        'supply',
        'supply.unidadMedida',
        'tool',
        'bodega',
        'bodega.cliente',
      ],
      withDeleted: includeDeleted,
    });

    if (!inventory) {
      throw new NotFoundException(
        `Registro de inventario con ID ${id} no encontrado`,
      );
    }

    return inventory;
  }

  async update(
    id: number,
    updateInventoryDto: UpdateInventoryDto,
  ): Promise<Inventory> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const inventory = await this.findOne(id);

      const camposNoPermitidos = [
        'nombre',
        'valorUnitario',
        'unidadMedida',
        'descripcion',
        'insumoId',
        'herramientaId',
      ];
      for (const campo of camposNoPermitidos) {
        if (campo in updateInventoryDto) {
          throw new BadRequestException(
            `El campo '${campo}' no está permitido en la actualización de inventario`,
          );
        }
      }

      if (updateInventoryDto.bodegaId !== undefined) {
        if (updateInventoryDto.bodegaId === null) {
          inventory.bodega = null;
        } else {
          const bodega = await queryRunner.manager.findOne(Warehouse, {
            where: { bodegaId: updateInventoryDto.bodegaId },
          });
          if (!bodega) {
            throw new NotFoundException(
              `Bodega con ID ${updateInventoryDto.bodegaId} no encontrada`,
            );
          }

          if (inventory.insumoId) {
            const existing = await queryRunner.manager.findOne(Inventory, {
              where: {
                insumoId: inventory.insumoId,
                bodega: { bodegaId: bodega.bodegaId },
              },
            });
            if (existing && existing.inventarioId !== id) {
              throw new ConflictException(
                `Ya existe este insumo en la bodega "${bodega.nombre}"`,
              );
            }
          } else if (inventory.herramientaId) {
            const existing = await queryRunner.manager.findOne(Inventory, {
              where: {
                herramientaId: inventory.herramientaId,
                bodega: { bodegaId: bodega.bodegaId },
              },
            });
            if (existing && existing.inventarioId !== id) {
              throw new ConflictException(
                `Ya existe esta herramienta en la bodega "${bodega.nombre}"`,
              );
            }
          }

          inventory.bodega = bodega;
        }
      }

      const updateData: Partial<Inventory> = {};

      if (updateInventoryDto.cantidadActual !== undefined) {
        if (updateInventoryDto.cantidadActual < 0) {
          throw new BadRequestException('La cantidad no puede ser negativa');
        }

        if (
          inventory.herramientaId &&
          updateInventoryDto.cantidadActual !== 1
        ) {
          throw new BadRequestException(
            'Las herramientas siempre deben tener cantidad 1 en inventario',
          );
        }

        updateData.cantidadActual = updateInventoryDto.cantidadActual;
      }

      if (updateInventoryDto.ubicacion !== undefined) {
        updateData.ubicacion = updateInventoryDto.ubicacion ?? null;
      }

      if (Object.keys(updateData).length > 0) {
        updateData.fechaUltimaActualizacion = new Date();

        Object.assign(inventory, updateData);
        await queryRunner.manager.save(inventory);

        if (
          updateInventoryDto.cantidadActual !== undefined &&
          inventory.insumoId
        ) {
          const supply = await queryRunner.manager.findOne(Supply, {
            where: { insumoId: inventory.insumoId },
          });

          if (supply) {
            const supplyEstado = this.calculateSupplyStatus(
              updateInventoryDto.cantidadActual,
              supply.stockMin,
            );
            await queryRunner.manager.update(Supply, supply.insumoId, {
              estado: supplyEstado as SupplyStatus,
            });
          }
        }
      }

      await queryRunner.commitTransaction();

      const fullInventory = await this.findOne(id);

      this.notificationsGateway.server.emit('inventory.updated', fullInventory);

      return fullInventory;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.inventoryRepository.softDelete(id);

    this.notificationsGateway.server.emit('inventory.deleted', {
      id,
      soft: true,
    });
  }

  async removeComplete(id: number): Promise<{
    deletedInventory: any;
    deletedItem: any;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const inventory = await this.findOne(id);

      const deletedInfo: {
        inventory: {
          id: number;
          tipo: string;
          nombreItem: string;
          cantidadActual: number;
          ubicacion?: string | null;
        };
        item: {
          tipo: string;
          id: number;
          nombre: string;
          categoria?: string;
          marca?: string;
        } | null;
      } = {
        inventory: {
          id: inventory.inventarioId,
          tipo: inventory.tipo,
          nombreItem: inventory.nombreItem,
          cantidadActual: Number(inventory.cantidadActual),
          ubicacion: inventory.ubicacion || null,
        },
        item: null,
      };

      if (inventory.insumoId && inventory.supply) {
        deletedInfo.item = {
          tipo: 'insumo',
          id: inventory.insumoId,
          nombre: inventory.supply.nombre,
          categoria: inventory.supply.categoria,
        };

        // Eliminamos primero el insumo; el CASCADE en Inventory se encarga de borrar inventarios
        await queryRunner.manager.remove(inventory.supply);
      } else if (inventory.herramientaId && inventory.tool) {
        deletedInfo.item = {
          tipo: 'herramienta',
          id: inventory.herramientaId,
          nombre: inventory.tool.nombre,
          marca: inventory.tool.marca || undefined,
        };

        await queryRunner.manager.remove(inventory.tool);
      } else {
        // Si por alguna razón no tiene supply/tool asociado, al menos eliminamos el inventario
        await queryRunner.manager.remove(inventory);
      }

      await queryRunner.commitTransaction();

      this.notificationsGateway.server.emit(
        'inventory.deletedPermanent',
        deletedInfo,
      );

      return {
        deletedInventory: deletedInfo.inventory,
        deletedItem: deletedInfo.item,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async searchInventory(keyword: string): Promise<Inventory[]> {
    return await this.inventoryRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.supply', 'supply')
      .leftJoinAndSelect('inventory.tool', 'tool')
      .leftJoinAndSelect('inventory.bodega', 'bodega')
      .leftJoinAndSelect('supply.unidadMedida', 'unidadMedida')
      .where('supply.nombre ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('tool.nombre ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('bodega.nombre ILIKE :keyword', { keyword: `%${keyword}%` })
      .orderBy('inventory.fecha_ultima_actualizacion', 'DESC')
      .getMany();
  }

  async getInventoryByBodega(bodegaId: number): Promise<Inventory[]> {
    return await this.inventoryRepository.find({
      where: { bodega: { bodegaId } },
      relations: ['supply', 'supply.unidadMedida', 'tool', 'bodega'],
      order: { fechaUltimaActualizacion: 'DESC' },
    });
  }

  async getLowStockItems(threshold: number = 5): Promise<Inventory[]> {
    return await this.inventoryRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.supply', 'supply')
      .leftJoinAndSelect('supply.unidadMedida', 'unidadMedida')
      .leftJoinAndSelect('inventory.bodega', 'bodega')
      .where('inventory.cantidad_actual <= :threshold', { threshold })
      .andWhere('inventory.insumo_id IS NOT NULL')
      .andWhere('supply.stock_min IS NOT NULL')
      .andWhere('inventory.cantidad_actual <= supply.stock_min')
      .orderBy('inventory.cantidad_actual', 'ASC')
      .getMany();
  }

  async updateStock(
    inventarioId: number,
    nuevaCantidad: number,
  ): Promise<Inventory> {
    if (nuevaCantidad < 0) {
      throw new BadRequestException('La cantidad no puede ser negativa');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const inventory = await this.findOne(inventarioId);

      if (!inventory.insumoId) {
        throw new BadRequestException(
          'Solo se puede actualizar el stock de insumos',
        );
      }

      inventory.cantidadActual = nuevaCantidad;
      inventory.fechaUltimaActualizacion = new Date();
      await queryRunner.manager.save(inventory);

      if (inventory.supply) {
        const estado = this.calculateSupplyStatus(
          nuevaCantidad,
          inventory.supply.stockMin,
        );
        await queryRunner.manager.update(Supply, inventory.supply.insumoId, {
          estado: estado as SupplyStatus,
        });
      }

      await queryRunner.commitTransaction();
      const fullInventory = await this.findOne(inventarioId);

      this.notificationsGateway.server.emit(
        'inventory.stockUpdated',
        fullInventory,
      );
      this.notificationsGateway.server.emit('inventory.updated', fullInventory);

      return fullInventory;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getInventoryStats(): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const totalItems = await queryRunner.manager.count(Inventory);

      const suppliesCount = await queryRunner.manager
        .createQueryBuilder(Inventory, 'inventory')
        .where('inventory.insumo_id IS NOT NULL')
        .getCount();

      const herramientasCount = await queryRunner.manager
        .createQueryBuilder(Inventory, 'inventory')
        .where('inventory.herramienta_id IS NOT NULL')
        .getCount();

      const lowStockCount = await this.getLowStockItems().then(
        (items) => items.length,
      );

      const totalValue = await queryRunner.manager
        .createQueryBuilder(Inventory, 'inventory')
        .leftJoin('inventory.supply', 'supply')
        .leftJoin('inventory.tool', 'tool')
        .select(
          `SUM(
            CASE 
              WHEN inventory.insumo_id IS NOT NULL THEN 
                (COALESCE(supply.valor_unitario, 0) * COALESCE(inventory.cantidad_actual, 0))
              WHEN inventory.herramienta_id IS NOT NULL THEN 
                COALESCE(tool.valor_unitario, 0)
              ELSE 0 
            END
          )`,
          'total',
        )
        .getRawOne();

      const statsByBodega = await queryRunner.manager
        .createQueryBuilder(Inventory, 'inventory')
        .leftJoin('inventory.bodega', 'bodega')
        .select('bodega.bodega_id', 'bodegaId')
        .addSelect('bodega.nombre', 'bodegaNombre')
        .addSelect('COUNT(inventory.inventario_id)', 'totalItems')
        .addSelect(
          'COUNT(CASE WHEN inventory.insumo_id IS NOT NULL THEN 1 END)',
          'insumos',
        )
        .addSelect(
          'COUNT(CASE WHEN inventory.herramienta_id IS NOT NULL THEN 1 END)',
          'herramientas',
        )
        .addSelect(
          'SUM(CASE WHEN inventory.insumo_id IS NOT NULL THEN inventory.cantidad_actual ELSE 0 END)',
          'totalInsumos',
        )
        .where('bodega.bodega_id IS NOT NULL')
        .groupBy('bodega.bodega_id, bodega.nombre')
        .orderBy('bodega.nombre', 'ASC')
        .getRawMany();

      // Calculamos los estados en memoria, sin depender de una columna en BD
      const allInventories = await queryRunner.manager.find(Inventory, {
        relations: ['supply'],
      });

      const estadoCounts = new Map<string, number>();

      for (const inv of allInventories) {
        if (inv.insumoId && inv.supply) {
          const estado = this.getInventoryStatus(
            Number(inv.cantidadActual),
            inv.supply.stockMin,
          );
          estadoCounts.set(estado, (estadoCounts.get(estado) || 0) + 1);
        } else {
          const estado = 'N/A';
          estadoCounts.set(estado, (estadoCounts.get(estado) || 0) + 1);
        }
      }

      const statsByEstado = Array.from(estadoCounts.entries())
        .map(([estado, cantidad]) => ({ estado, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

      return {
        totalItems,
        suppliesCount,
        herramientasCount,
        lowStockCount,
        totalValue: parseFloat(totalValue?.total || '0'),
        porBodega: statsByBodega,
        porEstado: statsByEstado,
      };
    } finally {
      await queryRunner.release();
    }
  }

  async getDeleted(): Promise<Inventory[]> {
    return await this.inventoryRepository.find({
      where: { fechaEliminacion: Not(IsNull()) },
      relations: ['supply', 'tool', 'bodega'],
      withDeleted: true,
      order: { fechaEliminacion: 'DESC' },
    });
  }

  async restore(id: number): Promise<Inventory> {
    const inventory = await this.inventoryRepository.findOne({
      where: { inventarioId: id },
      withDeleted: true,
    });

    if (!inventory) {
      throw new NotFoundException(
        `Registro de inventario con ID ${id} no encontrado`,
      );
    }

    await this.inventoryRepository.restore(id);

    const restored = await this.findOne(id);

    this.notificationsGateway.server.emit('inventory.restored', restored);

    return restored;
  }

  // Estado textual del inventario (no se persiste en BD)
  public getInventoryStatus(cantidad: number, stockMin: number = 0): string {
    if (cantidad <= 0) return 'Sin Stock';
    if (stockMin > 0 && cantidad <= stockMin) return 'Stock Bajo';
    if (cantidad <= 5) return 'Stock Crítico';
    if (cantidad <= 10) return 'Stock Bajo';
    return 'Stock Óptimo';
  }

  private calculateSupplyStatus(
    cantidad: number,
    stockMin: number = 0,
  ): SupplyStatus {
    if (cantidad === 0) {
      return SupplyStatus.AGOTADO;
    } else if (stockMin > 0 && cantidad <= stockMin) {
      return SupplyStatus.STOCK_BAJO;
    } else {
      return SupplyStatus.DISPONIBLE;
    }
  }

  async generateInventoryExcel(
    bodegaId?: number,
    includeDeleted: boolean = false,
  ): Promise<Buffer> {
    try {
      this.logger.log(
        `Generando Excel - bodegaId: ${bodegaId}, includeDeleted: ${includeDeleted}`,
      );

      const query = this.inventoryRepository
        .createQueryBuilder('inventory')
        .leftJoinAndSelect('inventory.supply', 'supply')
        .leftJoinAndSelect('supply.unidadMedida', 'unidadMedida')
        .leftJoinAndSelect('inventory.tool', 'tool')
        .leftJoinAndSelect('inventory.bodega', 'bodega')
        .leftJoinAndSelect('bodega.cliente', 'cliente')
        .orderBy('inventory.fechaUltimaActualizacion', 'DESC');

      // Aplicar filtro de bodega solo si se proporciona un ID válido
      if (bodegaId !== undefined && !isNaN(bodegaId)) {
        query.andWhere('bodega.bodegaId = :bodegaId', { bodegaId });
        this.logger.log(`Filtrando por bodega ID: ${bodegaId}`);
      }

      // Manejar registros eliminados
      if (includeDeleted) {
        query.withDeleted();
      }

      const inventories = await query.getMany();

      this.logger.log(
        `Se encontraron ${inventories.length} registros para exportar`,
      );

      return buildInventoryExcel({ inventories });
    } catch (error) {
      this.logger.error(`Error generando Excel: ${error.message}`, error.stack);
      throw error;
    }
  }
}
