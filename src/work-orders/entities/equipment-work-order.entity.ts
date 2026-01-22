import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Equipment } from '../../equipment/entities/equipment.entity';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';

@Entity('equipment_work_order')
@Unique(['equipmentId', 'workOrderId'])
export class EquipmentWorkOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'equipment_id' })
  equipmentId: number;

  @Column({ name: 'work_order_id' })
  workOrderId: number;

  @ManyToOne(() => Equipment, (equipment) => equipment.equipmentWorkOrders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @ManyToOne(() => WorkOrder, (workOrder) => workOrder.equipmentWorkOrders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: WorkOrder;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}