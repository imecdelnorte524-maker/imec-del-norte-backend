import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { SupplyDetail } from '../../work-orders/entities/supply-detail.entity';
import {
  SupplyStatus,
  SupplyCategory,
  UnitOfMeasure,
} from '../../shared/enums/inventory.enum';
import { Image } from 'src/images/entities/image.entity';

@Entity('insumos')
export class Supply {
  @PrimaryGeneratedColumn({ name: 'insumo_id' })
  insumoId: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({
    type: 'enum',
    enum: SupplyCategory,
    default: SupplyCategory.GENERAL,
  })
  categoria: SupplyCategory;

  @Column({
    name: 'unidad_medida',
    type: 'enum',
    enum: UnitOfMeasure,
    default: UnitOfMeasure.UNIDAD,
  })
  unidadMedida: UnitOfMeasure;

  @Column({
    type: 'enum',
    enum: SupplyStatus,
    default: SupplyStatus.DISPONIBLE,
  })
  estado: SupplyStatus;

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro: Date;

  @Column({ name: 'stock_min', default: 0 })
  stockMin: number;

  @Column({ name: 'valor_unitario', type: 'decimal', precision: 10, scale: 2 })
  valorUnitario: number;

  @Column({ name: 'foto_url', nullable: true })
  fotoUrl: string;

  @OneToMany(() => Image, (image) => image.supply)
  images: Image[];

  // RELACIÓN UNO A UNO CON INVENTARIO (CASCADA BIDIRECCIONAL)
  @OneToOne(() => Inventory, (inventory) => inventory.supply, {
    cascade: ['insert', 'update'],
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'inventario_id' })
  inventory: Inventory;

  // Mantener relación con work orders si es necesario
  @OneToOne(() => SupplyDetail, (supplyDetail) => supplyDetail.supply, {
    nullable: true,
  })
  supplyDetails: SupplyDetail;
}
