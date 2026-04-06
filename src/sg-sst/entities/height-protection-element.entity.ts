import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('height_protection_elements')
@Index(['name'], { unique: true })
export class HeightProtectionElement {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar' })
    name: string;

    @Column({ name: 'display_order', type: 'int', default: 0 })
    displayOrder: number;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;
}