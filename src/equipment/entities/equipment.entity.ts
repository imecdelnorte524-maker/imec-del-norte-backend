import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Client } from '../../client/entities/client.entity';
import { Area } from '../../area/entities/area.entity';
import { SubArea } from '../../sub-area/entities/sub-area.entity';
import { EquipmentStatus } from '../enums/equipment-status.enum';
import { ServiceCategory } from '../../services/enums/service.enums';
import { Image } from '../../images/entities/image.entity';
import { AirConditionerType } from '../../air-conditioner-types/entities/air-conditioner-type.entity';
import { EquipmentEvaporator } from './evaporator.entity';
import { EquipmentCondenser } from './condenser.entity';
import { PlanMantenimiento } from './plan-mantenimiento.entity';
import { EquipmentWorkOrder } from '../../work-orders/entities/equipment-work-order.entity';

@Entity('equipos')
export class Equipment {
  @PrimaryGeneratedColumn({ name: 'equipo_id' })
  equipmentId: number;

  @Column({ name: 'cliente_id' })
  clientId: number;

  @ManyToOne(() => Client, { eager: true })
  @JoinColumn({ name: 'cliente_id' })
  client: Client;

  @Column({ name: 'area_id', nullable: true })
  areaId?: number;

  @ManyToOne(() => Area, { nullable: true, eager: true })
  @JoinColumn({ name: 'area_id' })
  area?: Area;

  @Column({ name: 'sub_area_id', nullable: true })
  subAreaId?: number;

  @ManyToOne(() => SubArea, { nullable: true, eager: true })
  @JoinColumn({ name: 'sub_area_id' })
  subArea?: SubArea;

  @Column({
    name: 'categoria_equipo',
    type: 'enum',
    enum: ServiceCategory,
  })
  category: ServiceCategory;

  @Column({ name: 'air_conditioner_type_id', nullable: true })
  airConditionerTypeId?: number;

  @ManyToOne(() => AirConditionerType, { nullable: true, eager: true })
  @JoinColumn({ name: 'air_conditioner_type_id' })
  airConditionerType?: AirConditionerType;

  @Column({ name: 'codigo_equipo', length: 100, nullable: true })
  code?: string;

  @Column({
    name: 'estado_equipo',
    type: 'enum',
    enum: EquipmentStatus,
    default: EquipmentStatus.ACTIVE,
  })
  status: EquipmentStatus;

  @Column({
    name: 'fecha_instalacion',
    type: 'date',
    nullable: true,
  })
  installationDate?: Date;

  @Column({ name: 'observaciones', type: 'text', nullable: true })
  notes?: string;

  @Column({
    name: 'crated_by',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Image, (image) => image.equipment, {
    cascade: true,
    eager: true,
  })
  images?: Image[];

  // ⚠️ NUEVA RELACIÓN: Tabla intermedia para relación N:M con WorkOrder
  @OneToMany(() => EquipmentWorkOrder, (ewo) => ewo.equipment, {
    cascade: true,
  })
  equipmentWorkOrders: EquipmentWorkOrder[];

  @OneToOne(() => PlanMantenimiento, (plan) => plan.equipment, {
    cascade: true,
    nullable: true,
  })
  planMantenimiento?: PlanMantenimiento;

  @OneToMany(() => EquipmentEvaporator, (evap) => evap.equipment, {
    cascade: true,
    eager: true,
  })
  evaporators?: EquipmentEvaporator[];

  @OneToMany(() => EquipmentCondenser, (cond) => cond.equipment, {
    cascade: true,
    eager: true,
  })
  condensers?: EquipmentCondenser[];
}