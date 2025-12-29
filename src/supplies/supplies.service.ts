import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Supply } from './entities/supply.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import {
  SupplyStatus,
  SupplyCategory,
  UnitOfMeasure,
} from '../shared/enums/inventory.enum';
import { ImagesService } from '../images/images.service';

@Injectable()
export class SuppliesService {
  private readonly logger = new Logger(SuppliesService.name);

  constructor(
    @InjectRepository(Supply)
    private suppliesRepository: Repository<Supply>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    private dataSource: DataSource,
    private readonly imagesService: ImagesService,
  ) {}

  async create(dto: CreateSupplyDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validar nombre único
      const exists = await queryRunner.manager.findOne(Supply, {
        where: { nombre: dto.nombre },
      });
      if (exists) throw new ConflictException('El nombre ya existe');

      // Crear insumo
      const supply = queryRunner.manager.create(Supply, {
        nombre: dto.nombre,
        categoria: dto.categoria as SupplyCategory,
        unidadMedida: dto.unidadMedida as UnitOfMeasure,
        estado: SupplyStatus.DISPONIBLE,
        stockMin: dto.stockMin ?? 0,
        valorUnitario: dto.valorUnitario,
      });

      const savedSupply = await queryRunner.manager.save(supply);

      // Crear inventario asociado al insumo
      const inventory = queryRunner.manager.create(Inventory, {
        insumoId: savedSupply.insumoId,
        cantidadActual: dto.cantidadInicial ?? 0,
        ubicacion: dto.ubicacion,
        fechaUltimaActualizacion: new Date(),
        supply: savedSupply, // relación desde inventario hacia insumo
      });

      const savedInventory = await queryRunner.manager.save(inventory);

      // IMPORTANTE: asociar inventario al insumo para rellenar columna inventario_id en 'insumos'
      savedSupply.inventory = savedInventory;

      // Calcular y actualizar estado del insumo según stock
      savedSupply.estado = this.calculateSupplyStatus(
        savedInventory.cantidadActual,
        savedSupply.stockMin,
      );

      await queryRunner.manager.save(savedSupply);

      await queryRunner.commitTransaction();
      return this.findOne(savedSupply.insumoId);
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    return this.suppliesRepository.find({ relations: ['inventory'] });
  }

  async findOne(id: number) {
    const supply = await this.suppliesRepository.findOne({
      where: { insumoId: id },
      relations: ['inventory'],
    });
    if (!supply) throw new NotFoundException('Insumo no encontrado');
    return supply;
  }

  async update(id: number, dto: UpdateSupplyDto) {
    const supply = await this.findOne(id);

    if (dto.nombre && dto.nombre !== supply.nombre) {
      const exists = await this.suppliesRepository.findOne({
        where: { nombre: dto.nombre },
      });
      if (exists) throw new ConflictException('Nombre duplicado');
    }

    Object.assign(supply, dto);
    await this.suppliesRepository.save(supply);

    if (dto.cantidadActual !== undefined) {
      await this.updateStock(id, dto.cantidadActual);
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const supply = await this.findOne(id);

    // Borra imágenes en Cloudinary + BD
    await this.imagesService.deleteBySupply(supply);

    await this.suppliesRepository.remove(supply);
    this.logger.log(`🗑️ Insumo eliminado ID ${id}`);
  }

  async updateStock(id: number, cantidad: number) {
    if (cantidad < 0) throw new BadRequestException('Cantidad inválida');

    const inventory = await this.inventoryRepository.findOne({
      where: { insumoId: id },
    });
    if (!inventory) throw new NotFoundException('Inventario no encontrado');

    inventory.cantidadActual = cantidad;
    inventory.fechaUltimaActualizacion = new Date();
    await this.inventoryRepository.save(inventory);

    const supply = await this.findOne(id);
    supply.estado = this.calculateSupplyStatus(cantidad, supply.stockMin);
    await this.suppliesRepository.save(supply);

    return supply;
  }

  async incrementStock(id: number, cantidad: number) {
    const inv = await this.inventoryRepository.findOne({
      where: { insumoId: id },
    });

    if (!inv) {
      throw new NotFoundException('Inventario no encontrado');
    }

    const nuevaCantidad = inv.cantidadActual + cantidad;
    return this.updateStock(id, nuevaCantidad);
  }

  async decrementStock(id: number, cantidad: number) {
    const inv = await this.inventoryRepository.findOne({
      where: { insumoId: id },
    });

    if (!inv) {
      throw new NotFoundException('Inventario no encontrado');
    }

    if (inv.cantidadActual < cantidad) {
      throw new ConflictException('No hay suficiente stock para descontar');
    }

    const nuevaCantidad = inv.cantidadActual - cantidad;
    return this.updateStock(id, nuevaCantidad);
  }

  async getSuppliesStats() {
    return { total: await this.suppliesRepository.count() };
  }

  async searchSupplies(keyword: string) {
    return this.suppliesRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.inventory', 'i')
      .where('s.nombre ILIKE :k', { k: `%${keyword}%` })
      .getMany();
  }

  async getSuppliesByCategory(categoria: string) {
    return this.suppliesRepository.find({
      where: { categoria: categoria as SupplyCategory },
      relations: ['inventory'],
    });
  }

  async getSuppliesByStatus(estado: string) {
    return this.suppliesRepository.find({
      where: { estado: estado as SupplyStatus },
      relations: ['inventory'],
    });
  }

  async getLowStockSupplies() {
    return this.suppliesRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.inventory', 'i')
      .where('i.cantidad_actual <= s.stock_min')
      .getMany();
  }

  private calculateSupplyStatus(
    cantidad: number,
    stockMin = 0,
  ): SupplyStatus {
    if (cantidad === 0) return SupplyStatus.AGOTADO;
    if (cantidad <= stockMin) return SupplyStatus.STOCK_BAJO;
    return SupplyStatus.DISPONIBLE;
  }
}