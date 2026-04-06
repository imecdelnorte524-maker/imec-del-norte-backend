import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AtsReport } from './ats-report.entity';
import { HeightWork } from './height-work.entity';
import { PreoperationalCheck } from './preoperational-check.entity';
import { Signature } from './signature.entity';
import { User } from '../../users/entities/user.entity';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';
import { FormStatus, FormType } from '../../shared/index';
import { SignOtp } from './sign-otp.entity';
import { FormTermsAcceptance } from './form-terms-acceptance.entity';

@Entity('forms')
export class Form {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: FormType, default: FormType.PREOPERATIONAL })
  formType: FormType;

  @Column({ type: 'enum', enum: FormStatus, default: FormStatus.DRAFT })
  status: FormStatus;

  @Column({ type: 'varchar', nullable: true })
  equipmentTool?: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  technicianSignatureDate?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  sstSignatureDate?: Date | null;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason?: string | null;

  @Column({ type: 'int', nullable: true })
  rejectedByUserId?: number | null;

  @Column({ type: 'varchar', nullable: true })
  rejectedByUserName?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt?: Date | null;

  @Column({ type: 'int' })
  createdBy: number;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ name: 'work_order_id', type: 'int', nullable: true })
  workOrderId?: number | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => User, (user) => user.forms)
  @JoinColumn({ name: 'userId', referencedColumnName: 'usuarioId' })
  user: User;

  @ManyToOne(() => WorkOrder, { nullable: true })
  @JoinColumn({ name: 'work_order_id' })
  workOrder?: WorkOrder | null;

  @OneToOne(() => AtsReport, (ats) => ats.form)
  atsReport: AtsReport;

  @OneToOne(() => HeightWork, (heightWork) => heightWork.form)
  heightWork: HeightWork;

  @OneToMany(() => PreoperationalCheck, (check) => check.form)
  preoperationalChecks: PreoperationalCheck[];

  @OneToMany(() => Signature, (signature) => signature.form)
  signatures: Signature[];

  @OneToMany(() => SignOtp, (otp) => otp.form)
  signOtps: SignOtp[];

  @OneToMany(() => FormTermsAcceptance, (x) => x.form)
  termsAcceptances: FormTermsAcceptance[];

  // PDF metadata
  @Column({ type: 'varchar', nullable: true })
  pdfFilePath?: string | null;

  @Column({ type: 'varchar', nullable: true })
  pdfFileName?: string | null;

  @Column({ type: 'int', nullable: true })
  pdfFileSize?: number | null;

  @Column({ type: 'varchar', nullable: true })
  pdfHash?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  pdfGeneratedAt?: Date | null;
}