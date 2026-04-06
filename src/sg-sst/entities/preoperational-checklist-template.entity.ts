import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PreoperationalChecklistParameter } from './preoperational-checklist-parameter.entity';
import { PreoperationalTemplateRequiredTool } from './preoperational-template-required-tool.entity';

@Entity('preoperational_checklist_templates')
@Index(['toolType', 'version'], { unique: true })
export class PreoperationalChecklistTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tool_type' })
  toolType: string;

  @Column({ name: 'tool_category' })
  toolCategory: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'replaced_by_template_id', type: 'int', nullable: true })
  replacedByTemplateId?: number | null;

  @Column({ type: 'int', default: 10 })
  estimatedTime: number;

  @Column({ type: 'text', nullable: true })
  additionalInstructions?: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => PreoperationalChecklistParameter, (p) => p.template, { cascade: true })
  parameters: PreoperationalChecklistParameter[];

  @OneToMany(() => PreoperationalTemplateRequiredTool, (rt) => rt.template, { cascade: true })
  requiredTools: PreoperationalTemplateRequiredTool[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}