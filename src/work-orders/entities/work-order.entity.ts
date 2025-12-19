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
import { Equipment } from '../../equipment/entities/equipment.entity';
import { WorkOrderStatus } from '../enums/work-order-status.enum';
import { BillingStatus } from '../enums/billing-status.enum';

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

  @Column({ name: 'tecnico_id', nullable: true })
  tecnicoId?: number;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'servicio_id' })
  service!: Service;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'cliente_id' })
  cliente!: User;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'cliente_empresa_id' })
  clienteEmpresa?: Client;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'tecnico_id' })
  tecnico?: User;

  @CreateDateColumn({ name: 'fecha_solicitud' })
  fechaSolicitud!: Date;

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
    default: BillingStatus.NOT_BILLED,
  })
  estadoFacturacion!: BillingStatus;

  @Column({ name: 'factura_pdf_url', length: 500, nullable: true })
  facturaPdfUrl?: string;

  @Column({ type: 'text', nullable: true })
  comentarios?: string;

  @OneToMany(() => SupplyDetail, detail => detail.workOrder)
  supplyDetails!: SupplyDetail[];

  @OneToMany(() => ToolDetail, detail => detail.workOrder)
  toolDetails!: ToolDetail[];
  
  @OneToMany(() => Equipment, equipment => equipment.workOrder)
  equipments?: Equipment[];
}
