import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { PreoperationalChecklistTemplate } from './preoperational-checklist-template.entity';

@Entity('preoperational_template_required_tools')
@Index(['templateId', 'name'], { unique: true })
export class PreoperationalTemplateRequiredTool {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'template_id' })
    templateId: number;

    @ManyToOne(() => PreoperationalChecklistTemplate, (t) => t.requiredTools, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'template_id' })
    template: PreoperationalChecklistTemplate;

    @Column()
    name: string;

    @Column({ name: 'display_order', type: 'int', default: 0 })
    displayOrder: number;
}