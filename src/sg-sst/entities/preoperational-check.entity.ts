import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Form } from './form.entity';
import { CheckValue } from '../../shared/index';

@Entity('preoperational_checks')
export class PreoperationalCheck {
  @PrimaryGeneratedColumn()
  id: number;

  // OJO: la columna real vieja es "formId"
  @Column({ name: 'formId', type: 'int' })
  formId: number;

  @ManyToOne(() => Form, (form) => form.preoperationalChecks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'formId' })
  form: Form;

  @Column({ name: 'template_id', type: 'int', nullable: true })
  templateId?: number | null;

  @Column({ name: 'parameter_id', type: 'int', nullable: true })
  parameterId?: number | null;

  @Column({ name: 'parameter_snapshot', type: 'varchar' })
  parameterSnapshot: string;

  @Column({ name: 'parameter_code_snapshot', type: 'varchar', nullable: true })
  parameterCodeSnapshot?: string | null;

  @Column({ name: 'category_snapshot', type: 'varchar', nullable: true })
  categorySnapshot?: string | null;

  @Column({ name: 'required_snapshot', type: 'boolean', default: false })
  requiredSnapshot: boolean;

  @Column({ name: 'critical_snapshot', type: 'boolean', default: false })
  criticalSnapshot: boolean;

  @Column({ type: 'enum', enum: CheckValue, nullable: true })
  value?: CheckValue | null;

  @Column({ type: 'text', nullable: true })
  observations?: string | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamp' })
  createdAt: Date;
}