// src/sg-sst/entities/signature.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Form } from './form.entity';

export enum SignatureType {
  TECHNICIAN = 'TECHNICIAN',
  SST = 'SST',
}

@Entity('signatures')
export class Signature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  formId: number;

  @Column({
    type: 'enum',
    enum: SignatureType,
  })
  signatureType: SignatureType;

  @Column()
  userId: number;

  @Column()
  userName: string;

  @Column({ type: 'text', nullable: true })
  signatureData: string;

  @CreateDateColumn()
  signedAt: Date;

  @Column({ nullable: true })
  ip: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  method: string; // Ej: 'OTP_EMAIL'

  @Column({ nullable: true })
  contactSnapshot: string; // email del usuario al momento de la firma

  @ManyToOne(() => Form, (form) => form.signatures)
  @JoinColumn({ name: 'formId' })
  form: Form;
}
