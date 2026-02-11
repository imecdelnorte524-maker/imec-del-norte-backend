// src/work-orders/entities/work-order-pause.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { WorkOrder } from './work-order.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ordenes_trabajo_pausas')
export class WorkOrderPause {
  @PrimaryGeneratedColumn({ name: 'pause_id' })
  pauseId: number;

  @Column({ name: 'orden_id' })
  ordenId: number;

  @Column({ name: 'inicio', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'fin', type: 'timestamp', nullable: true })
  endTime: Date | null;

  @Column({ name: 'usuario_id' })
  userId: number;

  @Column({ type: 'text', nullable: true })
  observacion: string;

  @ManyToOne(() => WorkOrder, (workOrder) => workOrder.pauses)
  @JoinColumn({ name: 'orden_id' })
  workOrder: WorkOrder;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario_id' })
  user: User;
}