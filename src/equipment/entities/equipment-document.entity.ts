import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Equipment } from './equipment.entity';

@Entity('equipment_documents')
export class EquipmentDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  url: string; // ✅ Cloudinary secure_url

  @Column()
  public_id: string; // ✅ Cloudinary public_id

  @Column({ nullable: true })
  folder: string;

  @Column({ nullable: true })
  original_name: string;

  @Column({ type: 'int', nullable: true })
  bytes: number;

  @Column({ nullable: true })
  format: string; // pdf

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Equipment, (eq) => eq.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id', referencedColumnName: 'equipmentId' })
  equipment: Equipment;
}