import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { ToolDetail } from '../../work-orders/entities/tool-detail.entity';
import { ToolStatus, ToolType } from '../../shared/enums/inventory.enum';
import { Image } from 'src/images/entities/image.entity';

@Entity('herramientas')
export class Tool {
  @PrimaryGeneratedColumn({ name: 'herramienta_id' })
  herramientaId: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 100, nullable: true })
  marca: string;

  @Column({ length: 100, nullable: true, unique: true })
  serial: string;

  @Column({ length: 100, nullable: true })
  modelo: string;

  @Column({ name: 'caracteristicas_tecnicas', length: 255, nullable: true })
  caracteristicasTecnicas: string;

  @Column({ nullable: true })
  observacion: string;

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro: Date;

  @Column({
    type: 'enum',
    enum: ToolType,
    default: ToolType.HERRAMIENTA
  })
  tipo: ToolType;

  @Column({
    type: 'enum',
    enum: ToolStatus,
    default: ToolStatus.DISPONIBLE
  })
  estado: ToolStatus;

  @Column({ name: 'valor_unitario', type: 'decimal', precision: 10, scale: 2 })
  valorUnitario: number;

  @OneToMany(() => Image, (image) => image.tool)
  images: Image[];

  // RELACIÓN UNO A UNO CON INVENTARIO (CASCADA BIDIRECCIONAL)
  @OneToOne(() => Inventory, inventory => inventory.tool, {
    cascade: ['insert', 'update'],
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'inventario_id' })
  inventory: Inventory;

  // Mantener relación con work orders si es necesario
  @OneToOne(() => ToolDetail, toolDetail => toolDetail.tool, {
    nullable: true
  })
  toolDetails: ToolDetail;
}