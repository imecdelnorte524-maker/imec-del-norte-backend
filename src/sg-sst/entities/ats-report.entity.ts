import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Form } from './form.entity';
import { Client } from '../../client/entities/client.entity';
import { AtsReportRisk } from './ats-report-risk.entity';
import { AtsReportPpeItem } from './ats-report-ppe-item.entity';

@Entity('ats_reports')
export class AtsReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  formId: number;

  @Column({ name: 'client_id', type: 'int', nullable: true })
  clientId?: number | null;

  @Column({ type: 'varchar' })
  workerName: string;

  @Column({ name: 'worker_identification', type: 'varchar', nullable: true })
  workerIdentification?: string | null;

  @Column({ type: 'varchar', nullable: true })
  position?: string | null;

  @Column({ type: 'varchar', nullable: true })
  area?: string | null;

  @Column({ name: 'sub_area', type: 'varchar', nullable: true })
  subArea?: string | null;

  @Column({ type: 'text', nullable: true })
  workToPerform?: string | null;

  @Column({ type: 'varchar', nullable: true })
  location?: string | null;

  @Column({ type: 'time', nullable: true })
  startTime?: string | null;

  @Column({ type: 'time', nullable: true })
  endTime?: string | null;

  @Column({ type: 'date', nullable: true })
  date?: string | null;

  @Column({ type: 'text', nullable: true })
  observations?: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @OneToOne(() => Form, (form) => form.atsReport)
  @JoinColumn({ name: 'formId' })
  form: Form;

  @ManyToOne(() => Client, (client) => client.atsReports, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client?: Client | null;

  @Column({ name: 'client_name', type: 'varchar', nullable: true })
  clientName?: string | null;

  @Column({ name: 'client_nit', type: 'varchar', nullable: true })
  clientNit?: string | null;

  @OneToMany(() => AtsReportRisk, (x) => x.atsReport, { cascade: true })
  risks: AtsReportRisk[];

  @OneToMany(() => AtsReportPpeItem, (x) => x.atsReport, { cascade: true })
  ppeItems: AtsReportPpeItem[];
}