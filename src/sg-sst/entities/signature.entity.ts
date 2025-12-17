import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Form } from './form.entity';

export enum SignatureType {
  TECHNICIAN = 'TECHNICIAN',
  SST = 'SST'
}

@Entity('signatures')
export class Signature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  formId: number;

  @Column({
    type: 'enum',
    enum: SignatureType
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

  // Relation
  @ManyToOne(() => Form, form => form.signatures)
  @JoinColumn({ name: 'formId' })
  form: Form;
}