// src/sg-sst/entities/sign-otp.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Form } from './form.entity';
import { SignatureType } from './signature.entity';

@Entity('sign_otps')
export class SignOtp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  formId: number;

  @Column({
    type: 'enum',
    enum: SignatureType,
  })
  signatureType: SignatureType;

  @Column()
  codeHash: string;

  @Column({ default: 'EMAIL' })
  channel: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Form, (form) => form.signOtps)
  @JoinColumn({ name: 'formId' })
  form: Form;
}
