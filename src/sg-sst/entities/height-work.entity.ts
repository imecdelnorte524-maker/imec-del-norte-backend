import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Form } from './form.entity';
import { HeightWorkProtectionElement } from './height-work-protection-element.entity';

@Entity('height_works')
export class HeightWork {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  formId: number;

  @Column({ type: 'varchar' })
  workerName: string;

  @Column({ type: 'varchar', nullable: true })
  identification?: string | null;

  @Column({ type: 'varchar', nullable: true })
  position?: string | null;

  @Column({ type: 'text', nullable: true })
  workDescription?: string | null;

  @Column({ type: 'text', nullable: true })
  location?: string | null;

  @Column({ type: 'varchar', nullable: true })
  estimatedTime?: string | null;

  @Column({ type: 'boolean', nullable: true })
  physicalCondition?: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  instructionsReceived?: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  fitForHeightWork?: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  authorizerName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  authorizerIdentification?: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @OneToOne(() => Form, (form) => form.heightWork)
  @JoinColumn({ name: 'formId' })
  form: Form;

  @OneToMany(() => HeightWorkProtectionElement, (x) => x.heightWork, {
    cascade: true,
  })
  protectionElements: HeightWorkProtectionElement[];
}