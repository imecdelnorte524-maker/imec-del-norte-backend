import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { CreateToolDto } from './dto/create-tools.dto';
import { UpdateToolDto } from './dto/update-tools.dto';
import { ToolStatus, ToolType } from '../shared/enums/inventory.enum';
import { ImagesService } from 'src/images/images.service';

@Injectable()
export class ToolService {
  private readonly logger = new Logger(ToolService.name);

  constructor(
    @InjectRepository(Tool)
    private equipmentRepository: Repository<Tool>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    private dataSource: DataSource,
    private readonly imagesService: ImagesService,
  ) {}

  async create(createToolDto: CreateToolDto): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (createToolDto.serial) {
        const existingEquipment = await queryRunner.manager.findOne(Tool, {
          where: { serial: createToolDto.serial },
        });
        if (existingEquipment) {
          throw new ConflictException('El número de serie ya está registrado');
        }
      }

      const equipmentData = {
        nombre: createToolDto.nombre,
        marca: createToolDto.marca ?? undefined,
        serial: createToolDto.serial ?? undefined,
        modelo: createToolDto.modelo ?? undefined,
        caracteristicasTecnicas:
          createToolDto.caracteristicasTecnicas ?? undefined,
        observacion: createToolDto.observacion ?? undefined,
        tipo: createToolDto.tipo as ToolType,
        estado: createToolDto.estado as ToolStatus,
        valorUnitario: createToolDto.valorUnitario,
      };

      const tool = queryRunner.manager.create(Tool, equipmentData);
      const savedEquipment = await queryRunner.manager.save(tool);

      this.logger.log(
        `📦 Equipo creado con ID: ${savedEquipment.herramientaId}`,
      );

      const inventoryData: Partial<Inventory> = {
        herramientaId: savedEquipment.herramientaId,
        cantidadActual: 1,
        ubicacion: createToolDto.ubicacion ?? undefined,
        fechaUltimaActualizacion: new Date(),
      };

      const inventory = queryRunner.manager.create(Inventory, inventoryData);
      inventory.tool = savedEquipment;

      const savedInventory = await queryRunner.manager.save(inventory);

      this.logger.log(
        `📊 Inventario creado con ID: ${savedInventory.inventarioId} para herramienta ID: ${savedEquipment.herramientaId}`,
      );

      savedEquipment.inventory = savedInventory;
      await queryRunner.manager.save(savedEquipment);

      this.logger.log(
        `✅ Herramienta actualizada con inventarioId: ${savedInventory.inventarioId}`,
      );

      await queryRunner.commitTransaction();

      const result = await this.equipmentRepository.findOne({
        where: { herramientaId: savedEquipment.herramientaId },
        relations: ['inventory'],
      });

      if (!result) {
        throw new NotFoundException(
          `Equipo con ID ${savedEquipment.herramientaId} no encontrado después de crear`,
        );
      }

      this.logger.log(
        `✅ Equipo creado exitosamente: ${result.nombre} (ID: ${result.herramientaId})`,
      );

      return {
        ...result,
        inventoryId:
          result.inventory?.inventarioId || savedInventory.inventarioId,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error creando herramienta: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<any[]> {
    const equipmentList = await this.equipmentRepository.find({
      relations: ['inventory'],
      order: { fechaRegistro: 'DESC' },
    });

    return equipmentList.map((tool) => ({
      ...tool,
      inventoryId: tool.inventory?.inventarioId || null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const tool = await this.equipmentRepository.findOne({
      where: { herramientaId: id },
      relations: ['inventory'],
    });

    if (!tool) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }

    return {
      ...tool,
      inventoryId: tool.inventory?.inventarioId || null,
    };
  }

  async findBySerial(serial: string): Promise<any> {
    const tool = await this.equipmentRepository.findOne({
      where: { serial },
      relations: ['inventory'],
    });

    if (!tool) return null;

    return {
      ...tool,
      inventoryId: tool.inventory?.inventarioId || null,
    };
  }

  async update(id: number, updateToolDto: UpdateToolDto): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tool = await this.findOne(id);

      if (updateToolDto.serial && updateToolDto.serial !== tool.serial) {
        const existingEquipment = await this.findBySerial(
          updateToolDto.serial,
        );
        if (existingEquipment) {
          throw new ConflictException('El número de serie ya está registrado');
        }
      }

      const updateData: Partial<Tool> = {};

      if (updateToolDto.nombre !== undefined) {
        updateData.nombre = updateToolDto.nombre;
      }
      if (updateToolDto.marca !== undefined) {
        updateData.marca = updateToolDto.marca;
      }
      if (updateToolDto.serial !== undefined) {
        updateData.serial = updateToolDto.serial;
      }
      if (updateToolDto.modelo !== undefined) {
        updateData.modelo = updateToolDto.modelo;
      }
      if (updateToolDto.caracteristicasTecnicas !== undefined) {
        updateData.caracteristicasTecnicas =
          updateToolDto.caracteristicasTecnicas;
      }
      if (updateToolDto.observacion !== undefined) {
        updateData.observacion = updateToolDto.observacion;
      }
      if (updateToolDto.tipo !== undefined) {
        updateData.tipo = updateToolDto.tipo as ToolType;
      }
      if (updateToolDto.estado !== undefined) {
        updateData.estado = updateToolDto.estado as ToolStatus;
      }
      if (updateToolDto.valorUnitario !== undefined) {
        updateData.valorUnitario = updateToolDto.valorUnitario;
      }

      if (Object.keys(updateData).length > 0) {
        await queryRunner.manager.update(Tool, id, updateData);
      }

      if (updateToolDto.ubicacion !== undefined) {
        const inventory = await queryRunner.manager.findOne(Inventory, {
          where: { herramientaId: id },
        });

        if (inventory) {
          const inventoryUpdate: Partial<Inventory> = {
            fechaUltimaActualizacion: new Date(),
            ubicacion: updateToolDto.ubicacion || undefined,
          };

          await queryRunner.manager.update(
            Inventory,
            inventory.inventarioId,
            inventoryUpdate,
          );
        }
      }

      await queryRunner.commitTransaction();

      const updatedEquipment = await this.findOne(id);
      this.logger.log(
        `✅ Equipo actualizado: ${updatedEquipment.nombre} (ID: ${id})`,
      );

      return updatedEquipment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `❌ Error actualizando herramienta ID ${id}: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tool = await this.findOne(id);
      const equipmentName = tool.nombre;

      // Borrar imágenes Cloudinary + BD
      await this.imagesService.deleteByTool(tool);

      const hasWorkOrders = await queryRunner.manager
        .createQueryBuilder(Tool, 'tool')
        .innerJoin('tool.toolDetails', 'toolDetail')
        .where('tool.herramienta_id = :id', { id })
        .getCount();

      if (hasWorkOrders > 0) {
        throw new ConflictException(
          'No se puede eliminar la herramienta porque está siendo usada en órdenes de trabajo',
        );
      }

      const inventory = await queryRunner.manager.findOne(Inventory, {
        where: { herramientaId: id },
      });

      if (inventory) {
        await queryRunner.manager.remove(inventory);
        this.logger.log(`🗑️ Inventario eliminado: ${inventory.inventarioId}`);
      }

      await queryRunner.manager.remove(tool);

      await queryRunner.commitTransaction();

      this.logger.log(`🗑️ Equipo eliminado: ${equipmentName} (ID: ${id})`);

      return {
        message: `Equipo "${equipmentName}" eliminado exitosamente`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `❌ Error eliminando herramienta ID ${id}: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async searchEquipment(keyword: string): Promise<any[]> {
    const equipmentList = await this.equipmentRepository
      .createQueryBuilder('tool')
      .leftJoinAndSelect('tool.inventory', 'inventory')
      .where('tool.nombre ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('tool.marca ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('tool.modelo ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('tool.serial ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('tool.tipo::text ILIKE :keyword', { keyword: `%${keyword}%` })
      .orderBy('tool.nombre', 'ASC')
      .getMany();

    return equipmentList.map((tool) => ({
      ...tool,
      inventoryId: tool.inventory?.inventarioId || null,
    }));
  }

  async getEquipmentByStatus(estado: string): Promise<any[]> {
    const equipmentList = await this.equipmentRepository.find({
      where: { estado: estado as ToolStatus },
      relations: ['inventory'],
      order: { nombre: 'ASC' },
    });

    return equipmentList.map((tool) => ({
      ...tool,
      inventoryId: tool.inventory?.inventarioId || null,
    }));
  }

  async getEquipmentByType(tipo: string): Promise<any[]> {
    const equipmentList = await this.equipmentRepository.find({
      where: { tipo: tipo as ToolType },
      relations: ['inventory'],
      order: { nombre: 'ASC' },
    });

    return equipmentList.map((tool) => ({
      ...tool,
      inventoryId: tool.inventory?.inventarioId || null,
    }));
  }

  async updateStatus(id: number, estado: string): Promise<any> {
    const validStatuses = Object.values(ToolStatus);

    if (!validStatuses.includes(estado as ToolStatus)) {
      throw new BadRequestException(
        `Estado inválido. Los estados válidos son: ${validStatuses.join(', ')}`,
      );
    }

    const tool = await this.findOne(id);
    tool.estado = estado as ToolStatus;

    const updated = await this.equipmentRepository.save(tool);

    this.logger.log(`✅ Estado actualizado para herramienta ID ${id}: ${estado}`);

    return {
      ...updated,
      inventoryId: tool.inventoryId,
    };
  }

  async getEquipmentStats(): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const total = await queryRunner.manager.count(Tool);

      const stats = await queryRunner.manager
        .createQueryBuilder(Tool, 'tool')
        .leftJoin('tool.inventory', 'inventory')
        .select('tool.estado', 'estado')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(tool.valor_unitario)', 'totalValue')
        .groupBy('tool.estado')
        .getRawMany();

      const totalValue = await queryRunner.manager
        .createQueryBuilder(Tool, 'tool')
        .select('SUM(tool.valor_unitario)', 'total')
        .getRawOne();

      return {
        total,
        totalValue: parseFloat(totalValue?.total) || 0,
        byStatus: stats,
      };
    } finally {
      await queryRunner.release();
    }
  }
}