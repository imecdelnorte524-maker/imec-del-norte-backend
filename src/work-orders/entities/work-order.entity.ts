// src/work-orders/entities/work-order.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Service } from '../../services/entities/service.entity';
import { User } from '../../users/entities/user.entity';
import { SupplyDetail } from './supply-detail.entity';
import { ToolDetail } from './tool-detail.entity';
import { Client } from '../../client/entities/client.entity';
import { MaintenanceType } from '../../maintenance-types/entities/maintenance-type.entity';
import { WorkOrderStatus } from '../enums/work-order-status.enum';
import { BillingStatus } from '../enums/billing-status.enum';
import { ServiceRequestType } from '../enums/service-request-type.enum';
import { EquipmentWorkOrder } from './equipment-work-order.entity';
import { PlanMantenimiento } from '../../equipment/entities/plan-mantenimiento.entity';
import { WorkOrderTechnician } from './work-order-technician.entity';
import { WorkOrderTimer } from './work-order-timer.entity';
import { WorkOrderPause } from './work-order-pause.entity';

@Entity('ordenes_trabajo')
export class WorkOrder {
  @PrimaryGeneratedColumn({ name: 'orden_id' })
  ordenId!: number;

  @Column({ name: 'servicio_id' })
  servicioId!: number;

  @Column({ name: 'cliente_id' })
  clienteId!: number;

  @Column({ name: 'cliente_empresa_id', nullable: true })
  clienteEmpresaId?: number;

  @Column({ name: 'es_emergencia', default: false })
  isEmergency!: boolean;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'servicio_id' })
  service!: Service;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'cliente_id' })
  cliente!: User;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'cliente_empresa_id' })
  clienteEmpresa?: Client;

  @CreateDateColumn({ name: 'fecha_solicitud' })
  fechaSolicitud!: Date;

  @Column({ name: 'fecha_programada', type: 'date', nullable: true })
  fechaProgramada?: Date;

  @Column({ name: 'fecha_inicio', type: 'timestamp', nullable: true })
  fechaInicio?: Date;

  @Column({ name: 'fecha_finalizacion', type: 'timestamp', nullable: true })
  fechaFinalizacion?: Date;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: WorkOrderStatus,
    default: WorkOrderStatus.REQUESTED_UNASSIGNED,
  })
  estado!: WorkOrderStatus;

  @Column({
    name: 'estado_facturacion',
    type: 'enum',
    enum: BillingStatus,
    nullable: true,
  })
  estadoFacturacion!: BillingStatus | null;

  @Column({ name: 'factura_pdf_url', length: 500, nullable: true })
  facturaPdfUrl?: string;

  @Column({ type: 'text', nullable: true })
  comentarios?: string;

  @Column({
    name: 'tipo_servicio',
    type: 'enum',
    enum: ServiceRequestType,
    nullable: true,
  })
  tipoServicio?: ServiceRequestType;

  @Column({ name: 'tipo_mantenimiento_id', nullable: true })
  maintenanceTypeId?: number;

  @ManyToOne(() => MaintenanceType, (mt) => mt.workOrders, { nullable: true })
  @JoinColumn({ name: 'tipo_mantenimiento_id' })
  maintenanceType?: MaintenanceType;

  @Column({ name: 'plan_mantenimiento_id', nullable: true })
  planMantenimientoId?: number;

  @ManyToOne(() => PlanMantenimiento, { nullable: true })
  @JoinColumn({ name: 'plan_mantenimiento_id' })
  planMantenimiento?: PlanMantenimiento;

  @OneToMany(() => SupplyDetail, (detail) => detail.workOrder)
  supplyDetails!: SupplyDetail[];

  @OneToMany(() => ToolDetail, (detail) => detail.workOrder)
  toolDetails!: ToolDetail[];

  @OneToMany(() => EquipmentWorkOrder, (ewo) => ewo.workOrder, {
    cascade: true,
  })
  equipmentWorkOrders!: EquipmentWorkOrder[];

  // NUEVAS RELACIONES
  @OneToMany(() => WorkOrderTechnician, (technician) => technician.workOrder, {
    cascade: true,
  })
  technicians!: WorkOrderTechnician[];

  @OneToMany(() => WorkOrderTimer, (timer) => timer.workOrder, {
    cascade: true,
  })
  timers!: WorkOrderTimer[];

  @OneToMany(() => WorkOrderPause, (pause) => pause.workOrder, {
    cascade: true,
  })
  pauses!: WorkOrderPause[];
}