// src/work-orders/entities/work-order-timer.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { WorkOrder } from './work-order.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ordenes_trabajo_timer')
export class WorkOrderTimer {
  @PrimaryGeneratedColumn({ name: 'timer_id' })
  timerId: number;

  @Column({ name: 'orden_id' })
  ordenId: number;

  @Column({ name: 'inicio', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'fin', type: 'timestamp', nullable: true })
  endTime: Date | null;

  @Column({ name: 'total_segundos', type: 'int', default: 0 })
  totalSeconds: number;

  @ManyToOne(() => WorkOrder, (workOrder) => workOrder.timers)
  @JoinColumn({ name: 'orden_id' })
  workOrder: WorkOrder;
}