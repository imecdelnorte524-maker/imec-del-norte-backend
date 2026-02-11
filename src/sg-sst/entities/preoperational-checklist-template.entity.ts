import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PreoperationalChecklistParameter } from './preoperational-checklist-parameter.entity';

@Entity('preoperational_checklist_templates')
export class PreoperationalChecklistTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  // Tipo lógico de herramienta, ej: 'ESCALERA', 'PULIDORA', 'HERRAMIENTA GENERAL'
  @Column({ name: 'tool_type' })
  toolType: string;

  @Column({ name: 'tool_category' })
  toolCategory: string;

  @Column({ type: 'int', default: 10 })
  estimatedTime: number;

  @Column({ type: 'text', nullable: true })
  additionalInstructions?: string;

  @Column({ type: 'jsonb', nullable: true })
  requiresTools?: string[];

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(
    () => PreoperationalChecklistParameter,
    (parameter) => parameter.template,
    { cascade: true },
  )
  parameters: PreoperationalChecklistParameter[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}