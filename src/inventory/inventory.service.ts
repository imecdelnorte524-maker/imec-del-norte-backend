import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Supply } from '../supplies/entities/supply.entity';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { SupplyStatus, ToolStatus } from 'src/shared/enums';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Supply)
    private supplyRepository: Repository<Supply>,
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

      // Verificar si el insumo existe
      let supply: Supply | null = null;
      let tool: Tool | null = null;

      if (createInventoryDto.insumoId) {
        supply = await queryRunner.manager.findOne(Supply, {
          where: { insumoId: createInventoryDto.insumoId },
        });
        if (!supply) {
          throw new NotFoundException(
            `Insumo con ID ${createInventoryDto.insumoId} no encontrado`,
          );
        }
      }

      // Verificar si el herramienta existe
      if (createInventoryDto.herramientaId) {
        tool = await queryRunner.manager.findOne(Tool, {
          where: { herramientaId: createInventoryDto.herramientaId },
        });
        if (!tool) {
          throw new NotFoundException(
            `Equipo con ID ${createInventoryDto.herramientaId} no encontrado`,
          );
        }
      }

      // Verificar si ya existe un registro de inventario para este item
      let existingItem: Inventory | null = null;

      if (createInventoryDto.insumoId) {
        existingItem = await queryRunner.manager.findOne(Inventory, {
          where: { insumoId: createInventoryDto.insumoId },
        });
      } else if (createInventoryDto.herramientaId) {
        existingItem = await queryRunner.manager.findOne(Inventory, {
          where: { herramientaId: createInventoryDto.herramientaId },
        });
      }

      if (existingItem) {
        throw new ConflictException(
          `Ya existe un registro de inventario para este ${createInventoryDto.insumoId ? 'insumo' : 'herramienta'}`,
        );
      }

      // Crear el registro de inventario
      const inventoryData: Partial<Inventory> = {
        insumoId: createInventoryDto.insumoId,
        herramientaId: createInventoryDto.herramientaId,
        cantidadActual: createInventoryDto.cantidadActual || 0,
        ubicacion: createInventoryDto.ubicacion || undefined,
        fechaUltimaActualizacion: new Date(),
      };

      const inventory = queryRunner.manager.create(Inventory, inventoryData);

      // Asignar relaciones
      if (supply) {
        inventory.supply = supply;
      }

      if (tool) {
        inventory.tool = tool;

        // Para equipos, la cantidad siempre debe ser 1
        if (inventoryData.cantidadActual !== 1) {
          throw new BadRequestException(
            'Los equipos siempre deben tener cantidad 1 en inventario',
          );
        }
      }

      const savedInventory = await queryRunner.manager.save(inventory);

      // Si es un insumo, actualizar su estado basado en la cantidad
      if (supply && savedInventory.cantidadActual !== undefined) {
        const estado = this.calculateSupplyStatus(
          savedInventory.cantidadActual,
          supply.stockMin,
        );
        await queryRunner.manager.update(Supply, supply.insumoId, {
          estado: estado as SupplyStatus,
        });
      }

      await queryRunner.commitTransaction();
      return await this.findOne(savedInventory.inventarioId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Inventory[]> {
    return await this.inventoryRepository.find({
      relations: ['supply', 'tool'],
      order: { fechaUltimaActualizacion: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Inventory> {
    const inventory = await this.inventoryRepository.findOne({
      where: { inventarioId: id },
      relations: ['supply', 'tool'],
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

      // Validar que no se intente cambiar el tipo de item
      if (
        (updateInventoryDto.insumoId && inventory.herramientaId) ||
        (updateInventoryDto.herramientaId && inventory.insumoId)
      ) {
        throw new BadRequestException(
          'No se puede cambiar el tipo de item del registro de inventario',
        );
      }

      // También verificar que no se envíen ambos IDs
      if (updateInventoryDto.insumoId && updateInventoryDto.herramientaId) {
        throw new BadRequestException(
          'Solo se puede proporcionar insumoId o herramientaId, no ambos',
        );
      }

      const updateData: Partial<Inventory> = {
        fechaUltimaActualizacion: new Date(),
      };

      if (updateInventoryDto.cantidadActual !== undefined) {
        updateData.cantidadActual = updateInventoryDto.cantidadActual;

        // Para equipos, validar que la cantidad sea 1
        if (
          inventory.herramientaId &&
          updateInventoryDto.cantidadActual !== 1
        ) {
          throw new BadRequestException(
            'Los equipos siempre deben tener cantidad 1 en inventario',
          );
        }
      }

      if (updateInventoryDto.ubicacion !== undefined) {
        updateData.ubicacion = updateInventoryDto.ubicacion || undefined;
      }

      await queryRunner.manager.update(Inventory, id, updateData);

      // Si es un insumo, actualizar su estado basado en la nueva cantidad
      if (
        inventory.insumoId &&
        updateInventoryDto.cantidadActual !== undefined
      ) {
        const supply = await queryRunner.manager.findOne(Supply, {
          where: { insumoId: inventory.insumoId },
        });

        if (supply) {
          const estado = this.calculateSupplyStatus(
            updateInventoryDto.cantidadActual,
            supply.stockMin,
          );
          await queryRunner.manager.update(Supply, supply.insumoId, {
            estado: estado as SupplyStatus,
          });
        }
      }

      // Si es una herramienta, actualizar su estado si se proporcionó
      if (inventory.herramientaId && updateInventoryDto.estado !== undefined) {
        const tool = await queryRunner.manager.findOne(Tool, {
          where: { herramientaId: inventory.herramientaId },
        });

        if (tool) {
          // Validar que el estado sea uno de los permitidos
          const estadosPermitidos = Object.values(ToolStatus);
          if (!estadosPermitidos.includes(updateInventoryDto.estado as ToolStatus)) {
            throw new BadRequestException(
              `Estado inválido para herramienta. Estados permitidos: ${estadosPermitidos.join(', ')}`,
            );
          }

          await queryRunner.manager.update(
            Tool,
            { herramientaId: inventory.herramientaId },
            { estado: updateInventoryDto.estado as any },
          );
        }
      }

      await queryRunner.commitTransaction();
      return await this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const inventory = await this.findOne(id);

      // NOTA: Al eliminar el inventario, se eliminarán automáticamente
      // el Tool o Supply relacionados debido a la configuración CASCADE
      await queryRunner.manager.remove(inventory);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async removeComplete(inventarioId: number): Promise<{
    deletedInventory: any;
    deletedItem: any;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const inventory = await this.findOne(inventarioId);

      // Guardar información antes de eliminar
      const deletedInfo: {
        inventory: {
          id: number;
          tipo: string;
          nombreItem: string;
          cantidadActual: number;
          ubicacion: string | undefined;
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
          marca: inventory.tool.marca,
        };
      }

      // Eliminar el inventario (esto activará CASCADE y eliminará el item asociado)
      await queryRunner.manager.remove(inventory);

      await queryRunner.commitTransaction();

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
      .where('supply.nombre ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('tool.nombre ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('inventory.ubicacion ILIKE :keyword', {
        keyword: `%${keyword}%`,
      })
      .orderBy('inventory.fecha_ultima_actualizacion', 'DESC')
      .getMany();
  }

  async getInventoryByLocation(ubicacion: string): Promise<Inventory[]> {
    return await this.inventoryRepository.find({
      where: { ubicacion: ILike(`%${ubicacion}%`) },
      relations: ['supply', 'tool'],
      order: { fechaUltimaActualizacion: 'DESC' },
    });
  }

  async getLowStockItems(threshold: number = 5): Promise<Inventory[]> {
    return await this.inventoryRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.supply', 'supply')
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

      // Actualizar estado del insumo
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

      const equipmentCount = await queryRunner.manager
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
          `
          SUM(
            COALESCE(supply.valor_unitario, 0) * 
            COALESCE(inventory.cantidad_actual, 0) + 
            COALESCE(tool.valor_unitario, 0)
          )`,
          'total',
        )
        .getRawOne();

      return {
        totalItems,
        suppliesCount,
        equipmentCount,
        lowStockCount,
        totalValue: parseFloat(totalValue?.total || '0'),
      };
    } finally {
      await queryRunner.release();
    }
  }

  // Helper method para calcular estado de insumo
  private calculateSupplyStatus(
    cantidad: number,
    stockMin: number = 0,
  ): SupplyStatus {
    if (cantidad === 0) {
      return SupplyStatus.AGOTADO; // 'Agotado'
    } else if (stockMin > 0 && cantidad <= stockMin) {
      return SupplyStatus.STOCK_BAJO; // 'Stock Bajo'
    } else {
      return SupplyStatus.DISPONIBLE; // 'Disponible'
    }
  }
}