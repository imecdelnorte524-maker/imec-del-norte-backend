import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { AtsPpeItemType } from '../../shared';

@Entity('ats_ppe_items')
@Index(['name'], { unique: true })
export class AtsPpeItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({
    type: 'enum',
    enum: AtsPpeItemType,
    default: AtsPpeItemType.PPE,
  })
  type: AtsPpeItemType;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}