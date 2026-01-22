import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EquipmentCondenser } from './condenser.entity';

@Entity('equipment_compressors')
export class EquipmentCompressor {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'condenser_id' })
  condenserId: number;

  @ManyToOne(() => EquipmentCondenser, (condenser) => condenser.compressors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'condenser_id' })
  condenser: EquipmentCondenser;

  // Campos nuevos / ajustados (todos opcionales)
  @Column({ name: 'marca', type: 'varchar', length: 150, nullable: true })
  marca?: string;

  @Column({ name: 'modelo', type: 'varchar', length: 150, nullable: true })
  modelo?: string;

  @Column({ name: 'serial', type: 'varchar', length: 150, nullable: true })
  serial?: string;

  @Column({ name: 'capacidad', type: 'varchar', length: 150, nullable: true })
  capacidad?: string; // ej: '12000 BTU'

  @Column({ name: 'voltaje', type: 'varchar', length: 50, nullable: true })
  voltaje?: string;

  @Column({ name: 'frecuencia', type: 'varchar', length: 50, nullable: true })
  frecuencia?: string; // ej: '60 Hz'

  @Column({ name: 'tipo_refrigerante', type: 'varchar', length: 100, nullable: true })
  tipoRefrigerante?: string;

  @Column({ name: 'tipo_aceite', type: 'varchar', length: 50, nullable: true })
  tipoAceite?: string;

  @Column({ name: 'cantidad_aceite', type: 'varchar', length: 50, nullable: true })
  cantidadAceite?: string;

  @Column({ name: 'capacitor', type: 'varchar', length: 100, nullable: true })
  capacitor?: string; // ej: '35/5 µF'

  @Column({ name: 'lra', type: 'varchar', length: 50, nullable: true })
  lra?: string; // Locked Rotor Amps

  @Column({ name: 'fla', type: 'varchar', length: 50, nullable: true })
  fla?: string; // Full Load Amps

  @Column({ name: 'cantidad_polos', type: 'varchar', length: 50, nullable: true })
  cantidadPolos?: string; // ej: '4 polos'

  @Column({ name: 'amperaje', type: 'varchar', length: 50, nullable: true })
  amperaje?: string;

  @Column({ name: 'voltaje_bobina', type: 'varchar', length: 50, nullable: true })
  voltajeBobina?: string;

  @Column({ name: 'vac', type: 'varchar', length: 50, nullable: true })
  vac?: string; // Voltaje de arranque o similar

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