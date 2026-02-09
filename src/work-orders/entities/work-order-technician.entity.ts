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

  @ManyToOne(() => WorkOrder, (workOrder) => workOrder.technicians)
  @JoinColumn({ name: 'orden_id' })
  workOrder: WorkOrder;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'tecnico_id' })
  technician: User;
}