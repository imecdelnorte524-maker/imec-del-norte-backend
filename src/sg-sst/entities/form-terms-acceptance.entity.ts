import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Form } from './form.entity';
import { TermsType } from '../../shared';

@Entity('form_terms_acceptances')
@Index(['formId', 'formVersion', 'termsType'], { unique: true })
export class FormTermsAcceptance {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'form_id', type: 'int' })
    formId: number;

    @ManyToOne(() => Form, (f) => f.termsAcceptances, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'form_id' })
    form: Form;

    @Column({ name: 'form_version', type: 'int', default: 1 })
    formVersion: number;

    @Column({ type: 'enum', enum: TermsType })
    termsType: TermsType;

    @Column({ name: 'terms_version', type: 'int' })
    termsVersion: number;

    @Column({ name: 'accepted_by_user_id', type: 'int' })
    acceptedByUserId: number;

    @Column({ type: 'varchar', nullable: true })
    ip?: string | null;

    @Column({ type: 'varchar', nullable: true })
    userAgent?: string | null;

    @CreateDateColumn({ name: 'accepted_at', type: 'timestamp' })
    acceptedAt: Date;
}