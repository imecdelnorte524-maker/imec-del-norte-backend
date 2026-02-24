// src/tools/tool.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, IsNull } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { CreateToolDto } from './dto/create-tools.dto';
import { UpdateToolDto } from './dto/update-tools.dto';
import { DeleteToolDto } from './dto/delete-tool.dto';
import { ToolStatus, ToolType } from '../shared/index';
import { ImagesService } from '../images/images.service';
import { SequenceHelperService } from '../common/services/sequence-helper.service';
import { WebsocketGateway } from '../websockets/websocket.gateway';

@Injectable()
export class ToolService {
  private readonly logger = new Logger(ToolService.name);
  private readonly tableName = 'herramientas';
  private readonly idColumn = 'herramienta_id';

  constructor(
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    private dataSource: DataSource,
    private readonly imagesService: ImagesService,
    private readonly sequenceHelper: SequenceHelperService,
    private readonly websocketGateway: WebsocketGateway,
  ) {
    // Verificar secuencia al inicializar
    this.initializeSequence().catch((error) => {
      this.logger.warn(
        `No se pudo inicializar secuencia de herramientas: ${error.message}`,
      );
    });
  }

  /**
   * Inicializa y corrige la secuencia de herramienta_id
   */
  private async initializeSequence(): Promise<void> {
    try {
      const sequenceInfo = await this.sequenceHelper.checkAndFixSequence(
        this.tableName,
        this.idColumn,
      );

      if (sequenceInfo.corrected) {
        this.logger.log(
          `✅ Secuencia de herramientas corregida: ${sequenceInfo.lastValue - 1} → ${sequenceInfo.maxId}`,
        );
      } else {
        this.logger.log(
          `✓ Secuencia de herramientas OK. Último valor: ${sequenceInfo.lastValue}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `⚠️ No se pudo inicializar secuencia de herramientas: ${error.message}`,
      );
    }
  }

  /**
   * Corrige la secuencia si está desincronizada
   */
  async fixSequenceIfNeeded(): Promise<{
    corrected: boolean;
    message: string;
  }> {
    try {
      const sequenceInfo = await this.sequenceHelper.checkAndFixSequence(
        this.tableName,
        this.idColumn,
      );

      if (sequenceInfo.corrected) {
        return {
          corrected: true,
          message: `✅ Secuencia de herramientas corregida: ${sequenceInfo.lastValue - 1} → ${sequenceInfo.maxId}`,
        };
      }

      return {
        corrected: false,
        message: 'Secuencia de herramientas ya está actualizada',
      };
    } catch (error) {
      const errorMessage = `❌ Error corrigiendo secuencia de herramientas: ${error.message}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Diagnóstico completo de la tabla de herramientas
   */
  async diagnoseTable(): Promise<any> {
    try {
      const diagnosis = await this.sequenceHelper.diagnoseTable(
        this.tableName,
        this.idColumn,
        undefined,
        ['serial'], // columnas que deberían ser únicas
      );

      // Información adicional específica de herramientas
      const stats = await this.getEquipmentStats();

      return {
        sequence: diagnosis.sequence,
        uniqueConstraints: diagnosis.uniqueConstraints,
        duplicateData: diagnosis.duplicateData,
        stats,
        recommendations:
          diagnosis.duplicateData.length > 0
            ? ['Existen valores duplicados que podrían violar constraints']
            : [],
      };
    } catch (error) {
      this.logger.error('Error en diagnóstico de herramientas:', error);
      throw error;
    }
  }

  async create(createToolDto: CreateToolDto): Promise<Tool> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar secuencia antes de crear
      await this.fixSequenceIfNeeded();

      // Validar serial único (si se proporciona)
      if (createToolDto.serial) {
        const existing = await queryRunner.manager.findOne(Tool, {
          where: { serial: createToolDto.serial },
        });
        if (existing) {
          throw new ConflictException('El número de serie ya está registrado');
        }
      }

      // Buscar bodega si se proporciona
      let bodega: Warehouse | null = null;
      if (createToolDto.bodegaId) {
        bodega = await queryRunner.manager.findOne(Warehouse, {
          where: { bodegaId: createToolDto.bodegaId },
        });
        if (!bodega) {
          throw new NotFoundException('Bodega no encontrada');
        }
      }

      // ===== 1. CREAR LA HERRAMIENTA =====
      const toolData: Partial<Tool> = {
        nombre: createToolDto.nombre,
        marca: createToolDto.marca ?? null,
        serial: createToolDto.serial ?? null,
        modelo: createToolDto.modelo ?? null,
        caracteristicasTecnicas: createToolDto.caracteristicasTecnicas ?? null,
        observacion: createToolDto.observacion ?? null,
        tipo: createToolDto.tipo as ToolType,
        estado: createToolDto.estado as ToolStatus,
        valorUnitario: createToolDto.valorUnitario,
      };

      const tool = queryRunner.manager.create(Tool, toolData);
      const savedTool = await queryRunner.manager.save(tool);

      // ===== 2. MANEJO DEL INVENTARIO =====
      const existingInventory = await queryRunner.manager.findOne(Inventory, {
        where: { herramientaId: savedTool.herramientaId },
      });

      let inventory: Inventory;

      if (existingInventory) {
        this.logger.warn(
          `⚠️ Inventario ya existente para herramienta ${savedTool.herramientaId}, actualizando...`,
        );

        existingInventory.cantidadActual = 1; // Siempre 1 para herramientas
        existingInventory.fechaUltimaActualizacion = new Date();
        existingInventory.bodega = bodega;
        existingInventory.tool = savedTool;

        inventory = await queryRunner.manager.save(existingInventory);
      } else {
        // Crear nuevo inventario
        const inventoryData: Partial<Inventory> = {
          herramientaId: savedTool.herramientaId,
          cantidadActual: 1, // Siempre 1 para herramientas
          bodega: bodega,
          ubicacion: createToolDto.ubicacion ?? null,
          fechaUltimaActualizacion: new Date(),
          tool: savedTool,
        };

        inventory = queryRunner.manager.create(Inventory, inventoryData);

        try {
          inventory = await queryRunner.manager.save(inventory);
        } catch (error) {
          if ((error as any).code === '23505') {
            this.logger.error(
              `Error de duplicado al crear inventario: ${(error as any).detail}`,
            );

            const recoveredInventory = await queryRunner.manager.findOne(
              Inventory,
              {
                where: { herramientaId: savedTool.herramientaId },
              },
            );

            if (recoveredInventory) {
              this.logger.log(
                `✅ Inventario recuperado para herramienta ${savedTool.herramientaId}`,
              );
              inventory = recoveredInventory;

              recoveredInventory.cantidadActual = 1;
              recoveredInventory.fechaUltimaActualizacion = new Date();
              recoveredInventory.bodega = bodega;
              recoveredInventory.tool = savedTool;

              inventory = await queryRunner.manager.save(recoveredInventory);
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }

      // ===== 3. ASOCIAR INVENTARIO A LA HERRAMIENTA =====
      savedTool.inventory = inventory;
      await queryRunner.manager.save(savedTool);

      // ===== 4. COMMIT DE LA TRANSACCIÓN =====
      await queryRunner.commitTransaction();

      // ===== 5. OBTENER LA HERRAMIENTA COMPLETA CON RELACIONES =====
      const full = await this.findOne(savedTool.herramientaId);

      // ===== 6. EMITIR EVENTO WEBSOCKET =====
      this.websocketGateway.emit('tools.created', full);

      return full;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      if (error.code === '23505') {
        if (error.constraint === 'herramientas_pkey') {
          this.logger.warn(
            '⚠️ Error de duplicado en PK de herramientas, corrigiendo secuencia...',
          );
          await this.fixSequenceIfNeeded();
          throw new ConflictException(
            'Error de duplicación en ID. La secuencia ha sido corregida. Intente nuevamente.',
          );
        }

        const uniqueError =
          await this.sequenceHelper.handleUniqueConstraintError(error);
        if (uniqueError.suggestion) {
          throw new ConflictException(
            `${uniqueError.message}. ${uniqueError.suggestion}`,
          );
        }
        throw new ConflictException(uniqueError.message);
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(includeDeleted = false): Promise<Tool[]> {
    const options: any = {
      relations: ['inventory', 'inventory.bodega', 'images'],
      order: { fechaRegistro: 'DESC' },
    };

    if (includeDeleted) {
      options.withDeleted = true;
    }

    return this.toolRepository.find(options);
  }

  async findOne(id: number, includeDeleted = false): Promise<Tool> {
    const options: any = {
      where: { herramientaId: id },
      relations: ['inventory', 'inventory.bodega', 'images'],
    };

    if (includeDeleted) {
      options.withDeleted = true;
    }

    const tool = await this.toolRepository.findOne(options);

    if (!tool) {
      throw new NotFoundException(`Herramienta con ID ${id} no encontrada`);
    }

    return tool;
  }

  async update(id: number, updateToolDto: UpdateToolDto): Promise<Tool> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tool = await this.findOne(id);

      // Validar serial único si se cambia
      if (updateToolDto.serial && updateToolDto.serial !== tool.serial) {
        const existing = await queryRunner.manager.findOne(Tool, {
          where: { serial: updateToolDto.serial ?? '' },
        });
        if (existing) {
          throw new ConflictException('El número de serie ya está registrado');
        }
      }

      // Actualizar datos básicos de la herramienta
      const updateData: Partial<Tool> = {};

      if (updateToolDto.nombre !== undefined)
        updateData.nombre = updateToolDto.nombre;
      if (updateToolDto.marca !== undefined)
        updateData.marca = updateToolDto.marca ?? null;
      if (updateToolDto.serial !== undefined)
        updateData.serial = updateToolDto.serial ?? null;
      if (updateToolDto.modelo !== undefined)
        updateData.modelo = updateToolDto.modelo ?? null;
      if (updateToolDto.caracteristicasTecnicas !== undefined)
        updateData.caracteristicasTecnicas =
          updateToolDto.caracteristicasTecnicas ?? null;
      if (updateToolDto.observacion !== undefined)
        updateData.observacion = updateToolDto.observacion ?? null;
      if (updateToolDto.tipo !== undefined)
        updateData.tipo = updateToolDto.tipo as ToolType;
      if (updateToolDto.estado !== undefined)
        updateData.estado = updateToolDto.estado as ToolStatus;
      if (updateToolDto.valorUnitario !== undefined)
        updateData.valorUnitario = updateToolDto.valorUnitario;

      if (Object.keys(updateData).length > 0) {
        await queryRunner.manager.update(Tool, id, updateData);
      }

      // Actualizar bodega en el inventario
      if (updateToolDto.bodegaId !== undefined && tool.inventory) {
        const inventoryUpdate: Partial<Inventory> = {
          fechaUltimaActualizacion: new Date(),
        };

        if (updateToolDto.bodegaId === null) {
          inventoryUpdate.bodega = null;
        } else {
          const bodega = await queryRunner.manager.findOne(Warehouse, {
            where: { bodegaId: updateToolDto.bodegaId },
          });
          if (!bodega) {
            throw new NotFoundException('Bodega no encontrada');
          }
          inventoryUpdate.bodega = bodega;
        }

        await queryRunner.manager.update(
          Inventory,
          tool.inventory.inventarioId,
          inventoryUpdate,
        );
      }

      // Commit de la transacción antes de recargar la herramienta
      await queryRunner.commitTransaction();

      const updated = await this.findOne(id);

      // WebSocket
      this.websocketGateway.emit('tools.updated', updated);

      return updated;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      if (error.code === '23505') {
        const uniqueError =
          await this.sequenceHelper.handleUniqueConstraintError(error);
        if (uniqueError.suggestion) {
          throw new ConflictException(
            `${uniqueError.message}. ${uniqueError.suggestion}`,
          );
        }
        throw new ConflictException(uniqueError.message);
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number): Promise<void> {
    const tool = await this.findOne(id);

    // Eliminar imágenes asociadas
    await this.imagesService.deleteByTool(tool);

    // Eliminación física (solo administrador)
    await this.toolRepository.delete(id);

    // WebSocket
    this.websocketGateway.emit('tools.deleted', { id, soft: false });
  }

  async softDeleteWithReason(id: number, dto: DeleteToolDto): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tool = await this.findOne(id);

      // Verificar si está en uso en órdenes de trabajo
      const hasWorkOrders = await queryRunner.manager
        .createQueryBuilder(Tool, 'tool')
        .innerJoin('tool.toolDetails', 'toolDetail')
        .where('tool.herramienta_id = :id', { id })
        .getCount();

      if (hasWorkOrders > 0) {
        throw new ConflictException(
          'No se puede eliminar la herramienta porque está siendo utilizada en órdenes de trabajo',
        );
      }

      // Actualizar estado y motivo
      const toolUpdate: Partial<Tool> = {
        estado: ToolStatus.RETIRADO,
        motivoEliminacion: dto.motivo,
        observacionEliminacion: dto.observacion ?? null,
      };

      await queryRunner.manager.update(Tool, id, toolUpdate);

      // Soft delete de la herramienta
      await queryRunner.manager.softDelete(Tool, id);

      // Soft delete del inventario asociado
      const inventory = await queryRunner.manager.findOne(Inventory, {
        where: { herramientaId: id },
      });

      if (inventory) {
        await queryRunner.manager.softDelete(Inventory, inventory.inventarioId);
      }

      await queryRunner.commitTransaction();

      // WebSocket
      this.websocketGateway.emit('tools.softDeleted', {
        id,
        motivo: dto.motivo,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async restore(id: number): Promise<Tool> {
    const tool = await this.toolRepository.findOne({
      where: { herramientaId: id },
      withDeleted: true,
    });

    if (!tool) {
      throw new NotFoundException(`Herramienta con ID ${id} no encontrada`);
    }

    // Restaurar herramienta
    await this.toolRepository.restore(id);

    // Restaurar inventario si existe
    const inventory = await this.inventoryRepository.findOne({
      where: { herramientaId: id },
      withDeleted: true,
    });

    if (inventory) {
      await this.inventoryRepository.restore(inventory.inventarioId);
    }

    // Limpiar campos de eliminación
    const toolUpdate: Partial<Tool> = {
      motivoEliminacion: null,
      observacionEliminacion: null,
      estado: ToolStatus.DISPONIBLE,
    };

    await this.toolRepository.update(id, toolUpdate);

    const restored = await this.findOne(id);

    // WebSocket
    this.websocketGateway.emit('tools.restored', restored);
    this.websocketGateway.emit('tools.updated', restored);

    return restored;
  }

  async updateStatus(id: number, estado: string): Promise<Tool> {
    const validStatuses = Object.values(ToolStatus);

    if (!validStatuses.includes(estado as ToolStatus)) {
      throw new BadRequestException(
        `Estado inválido. Estados válidos: ${validStatuses.join(', ')}`,
      );
    }

    await this.findOne(id); // Verifica existencia

    await this.toolRepository.update(id, {
      estado: estado as ToolStatus,
    });

    const updated = await this.findOne(id);

    // WebSocket
    this.websocketGateway.emit('tools.statusUpdated', updated);
    this.websocketGateway.emit('tools.updated', updated);

    return updated;
  }

  async searchEquipment(
    keyword: string,
    includeDeleted = false,
  ): Promise<Tool[]> {
    const queryBuilder = this.toolRepository
      .createQueryBuilder('tool')
      .leftJoinAndSelect('tool.inventory', 'inventory')
      .leftJoinAndSelect('inventory.bodega', 'bodega')
      .leftJoinAndSelect('tool.images', 'images')
      .where('tool.nombre ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('tool.serial ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('tool.marca ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('tool.modelo ILIKE :keyword', { keyword: `%${keyword}%` })
      .orderBy('tool.nombre', 'ASC');

    if (includeDeleted) {
      queryBuilder.withDeleted();
    }

    return queryBuilder.getMany();
  }

  async getEquipmentByStatus(estado: string): Promise<Tool[]> {
    return this.toolRepository.find({
      where: { estado: estado as ToolStatus },
      relations: ['inventory', 'inventory.bodega', 'images'],
      order: { nombre: 'ASC' },
    });
  }

  async getEquipmentByType(tipo: string): Promise<Tool[]> {
    return this.toolRepository.find({
      where: { tipo: tipo as ToolType },
      relations: ['inventory', 'inventory.bodega', 'images'],
      order: { nombre: 'ASC' },
    });
  }

  async getDeleted(): Promise<Tool[]> {
    return this.toolRepository.find({
      where: { fechaEliminacion: Not(IsNull()) },
      relations: ['inventory', 'inventory.bodega', 'images'],
      withDeleted: true,
      order: { fechaEliminacion: 'DESC' },
    });
  }

  async getEquipmentStats(): Promise<any> {
    const total = await this.toolRepository.count();
    const disponibles = await this.toolRepository.count({
      where: { estado: ToolStatus.DISPONIBLE },
    });
    const enUso = await this.toolRepository.count({
      where: { estado: ToolStatus.EN_USO },
    });
    const enMantenimiento = await this.toolRepository.count({
      where: { estado: ToolStatus.EN_MANTENIMIENTO },
    });
    const dañados = await this.toolRepository.count({
      where: { estado: ToolStatus.DAÑADO },
    });
    const retirados = await this.toolRepository.count({
      where: { estado: ToolStatus.RETIRADO },
    });

    const totalValue = await this.toolRepository
      .createQueryBuilder('tool')
      .select('SUM(tool.valor_unitario)', 'total')
      .getRawOne();

    return {
      total,
      disponibles,
      enUso,
      enMantenimiento,
      dañados,
      retirados,
      totalValue: parseFloat(totalValue?.total) || 0,
    };
  }

  async findBySerial(serial: string): Promise<Tool | null> {
    return this.toolRepository.findOne({
      where: { serial },
      relations: ['inventory', 'inventory.bodega', 'images'],
    });
  }
}
