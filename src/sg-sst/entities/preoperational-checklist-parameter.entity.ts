import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  PreoperationalChecklistTemplate,
} from './preoperational-checklist-template.entity';
import { PreoperationalParameterCategory } from '../../shared/index';

@Entity('preoperational_checklist_parameters')
export class PreoperationalChecklistParameter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_id' })
  templateId: number;

  @ManyToOne(
    () => PreoperationalChecklistTemplate,
    (template) => template.parameters,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'template_id' })
  template: PreoperationalChecklistTemplate;

  // Código opcional tipo 'ESC-001'
  @Column({ name: 'parameter_code', nullable: true })
  parameterCode?: string;

  @Column()
  parameter: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: PreoperationalParameterCategory,
    default: PreoperationalParameterCategory.SAFETY,
  })
  category: PreoperationalParameterCategory;

  @Column({ default: false })
  required: boolean;

  @Column({ default: false })
  critical: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;
}