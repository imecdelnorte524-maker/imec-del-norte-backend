import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../client/entities/client.entity';
import { Area } from '../../area/entities/area.entity';
import { SubArea } from '../../sub-area/entities/sub-area.entity';
import { EquipmentStatus } from '../enums/equipment-status.enum';
import { ServiceCategory } from '../../services/enums/service.enums';
import { EquipmentPhoto } from './equipment-photo.entity';

@Entity('equipos')
export class Equipment {
  @PrimaryGeneratedColumn({ name: 'equipo_id' })
  equipmentId: number;

  @Column({ name: 'cliente_id' })
  clientId: number;

  @ManyToOne(() => Client, { eager: true })
  @JoinColumn({ name: 'cliente_id' })
  client: Client;

  @Column({ name: 'area_id', nullable: true })
  areaId?: number;

  @ManyToOne(() => Area, { nullable: true, eager: true })
  @JoinColumn({ name: 'area_id' })
  area?: Area;

  @Column({ name: 'sub_area_id', nullable: true })
  subAreaId?: number;

  @ManyToOne(() => SubArea, { nullable: true, eager: true })
  @JoinColumn({ name: 'sub_area_id' })
  subArea?: SubArea;

  @Column({
    name: 'categoria_equipo',
    type: 'enum',
    enum: ServiceCategory,
  })
  category: ServiceCategory;

  @Column({ name: 'nombre_equipo', length: 255 })
  name: string;

  @Column({ name: 'codigo_equipo', length: 100, nullable: true })
  code?: string;

  @Column({ name: 'marca', length: 150, nullable: true })
  brand?: string;

  @Column({ name: 'modelo', length: 150, nullable: true })
  model?: string;

  @Column({ name: 'numero_serie', length: 150, nullable: true })
  serialNumber?: string;

  @Column({ name: 'capacidad', length: 150, nullable: true })
  capacity?: string;

  @Column({ name: 'tipo_refrigerante', length: 100, nullable: true })
  refrigerantType?: string;

  @Column({ name: 'voltaje', length: 50, nullable: true })
  voltage?: string;

  @Column({ name: 'ubicacion_fisica', length: 500, nullable: true })
  physicalLocation?: string;

  @Column({ name: 'fabricante', length: 150, nullable: true })
  manufacturer?: string;

  @Column({
    name: 'estado_equipo',
    type: 'enum',
    enum: EquipmentStatus,
    default: EquipmentStatus.ACTIVE,
  })
  status: EquipmentStatus;

  @Column({
    name: 'fecha_instalacion',
    type: 'date',
    nullable: true,
  })
  installationDate?: Date;

  @Column({ name: 'observaciones', type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => EquipmentPhoto, (photo) => photo.equipment, {
    cascade: true,
  })
  photos: EquipmentPhoto[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}