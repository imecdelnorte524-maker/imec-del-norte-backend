// src/work-orders/entities/work-order.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Service } from '../../services/entities/service.entity';
import { User } from '../../users/entities/user.entity';
import { SupplyDetail } from './supply-detail.entity';
import { ToolDetail } from './tool-detail.entity';
import { Client } from '../../client/entities/client.entity';
import { MaintenanceType } from '../../maintenance-types/entities/maintenance-type.entity';
import { WorkOrderStatus } from '../../shared/index';
import { BillingStatus } from '../../shared/index';
import { ServiceRequestType } from '../../shared/index';
import { EquipmentWorkOrder } from './equipment-work-order.entity';
import { PlanMantenimiento } from '../../equipment/entities/plan-mantenimiento.entity';
import { WorkOrderTechnician } from './work-order-technician.entity';
import { WorkOrderTimer } from './work-order-timer.entity';
import { WorkOrderPause } from './work-order-pause.entity';
import { Image } from '../../images/entities/image.entity';
import { AcInspection } from './ac-inspection.entity';
import { CostStatus } from '../../shared/index';
import { WorkOrderMaintenancePlan } from './work-order-maintenance-plan.entity';

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

  @Column({
    name: 'estado_pago',
    type: 'enum',
    enum: CostStatus,
    nullable: true,
  })
  estadoPago!: CostStatus | null;

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
  planMantenimientoId?: number | null;

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

  @Column({
    name: 'received_by_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  receivedByName?: string | null;

  @Column({
    name: 'received_by_position',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  receivedByPosition?: string | null;

  @Column({ name: 'received_by_signature_data', type: 'text', nullable: true })
  receivedBySignatureData?: string | null;

  @Column({ name: 'received_at', type: 'timestamp', nullable: true })
  receivedAt?: Date | null;

  // Evidencias (imágenes)
  @OneToMany(() => Image, (image) => image.workOrder)
  images?: Image[];

  @OneToMany(() => AcInspection, (insp) => insp.workOrder)
  acInspections: AcInspection[];

  @Column({ name: 'is_automatic_weekly', type: 'boolean', default: false })
  isAutomaticWeekly!: boolean;

  @Index('uq_ordenes_trabajo_auto_batch_key', { unique: true })
  @Column({
    name: 'auto_batch_key',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  autoBatchKey?: string;

  @Column({ name: 'auto_week_start', type: 'date', nullable: true })
  autoWeekStart?: Date;

  @Column({ name: 'auto_week_end', type: 'date', nullable: true })
  autoWeekEnd?: Date;

  @OneToMany(() => WorkOrderMaintenancePlan, (x) => x.workOrder)
  workOrderPlans!: WorkOrderMaintenancePlan[];
}
