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

@Entity('ordenes_trabajo')
export class WorkOrder {
  @PrimaryGeneratedColumn({ name: 'orden_id' })
  ordenId!: number;

  @Column({ name: 'servicio_id' })
  servicioId!: number;

  // Persona de contacto (usuario cliente)
  @Column({ name: 'cliente_id' })
  clienteId!: number;

  // Empresa (cliente empresa)
  @Column({ name: 'cliente_empresa_id', nullable: true })
  clienteEmpresaId?: number;

  @Column({ name: 'tecnico_id', nullable: true })
  tecnicoId?: number;

  // Equipo asociado (hoja de vida), opcional
  @Column({ name: 'equipo_id', nullable: true })
  equipoId?: number;

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

  @ManyToOne(() => Equipment, { nullable: true })
  @JoinColumn({ name: 'equipo_id' })
  equipment?: Equipment;

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

  @Column({ type: 'text', nullable: true })
  comentarios?: string;

  @OneToMany(() => SupplyDetail, (supplyDetail) => supplyDetail.workOrder)
  supplyDetails!: SupplyDetail[];

  @OneToMany(() => ToolDetail, (toolDetail) => toolDetail.workOrder)
  toolDetails!: ToolDetail[];
}