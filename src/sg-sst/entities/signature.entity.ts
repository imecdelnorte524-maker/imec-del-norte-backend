import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Form } from './form.entity';
import { SignatureType } from '../../shared/index';

@Entity('signatures')
@Index(['formId', 'formVersion', 'signatureType', 'userId'], { unique: true })
export class Signature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  formId: number;

  @Column({ name: 'form_version', type: 'int', default: 1 })
  formVersion: number;

  @Column({ type: 'enum', enum: SignatureType })
  signatureType: SignatureType;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'varchar' })
  userName: string;

  @Column({ type: 'text', nullable: true })
  signatureData?: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  signedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  ip?: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent?: string | null;

  @Column({ type: 'varchar', nullable: true })
  method?: string | null;

  @Column({ type: 'varchar', nullable: true })
  contactSnapshot?: string | null;

  @ManyToOne(() => Form, (form) => form.signatures)
  @JoinColumn({ name: 'formId' })
  form: Form;
}