import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { AtsReport } from './ats-report.entity';
import { HeightWork } from './height-work.entity';
import { PreoperationalCheck } from './preoperational-check.entity';
import { Signature } from './signature.entity';
import { GeneratedPdf } from './generated-pdf.entity';
import { User } from '../../users/entities/user.entity'; // Ajusta la ruta según tu estructura

export enum FormType {
  ATS = 'ATS',
  HEIGHT_WORK = 'HEIGHT_WORK',
  PREOPERATIONAL = 'PREOPERATIONAL'
}

export enum FormStatus {
  DRAFT = 'DRAFT',
  PENDING_SST = 'PENDING_SST',
  COMPLETED = 'COMPLETED'
}

@Entity('forms')
export class Form {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: FormType,
    default: FormType.PREOPERATIONAL
  })
  formType: FormType;

  @Column({
    type: 'enum',
    enum: FormStatus,
    default: FormStatus.DRAFT
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

  @Column()
  createdBy: number;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relación con el usuario que creó el formulario
  @ManyToOne(() => User, user => user.forms)
  @JoinColumn({ name: 'userId', referencedColumnName: 'usuarioId' })
  user: User;

  // Relations
  @OneToOne(() => AtsReport, ats => ats.form)
  atsReport: AtsReport;

  @OneToOne(() => HeightWork, heightWork => heightWork.form)
  heightWork: HeightWork;

  @OneToMany(() => PreoperationalCheck, check => check.form)
  preoperationalChecks: PreoperationalCheck[];

  @OneToMany(() => Signature, signature => signature.form)
  signatures: Signature[];

  @OneToMany(() => GeneratedPdf, pdf => pdf.form)
  generatedPdfs: GeneratedPdf[];
}