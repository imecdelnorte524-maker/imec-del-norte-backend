// src/sg-sst/entities/ats-report.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { Form } from './form.entity';
import { Client } from '../../client/entities/client.entity'; // Asegúrate de que esta ruta sea correcta

@Entity('ats_reports')
export class AtsReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  formId: number;

  // Nuevo campo: ID del cliente
  @Column({ name: 'client_id', nullable: true })
  clientId?: number;

  @Column()
  workerName: string;

  @Column({ nullable: true })
  position: string;

  @Column({ nullable: true })
  area: string;

  @Column({ type: 'text', nullable: true })
  workToPerform: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'time', nullable: true })
  startTime: string;

  @Column({ type: 'time', nullable: true })
  endTime: string;

  @Column({ type: 'date', nullable: true })
  date: string;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ type: 'jsonb', nullable: true })
  selectedRisks: any;

  @Column({ type: 'jsonb', nullable: true })
  requiredPpe: any;

  @CreateDateColumn()
  createdAt: Date;

  // Relación con Form
  @OneToOne(() => Form, form => form.atsReport)
  @JoinColumn({ name: 'formId' })
  form: Form;

  // Nueva relación con Client
  @ManyToOne(() => Client, client => client.atsReports, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client?: Client;

  // Nuevos campos para información del cliente (opcional, por si quieres denormalizar)
  @Column({ name: 'client_name', nullable: true })
  clientName?: string;

  @Column({ name: 'client_nit', nullable: true })
  clientNit?: string;

  // Nuevo campo: cédula del trabajador
  @Column({ name: 'worker_identification', nullable: true })
  workerIdentification?: string;

  // Nuevo campo: sub-área (opcional)
  @Column({ name: 'sub_area', nullable: true })
  subArea?: string;
}