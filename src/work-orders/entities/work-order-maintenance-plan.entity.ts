// src/work-orders/entities/work-order-maintenance-plan.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { WorkOrder } from './work-order.entity';
import { PlanMantenimiento } from '../../equipment/entities/plan-mantenimiento.entity';

@Entity('ordenes_trabajo_planes')
@Index(['ordenId', 'planId'], { unique: true })
export class WorkOrderMaintenancePlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'orden_id' })
  ordenId: number;

  @Column({ name: 'plan_id' })
  planId: number;

  @ManyToOne(() => WorkOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  workOrder: WorkOrder;

  @ManyToOne(() => PlanMantenimiento, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: PlanMantenimiento;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
