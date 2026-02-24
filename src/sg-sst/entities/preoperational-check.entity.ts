import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Form } from './form.entity';
import { CheckValue } from '../../shared/index';
@Entity('preoperational_checks')
export class PreoperationalCheck {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  formId: number;

  @Column()
  parameter: string;

  @Column({
    type: 'enum',
    enum: CheckValue,
    nullable: true
  })
  value: CheckValue;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relation
  @ManyToOne(() => Form, form => form.preoperationalChecks)
  @JoinColumn({ name: 'formId' })
  form: Form;
}