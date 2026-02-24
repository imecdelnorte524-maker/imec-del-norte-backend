import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { ToolDetail } from '../../work-orders/entities/tool-detail.entity';
import { ToolStatus, ToolType } from '../../shared/index';
import { ToolEliminationReason } from '../../shared/index';
import { Image } from '../../images/entities/image.entity';

@Entity('herramientas')
export class Tool {
  @PrimaryGeneratedColumn({ name: 'herramienta_id' })
  herramientaId: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100, nullable: true }) // ← Tipo explícito
  marca: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  serial: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  modelo: string | null;

  @Column({
    name: 'caracteristicas_tecnicas',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  caracteristicasTecnicas: string | null;

  @Column({ type: 'text', nullable: true })
  observacion: string | null;

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion: Date | null;

  @Column({
    type: 'enum',
    enum: ToolType,
    default: ToolType.HERRAMIENTA,
  })
  tipo: ToolType;

  @Column({
    type: 'enum',
    enum: ToolStatus,
    default: ToolStatus.DISPONIBLE,
  })
  estado: ToolStatus;

  @Column({
    name: 'motivo_eliminacion',
    type: 'enum',
    enum: ToolEliminationReason,
    nullable: true,
  })
  motivoEliminacion: ToolEliminationReason | null;

  @Column({
    name: 'observacion_eliminacion',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observacionEliminacion: string | null;

  @Column({
    name: 'valor_unitario',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  valorUnitario: number;

  @OneToMany(() => Image, (image) => image.tool)
  images: Image[];

  @OneToOne(() => Inventory, (inventory) => inventory.tool, {
    cascade: ['insert', 'update'],
  })
  inventory: Inventory | null;

  @OneToOne(() => ToolDetail, (toolDetail) => toolDetail.tool, {
    nullable: true,
  })
  toolDetails: ToolDetail | null;
}
