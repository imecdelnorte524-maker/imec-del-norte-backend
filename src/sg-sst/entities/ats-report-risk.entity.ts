import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { AtsReport } from './ats-report.entity';
import { AtsRisk } from './ats-risk.entity';

@Entity('ats_report_risks')
@Unique(['atsReportId', 'riskId'])
export class AtsReportRisk {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'ats_report_id' })
    atsReportId: number;

    @ManyToOne(() => AtsReport, (r) => r.risks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ats_report_id' })
    atsReport: AtsReport;

    @Column({ name: 'risk_id' })
    riskId: number;

    @ManyToOne(() => AtsRisk, { onDelete: 'RESTRICT', eager: true })
    @JoinColumn({ name: 'risk_id' })
    risk: AtsRisk;
}