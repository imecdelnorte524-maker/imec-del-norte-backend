import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Equipment } from './equipment.entity';
import { UnidadFrecuencia } from '../enums/frecuency-unity.enum';

@Entity('plan_mantenimiento')
export class PlanMantenimiento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'unidad_frecuencia',
    type: 'enum',
    enum: UnidadFrecuencia,
    enumName: 'plan_mantenimiento_unidad_frecuencia_enum',
    nullable: true,
  })
  unidadFrecuencia?: UnidadFrecuencia;

  // Día del mes (1–31)
  @Column({
    name: 'dia_del_mes',
    type: 'int',
    nullable: true,
  })
  diaDelMes?: number;

  @Column({ name: 'fecha_programada', type: 'date', nullable: true })
  fechaProgramada?: Date;

  @Column({ type: 'text', nullable: true })
  notas?: string;

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

  @OneToOne(() => Equipment, (equipment) => equipment.planMantenimiento, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column({ name: 'equipment_id', unique: true })
  equipmentId: number;
}