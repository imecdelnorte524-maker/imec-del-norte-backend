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

@Entity('equipment_evaporators')
export class EquipmentEvaporator {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'equipment_id' })
  equipmentId: number;

  @ManyToOne(() => Equipment, (equipment) => equipment.evaporators, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  // Campos nuevos / ajustados (todos opcionales)
  @Column({ name: 'marca', type: 'varchar', length: 150, nullable: true })
  marca?: string;

  @Column({ name: 'modelo', type: 'varchar', length: 150, nullable: true })
  modelo?: string;

  @Column({ name: 'serial', type: 'varchar', length: 150, nullable: true })
  serial?: string;

  @Column({ name: 'capacidad', type: 'varchar', length: 150, nullable: true })
  capacidad?: string; // ej: '12000 BTU', '18000 BTU'

  @Column({ name: 'tipo_refrigerante', type: 'varchar', length: 100, nullable: true })
  tipoRefrigerante?: string;

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

  // Nueva relación: un evaporador puede tener varios motores
  @OneToMany(() => EquipmentMotor, (motor) => motor.evaporator, {
    cascade: true,
    nullable: true,
  })
  motors?: EquipmentMotor[];
}