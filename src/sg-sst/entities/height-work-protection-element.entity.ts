import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { HeightWork } from './height-work.entity';
import { HeightProtectionElement } from './height-protection-element.entity';

@Entity('height_work_protection_elements')
@Unique(['heightWorkId', 'protectionElementId'])
export class HeightWorkProtectionElement {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'height_work_id' })
    heightWorkId: number;

    @ManyToOne(() => HeightWork, (hw) => hw.protectionElements, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'height_work_id' })
    heightWork: HeightWork;

    @Column({ name: 'protection_element_id' })
    protectionElementId: number;

    @ManyToOne(() => HeightProtectionElement, { eager: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'protection_element_id' })
    protectionElement: HeightProtectionElement;
}