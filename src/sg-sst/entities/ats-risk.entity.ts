import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AtsRiskCategory } from './ats-risk-category.entity';

@Entity('ats_risks')
@Index(['categoryId', 'name'], { unique: true })
export class AtsRisk {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'category_id', type: 'int' })
    categoryId: number;

    @ManyToOne(() => AtsRiskCategory, (c) => c.risks, {
        onDelete: 'RESTRICT',
        eager: true,
    })
    @JoinColumn({ name: 'category_id' })
    category: AtsRiskCategory;

    @Column({ type: 'varchar' })
    name: string;

    @Column({ type: 'text', nullable: true })
    description?: string | null;

    @Column({ name: 'display_order', type: 'int', default: 0 })
    displayOrder: number;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;
}