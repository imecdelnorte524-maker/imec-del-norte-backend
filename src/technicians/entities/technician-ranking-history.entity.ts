// src/technicians/entities/technician-ranking-history.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('tecnicos_ranking_historico')
@Index(['mes', 'año', 'tecnicoId'], { unique: true })
export class TechnicianRankingHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tecnico_id', type: 'int' })
  tecnicoId: number;

  @Column({ name: 'mes', type: 'int' })
  mes: number;

  @Column({ name: 'año', type: 'int' })
  año: number;

  @Column({ name: 'puesto', type: 'int' })
  puesto: number;

  @Column({ name: 'puntaje_total', type: 'decimal', precision: 5, scale: 2 })
  puntajeTotal: number;

  @Column({
    name: 'calificacion_promedio',
    type: 'decimal',
    precision: 3,
    scale: 1,
  })
  calificacionPromedio: number;

  @Column({ name: 'total_ordenes', type: 'int' })
  totalOrdenes: number;

  @Column({ name: 'puntualidad', type: 'decimal', precision: 3, scale: 1 })
  puntualidad: number;

  @Column({ name: 'veces_lider', type: 'int' })
  vecesLider: number;

  @Column({ name: 'metadata', type: 'text', nullable: true })
  metadata?: string;

  @CreateDateColumn({ name: 'fecha_calculo' })
  fechaCalculo: Date;
}
