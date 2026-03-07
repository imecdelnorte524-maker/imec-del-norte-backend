// src/sg-sst/entities/form.entity.ts
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

@Entity('forms')
export class Form {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: FormType,
    default: FormType.PREOPERATIONAL,
  })
  formType: FormType;

  @Column({
    type: 'enum',
    enum: FormStatus,
    default: FormStatus.DRAFT,
  })
  status: FormStatus;

  @Column({ nullable: true })
  equipmentTool: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  technicianSignatureDate: Date;

  @Column({ nullable: true })
  sstSignatureDate: Date;

  @Column()
  userId: number;

  @Column({ nullable: true })
  rejectionReason?: string;

  @Column({ nullable: true })
  rejectedByUserId?: number;

  @Column({ nullable: true })
  rejectedByUserName?: string;

  @Column({ nullable: true })
  rejectedAt?: Date;

  @Column()
  createdBy: number;

  @UpdateDateColumn()
  updatedAt: Date;

  // 🔹 Nueva columna: orden de trabajo asociada
  @Column({ name: 'work_order_id', nullable: true })
  workOrderId?: number;

  // Relación con el usuario que creó el formulario
  @ManyToOne(() => User, (user) => user.forms)
  @JoinColumn({ name: 'userId', referencedColumnName: 'usuarioId' })
  user: User;

  // Relación con la orden de trabajo
  @ManyToOne(() => WorkOrder, { nullable: true })
  @JoinColumn({ name: 'work_order_id' })
  workOrder?: WorkOrder;

  // Relations
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
  
  // ===== Metadatos del PDF generado =====
  @Column({ nullable: true })
  pdfFilePath?: string;

  @Column({ nullable: true })
  pdfFileName?: string;

  @Column({ type: 'int', nullable: true })
  pdfFileSize?: number;

  @Column({ nullable: true })
  pdfHash?: string;

  @Column({ type: 'timestamp', nullable: true })
  pdfGeneratedAt?: Date;
}
