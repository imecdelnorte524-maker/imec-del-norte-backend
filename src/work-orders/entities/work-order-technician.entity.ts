// src/work-orders/entities/work-order-technician.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { WorkOrder } from './work-order.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ordenes_trabajo_tecnicos')
export class WorkOrderTechnician {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'orden_id' })
  ordenId: number;

  @Column({ name: 'tecnico_id' })
  tecnicoId: number;

  @Column({ name: 'es_lider', default: false })
  isLeader: boolean;

  // 🔹 NUEVO: calificación del técnico en esta orden (0 a 5, con medias)
  @Column({
    name: 'calificacion',
    type: 'decimal',
    precision: 2,
    scale: 1,
    nullable: true,
  })
  rating?: number | null;

  // 🔹 NUEVO: quién calificó (admin o supervisor)
  @Column({ name: 'calificado_por', type: 'int', nullable: true })
  ratedByUserId?: number | null;

  // 🔹 NUEVO: cuándo se calificó
  @Column({
    name: 'fecha_calificacion',
    type: 'timestamp',
    nullable: true,
  })
  ratedAt?: Date | null;

  @ManyToOne(() => WorkOrder, (workOrder) => workOrder.technicians)
  @JoinColumn({ name: 'orden_id' })
  workOrder: WorkOrder;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'tecnico_id' })
  technician: User;
}