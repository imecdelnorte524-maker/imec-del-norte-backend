import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
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

  // Campos
  @Column({ name: 'marca', type: 'varchar', length: 150, nullable: true })
  marca?: string;

  @Column({ name: 'modelo', type: 'varchar', length: 150, nullable: true })
  modelo?: string;

  @Column({ name: 'serial', type: 'varchar', length: 150, nullable: true })
  serial?: string;

  @Column({ name: 'capacidad', type: 'varchar', length: 150, nullable: true })
  capacidad?: string;

  @Column({
    name: 'tipo_refrigerante',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tipoRefrigerante?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ⚠️ CORREGIR ESTA RELACIÓN - estaba mal referenciada
  @OneToMany(() => EquipmentMotor, (motor) => motor.evaporator, { // ← Cambiar 'condenser' por 'evaporator'
    cascade: true,
    nullable: true,
    eager: true,
  })
  motors?: EquipmentMotor[];
}