import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from 'typeorm';
import { AtsRisk } from './ats-risk.entity';

@Entity('ats_risk_categories')
@Index(['code'], { unique: true })
export class AtsRiskCategory {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar' })
    code: string;

    @Column({ type: 'varchar' })
    name: string;

    @Column({ name: 'display_order', type: 'int', default: 0 })
    displayOrder: number;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @OneToMany(() => AtsRisk, (r) => r.category)
    risks: AtsRisk[];
}