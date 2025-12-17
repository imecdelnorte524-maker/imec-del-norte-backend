import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Equipment } from './equipment.entity';

@Entity('equipos_fotos')
export class EquipmentPhoto {
  @PrimaryGeneratedColumn({ name: 'foto_id' })
  photoId: number;

  @Column({ name: 'equipo_id' })
  equipmentId: number;

  @ManyToOne(() => Equipment, (equipment) => equipment.photos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipo_id' })
  equipment: Equipment;

  @Column({ name: 'url', length: 500 })
  url: string;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}