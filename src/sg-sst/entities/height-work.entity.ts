import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Form } from './form.entity';

@Entity('height_works')
export class HeightWork {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  formId: number;

  @Column()
  workerName: string;

  @Column({ nullable: true })
  identification: string;

  @Column({ nullable: true })
  position: string;

  @Column({ type: 'text', nullable: true })
  workDescription: string;

  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({ nullable: true })
  estimatedTime: string;

  @Column({ type: 'jsonb', nullable: true })
  protectionElements: any;

  @Column({ nullable: true })
  physicalCondition: boolean;

  @Column({ nullable: true })
  instructionsReceived: boolean;

  @Column({ nullable: true })
  fitForHeightWork: boolean;

  @Column({ nullable: true })
  authorizerName: string;

  @Column({ nullable: true })
  authorizerIdentification: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relation
  @OneToOne(() => Form, form => form.heightWork)
  @JoinColumn({ name: 'formId' })
  form: Form;
}