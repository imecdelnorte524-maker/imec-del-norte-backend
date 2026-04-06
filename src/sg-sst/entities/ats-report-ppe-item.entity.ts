import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { AtsReport } from './ats-report.entity';
import { AtsPpeItem } from './ats-ppe-item.entity';

@Entity('ats_report_ppe_items')
@Unique(['atsReportId', 'ppeItemId'])
export class AtsReportPpeItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'ats_report_id' })
    atsReportId: number;

    @ManyToOne(() => AtsReport, (r) => r.ppeItems, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ats_report_id' })
    atsReport: AtsReport;

    @Column({ name: 'ppe_item_id' })
    ppeItemId: number;

    @ManyToOne(() => AtsPpeItem, { onDelete: 'RESTRICT', eager: true })
    @JoinColumn({ name: 'ppe_item_id' })
    ppeItem: AtsPpeItem;
}