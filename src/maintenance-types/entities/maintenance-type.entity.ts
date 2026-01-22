import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';

@Entity('tipos_mantenimiento')
export class MaintenanceType {
  @PrimaryGeneratedColumn({ name: 'tipo_mantenimiento_id' })
  id: number;

  @Column({ unique: true, length: 100 })
  nombre: string;

  @Column({ nullable: true, type: 'text' })
  descripcion: string;

  @Column({ default: true })
  activo: boolean;

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.maintenanceType)
  workOrders: WorkOrder[];
}