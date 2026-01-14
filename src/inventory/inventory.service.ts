// src/inventory/inventory.service.ts
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
import { SupplyStatus, ToolStatus } from '../shared/enums';

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
  ) {}

  async create(createInventoryDto: CreateInventoryDto): Promise<Inventory> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validar que solo se proporcione insumoId o herramientaId, no ambos
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

      // Buscar Bodega si se proporciona bodegaId
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

      // Verificar si el insumo existe
      if (createInventoryDto.insumoId) {
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

      // Verificar si la herramienta existe
      if (createInventoryDto.herramientaId) {
        tool = await queryRunner.manager.findOne(Tool, {
          where: { herramientaId: createInventoryDto.herramientaId },
        });
        if (!tool) {
          throw new NotFoundException(
            `Herramienta con ID ${createInventoryDto.herramientaId} no encontrada`,
          );
        }
      }

      // Verificar si ya existe un registro de inventario para este item en la misma bodega
      if (bodega) {
        let existingItem: Inventory | null = null;

        if (createInventoryDto.insumoId) {
          existingItem = await queryRunner.manager.findOne(Inventory, {
            where: {
              insumoId: createInventoryDto.insumoId,
              bodega: { bodegaId: bodega.bodegaId },
            },
          });
        } else if (createInventoryDto.herramientaId) {
          existingItem = await queryRunner.manager.findOne(Inventory, {
            where: {
              herramientaId: createInventoryDto.herramientaId,
              bodega: { bodegaId: bodega.bodegaId },
            },
          });
        }

        if (existingItem) {
          throw new ConflictException(
            `Ya existe un registro de inventario para este ${
              createInventoryDto.insumoId ? 'insumo' : 'herramienta'
            } en la bodega "${bodega.nombre}"`,
          );
        }
      }

      // Calcular cantidad inicial
      const cantidadInicial = createInventoryDto.cantidadActual || 0;
      
      // Para herramientas, la cantidad siempre debe ser 1
      if (tool && cantidadInicial !== 1) {
        throw new BadRequestException(
          'Las herramientas siempre deben tener cantidad 1 en inventario',
        );
      }

      // Calcular estado inicial
      const estado = this.calcularEstado(cantidadInicial, supply?.stockMin);

      // Crear el registro de inventario
      const inventoryData: Partial<Inventory> = {
        insumoId: createInventoryDto.insumoId,
        herramientaId: createInventoryDto.herramientaId,
        cantidadActual: cantidadInicial,
        ubicacion: '',
        bodega: bodega || undefined,
        fechaUltimaActualizacion: new Date(),
      };

      const inventory = queryRunner.manager.create(Inventory, inventoryData);

      // Asignar relaciones
      if (supply) {
        inventory.supply = supply;
      }

      if (tool) {
        inventory.tool = tool;
      }

      const savedInventory = await queryRunner.manager.save(inventory);

      // Si es un insumo, actualizar su estado en la entidad Supply
      if (supply && savedInventory.cantidadActual !== undefined) {
        const supplyEstado = this.calculateSupplyStatus(
          savedInventory.cantidadActual,
          supply.stockMin,
        );
        await queryRunner.manager.update(Supply, supply.insumoId, {
          estado: supplyEstado as SupplyStatus,
        });
      }

      await queryRunner.commitTransaction();
      
      this.logger.log(
        `Inventario creado: ${savedInventory.inventarioId} - ${savedInventory.nombreItem}`,
      );
      
      return await this.findOne(savedInventory.inventarioId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(includeDeleted = false): Promise<Inventory[]> {
    return await this.inventoryRepository.find({
      relations: ['supply', 'supply.unidadMedida', 'tool', 'bodega', 'bodega.cliente'],
      order: { fechaUltimaActualizacion: 'DESC' },
      withDeleted: includeDeleted,
    });
  }

  async findOne(id: number, includeDeleted = false): Promise<Inventory> {
    const inventory = await this.inventoryRepository.findOne({
      where: { inventarioId: id },
      relations: ['supply', 'supply.unidadMedida', 'tool', 'bodega', 'bodega.cliente'],
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

      // Validar que no se envíen campos no permitidos
      const camposNoPermitidos = ['nombre', 'valorUnitario', 'unidadMedida', 'descripcion', 'insumoId', 'herramientaId'];
      for (const campo of camposNoPermitidos) {
        if (campo in updateInventoryDto) {
          throw new BadRequestException(`El campo '${campo}' no está permitido en la actualización de inventario`);
        }
      }

      // Actualizar bodega si se proporciona bodegaId
      if (updateInventoryDto.bodegaId !== undefined) {
        if (updateInventoryDto.bodegaId === null) {
          // Desasignar bodega
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
          
          // Verificar si ya existe otro item igual en esta bodega
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

      // Actualizar otros campos
      const updateData: Partial<Inventory> = {};

      if (updateInventoryDto.cantidadActual !== undefined) {
        // Validar que la cantidad no sea negativa
        if (updateInventoryDto.cantidadActual < 0) {
          throw new BadRequestException('La cantidad no puede ser negativa');
        }

        // Para herramientas, validar que la cantidad sea 1
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
        updateData.ubicacion = updateInventoryDto.ubicacion;
      }

      // Solo actualizar si hay cambios
      if (Object.keys(updateData).length > 0) {
        updateData.fechaUltimaActualizacion = new Date();
        
        // Aplicar los cambios
        Object.assign(inventory, updateData);
        await queryRunner.manager.save(inventory);

        // Si se actualizó la cantidad y es un insumo, actualizar su estado en Supply
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
      
      this.logger.log(`Inventario actualizado: ${id}`);
      
      return await this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number): Promise<void> {
    const inventory = await this.findOne(id);
    await this.inventoryRepository.softDelete(id);
    
    this.logger.log(`Inventario eliminado (soft): ${id} - ${inventory.nombreItem}`);
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

      // Guardar información antes de eliminar
      const deletedInfo: {
        inventory: {
          id: number;
          tipo: string;
          nombreItem: string;
          cantidadActual: number;
          ubicacion: string;
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
          cantidadActual: inventory.cantidadActual,
          ubicacion: inventory.ubicacion,
        },
        item: null,
      };

      // Obtener información del item asociado
      if (inventory.insumoId && inventory.supply) {
        deletedInfo.item = {
          tipo: 'insumo',
          id: inventory.insumoId,
          nombre: inventory.supply.nombre,
          categoria: inventory.supply.categoria,
        };
      } else if (inventory.herramientaId && inventory.tool) {
        deletedInfo.item = {
          tipo: 'herramienta',
          id: inventory.herramientaId,
          nombre: inventory.tool.nombre,
          marca: inventory.tool.marca || undefined,
        };
      }

      // Eliminar físicamente el inventario (esto activará CASCADE y eliminará el item asociado)
      await queryRunner.manager.remove(inventory);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Inventario eliminado completamente: ${id} - ${deletedInfo.inventory.nombreItem}`,
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
      .orWhere('supply.codigo ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('tool.codigo ILIKE :keyword', { keyword: `%${keyword}%` })
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
      .andWhere('inventory.insumo_id IS NOT NULL') // Solo insumos tienen stock
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

      // Solo se puede actualizar stock de insumos
      if (!inventory.insumoId) {
        throw new BadRequestException(
          'Solo se puede actualizar el stock de insumos',
        );
      }

      // Actualizar inventario
      inventory.cantidadActual = nuevaCantidad;
      inventory.fechaUltimaActualizacion = new Date();
      await queryRunner.manager.save(inventory);

      // Actualizar estado del insumo en Supply
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
      
      this.logger.log(
        `Stock actualizado: ${inventarioId} - Nueva cantidad: ${nuevaCantidad}`,
      );
      
      return await this.findOne(inventarioId);
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

      // Calculamos el valor total sumando (stock insumo * precio) + (precio herramienta)
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

      // Estadísticas por bodega
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

      // Estadísticas por estado
      const statsByEstado = await queryRunner.manager
        .createQueryBuilder(Inventory, 'inventory')
        .select('inventory.estado', 'estado')
        .addSelect('COUNT(inventory.inventario_id)', 'cantidad')
        .groupBy('inventory.estado')
        .orderBy('cantidad', 'DESC')
        .getRawMany();

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
    
    this.logger.log(`Inventario restaurado: ${id}`);
    
    return await this.findOne(id);
  }

  // Helper method para calcular estado de inventario
  private calcularEstado(cantidad: number, stockMin: number = 0): string {
    if (cantidad <= 0) return 'Sin Stock';
    if (stockMin > 0 && cantidad <= stockMin) return 'Stock Bajo';
    if (cantidad <= 5) return 'Stock Crítico';
    if (cantidad <= 10) return 'Stock Bajo';
    return 'Stock Óptimo';
  }

  // Helper method para calcular estado de insumo (SupplyStatus)
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
}