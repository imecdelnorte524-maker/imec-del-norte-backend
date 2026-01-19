import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Equipment } from './equipment.entity';

@Entity('equipment_compressors')
export class EquipmentCompressor {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'equipment_id' })
  equipmentId: number;

  @ManyToOne(() => Equipment, (equipment) => equipment.compressors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

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

  @Column({ name: 'tipo_refrigerante', type: 'varchar', length: 100, nullable: true })
  tipoRefrigerante?: string;

  @Column({ name: 'voltaje', type: 'varchar', length: 50, nullable: true })
  voltaje?: string;

  @Column({ name: 'numero_fases', type: 'varchar', length: 50, nullable: true })
  numeroFases?: string;

  @Column({ name: 'tipo_aceite', type: 'varchar', length: 50, nullable: true })
  tipoAceite?: string;

  @Column({ name: 'cantidad_aceite', type: 'varchar', length: 50, nullable: true })
  cantidadAceite?: string;

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