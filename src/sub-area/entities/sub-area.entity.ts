// src/sub-area/entities/sub-area.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Area } from '../../area/entities/area.entity';
import { IsNotEmpty } from 'class-validator';

@Entity('sub_areas')
export class SubArea {
  @PrimaryGeneratedColumn({ name: 'id_sub_area' })
  idSubArea: number;

  @Column({ name: 'nombre_sub_area', length: 255 })
  @IsNotEmpty()
  nombreSubArea: string;

  @Column({ name: 'area_id' })
  areaId: number;

  @ManyToOne(() => Area, (area) => area.subAreas)
  @JoinColumn({ name: 'area_id' })
  area: Area;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}