import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EquipmentEvaporator } from './evaporator.entity';
import { EquipmentCondenser } from './condenser.entity';

@Entity('equipment_motors')
export class EquipmentMotor {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  // Relación opcional: puede pertenecer a evaporador O condensadora (no ambos a la vez)
  @ManyToOne(() => EquipmentEvaporator, (evap) => evap.motors, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaporator_id' })
  evaporator?: EquipmentEvaporator;

  @ManyToOne(() => EquipmentCondenser, (cond) => cond.motors, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condenser_id' })
  condenser?: EquipmentCondenser;

  // Campos nuevos / ajustados (todos opcionales)
  @Column({ name: 'amperaje', type: 'varchar', length: 50, nullable: true })
  amperaje?: string;

  @Column({ name: 'voltaje', type: 'varchar', length: 50, nullable: true })
  voltaje?: string;

  @Column({ name: 'numero_fases', type: 'varchar', length: 50, nullable: true })
  numeroFases?: string;

  @Column({ name: 'diametro_eje', type: 'varchar', length: 50, nullable: true })
  diametroEje?: string;

  @Column({ name: 'tipo_eje', type: 'varchar', length: 100, nullable: true })
  tipoEje?: string;

  @Column({ name: 'rpm', type: 'varchar', length: 50, nullable: true })
  rpm?: string;

  @Column({ name: 'correa', type: 'varchar', length: 100, nullable: true })
  correa?: string; // ej: 'A-48', o descripción

  @Column({ name: 'diametro_polea', type: 'varchar', length: 50, nullable: true })
  diametroPolea?: string;

  @Column({ name: 'capacidad_hp', type: 'varchar', length: 50, nullable: true })
  capacidadHp?: string;

  @Column({ name: 'frecuencia', type: 'varchar', length: 50, nullable: true })
  frecuencia?: string; // ej: '60 Hz'

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
}