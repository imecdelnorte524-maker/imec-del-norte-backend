// src/services/entities/service.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';
import { ServiceCategory } from '../enums/service.enums';

@Entity('servicios')
export class Service {
  @PrimaryGeneratedColumn({ name: 'servicio_id' })
  servicioId: number;

  @Column({ name: 'nombre_servicio', length: 150, unique: true })
  nombreServicio: string;

  @Column({ nullable: true, type: 'text' })
  descripcion?: string;

  @Column({ name: 'duracion_estimada', length: 50, nullable: true })
  duracionEstimada?: string;

  @Column({
    name: 'categoria_servicio',
    type: 'enum',
    enum: ServiceCategory,
    nullable: false,
  })
  categoriaServicio: ServiceCategory;

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.service)
  workOrders: WorkOrder[];
}