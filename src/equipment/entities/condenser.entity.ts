import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Equipment } from './equipment.entity';
import { EquipmentMotor } from './motor.entity';
import { EquipmentCompressor } from './compressor.entity';

@Entity('equipment_condensers')
export class EquipmentCondenser {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'equipment_id' })
  equipmentId: number;

  @ManyToOne(() => Equipment, (equipment) => equipment.condensers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  // Campos actuales (mantenerlos, todos opcionales)
  @Column({ name: 'marca', type: 'varchar', length: 150, nullable: true })
  marca?: string;

  @Column({ name: 'modelo', type: 'varchar', length: 150, nullable: true })
  modelo?: string;

  @Column({ name: 'serial', type: 'varchar', length: 150, nullable: true })
  serial?: string;

  @Column({ name: 'capacidad', type: 'varchar', length: 150, nullable: true })
  capacidad?: string;

  @Column({ name: 'amperaje', type: 'varchar', length: 50, nullable: true })
  amperaje?: string;

  @Column({ name: 'voltaje', type: 'varchar', length: 50, nullable: true })
  voltaje?: string;

  @Column({ name: 'tipo_refrigerante', type: 'varchar', length: 100, nullable: true })
  tipoRefrigerante?: string;

  @Column({ name: 'numero_fases', type: 'varchar', length: 50, nullable: true })
  numeroFases?: string;

  @Column({ name: 'presion_alta', type: 'varchar', length: 50, nullable: true })
  presionAlta?: string;

  @Column({ name: 'presion_baja', type: 'varchar', length: 50, nullable: true })
  presionBaja?: string;

  @Column({ name: 'hp', type: 'varchar', length: 50, nullable: true })
  hp?: string;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  // Nuevas relaciones
  @OneToMany(() => EquipmentMotor, (motor) => motor.condenser, {
    cascade: true,
    nullable: true,
  })
  motors?: EquipmentMotor[];

  @OneToMany(() => EquipmentCompressor, (comp) => comp.condenser, {
    cascade: true,
    nullable: true,
  })
  compressors?: EquipmentCompressor[];
}