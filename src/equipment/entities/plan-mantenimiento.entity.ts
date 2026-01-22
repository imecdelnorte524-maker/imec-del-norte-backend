import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Equipment } from './equipment.entity';

@Entity('plan_mantenimiento')
export class PlanMantenimiento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  frecuencia?: string; // ej: 'mensual', 'trimestral', 'semestral', 'anual', o 'cada 90 días'

  @Column({ name: 'fecha_programada', type: 'date', nullable: true })
  fechaProgramada?: Date;

  // Campos opcionales que podrías agregar después
  @Column({ type: 'text', nullable: true })
  notas?: string;

  @Column({
    name: 'created_at' ,
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    name: 'updated_at' ,
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  // Relación OneToOne con Equipment
  @OneToOne(() => Equipment, (equipment) => equipment.planMantenimiento, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column({ name: 'equipment_id', unique: true })
  equipmentId: number;
}
