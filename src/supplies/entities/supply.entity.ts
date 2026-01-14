// src/supplies/entities/supply.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { SupplyDetail } from '../../work-orders/entities/supply-detail.entity';
import { SupplyStatus, SupplyCategory } from '../../shared/enums/inventory.enum';
import { Image } from '../../images/entities/image.entity';
import { UnitMeasure } from '../../unit-measure/entities/unit-measure.entity';

@Entity('insumos')
export class Supply {
  @PrimaryGeneratedColumn({ name: 'insumo_id' })
  insumoId: number;

  @Column({ length: 100, unique: true })
  nombre: string;

  @Column({
    type: 'enum',
    enum: SupplyCategory,
    default: SupplyCategory.GENERAL,
  })
  categoria: SupplyCategory;

  // CAMBIO: Ahora es una relación con la entidad UnitMeasure
  @ManyToOne(() => UnitMeasure, (unit) => unit.supplies, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: 'unidad_medida_id' })
  unidadMedida: UnitMeasure;

  @Column({
    type: 'enum',
    enum: SupplyStatus,
    default: SupplyStatus.DISPONIBLE,
  })
  estado: SupplyStatus;

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion: Date;

  @Column({ name: 'stock_min', default: 0 })
  stockMin: number;

  @Column({ name: 'valor_unitario', type: 'decimal', precision: 10, scale: 2 })
  valorUnitario: number;

  @OneToMany(() => Image, (image) => image.supply)
  images: Image[];

  @OneToOne(() => Inventory, (inventory) => inventory.supply, {
    cascade: ['insert', 'update'],
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'inventario_id' })
  inventory: Inventory;

  @OneToOne(() => SupplyDetail, (supplyDetail) => supplyDetail.supply, {
    nullable: true,
  })
  supplyDetails: SupplyDetail;
}