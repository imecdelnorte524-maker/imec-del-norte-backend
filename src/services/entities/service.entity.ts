import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';
import { ServiceCategory, WorkNature, MaintenanceType } from '../enums/service.enums';

@Entity('servicios')
export class Service {
  @PrimaryGeneratedColumn({ name: 'servicio_id' })
  servicioId: number;

  @Column({ name: 'nombre_servicio', length: 150, unique: true })
  nombreServicio: string;

  @Column({ nullable: true })
  descripcion: string;

  @Column({
    name: 'precio_base',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  precioBase: number;

  @Column({ name: 'duracion_estimada', length: 50, nullable: true })
  duracionEstimada: string;

  @Column({
    name: 'categoria_servicio',
    type: 'enum',
    enum: ServiceCategory,
    nullable: true,
  })
  categoriaServicio?: ServiceCategory;

  @Column({
    name: 'tipo_trabajo',
    type: 'enum',
    enum: WorkNature,
    nullable: true,
  })
  tipoTrabajo?: WorkNature;

  @Column({
    name: 'tipo_mantenimiento',
    type: 'enum',
    enum: MaintenanceType,
    nullable: true,
  })
  tipoMantenimiento?: MaintenanceType;

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.service)
  workOrders: WorkOrder[];
}