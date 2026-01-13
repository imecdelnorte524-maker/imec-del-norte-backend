import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
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

  @Column({ name: 'parent_sub_area_id', nullable: true })
  parentSubAreaId?: number;

  @ManyToOne(() => SubArea, (subArea) => subArea.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_sub_area_id' })
  parentSubArea?: SubArea;

  @OneToMany(() => SubArea, (subArea) => subArea.parentSubArea)
  children?: SubArea[];

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}