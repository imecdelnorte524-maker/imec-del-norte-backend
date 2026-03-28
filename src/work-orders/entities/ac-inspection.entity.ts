// src/work-orders/entities/ac-inspection.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { WorkOrder } from './work-order.entity';
import { AcInspectionPhase } from '../../shared/index';
import { User } from '../../users/entities/user.entity';
import { Equipment } from '../../equipment/entities/equipment.entity';


@Entity('ac_inspections')
export class AcInspection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'work_order_id' })
  workOrderId: number;

  @ManyToOne(() => WorkOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: WorkOrder;

  @Column({ name: 'equipment_id', nullable: true })
  equipmentId: number;

  @ManyToOne(() => Equipment)
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column({
    type: 'enum',
    enum: AcInspectionPhase,
  })
  phase: AcInspectionPhase;

  // -------- EVAPORADORA --------
  @Column('float', { name: 'evap_temp_supply' })
  evapTempSupply: number; // Temperatura de suministro

  @Column('float', { name: 'evap_temp_return' })
  evapTempReturn: number; // Temperatura de retorno

  @Column('float', { name: 'evap_temp_ambient' })
  evapTempAmbient: number; // Temperatura ambiente

  @Column('float', { name: 'evap_temp_outdoor' })
  evapTempOutdoor: number; // Temperatura exterior

  @Column('float', { name: 'evap_motor_rpm' })
  evapMotorRpm: number; // RPM del motor

  @Column('float', {
    name: 'evap_microfarads',
    nullable: true,
  })
  evapMicrofarads: number | null; // Microfaradios (solo BEFORE, AFTER opcional)

  // -------- CONDENSADORA --------
  @Column('float', { name: 'cond_high_pressure' })
  condHighPressure: number; // Presión alta

  @Column('float', { name: 'cond_low_pressure' })
  condLowPressure: number; // Presión baja

  @Column('float', { name: 'cond_amperage' })
  condAmperage: number; // Amperaje

  @Column('float', { name: 'cond_voltage' })
  condVoltage: number; // Voltaje

  @Column('float', { name: 'cond_temp_in' })
  condTempIn: number; // Temperatura de entrada

  @Column('float', { name: 'cond_temp_discharge' })
  condTempDischarge: number; // Temperatura de descarga

  @Column('float', { name: 'cond_motor_rpm' })
  condMotorRpm: number; // RPM del motor

  @Column('float', {
    name: 'cond_microfarads',
    nullable: true,
  })
  condMicrofarads: number | null; // Microfaradios (solo BEFORE, AFTER opcional)

  @Column('float', {
    name: 'compressor_onion',
    nullable: true,
  })
  compressorOhmio: number | null; // "Ohmio" del compresor (solo BEFORE)

  // Observaciones para esta inspección
  @Column({ type: 'text', nullable: true })
  observation?: string | null;

  // Auditoría
  @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
  createdByUserId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
