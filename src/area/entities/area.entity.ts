// src/area/entities/area.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Client } from '../../client/entities/client.entity';
import { SubArea } from '../../sub-area/entities/sub-area.entity';
import { IsNotEmpty } from 'class-validator';

@Entity('areas')
export class Area {
  @PrimaryGeneratedColumn({ name: 'id_area' })
  idArea: number;

  @Column({ name: 'nombre_area', length: 255 })
  @IsNotEmpty()
  nombreArea: string;

  @Column({ name: 'cliente_id' })
  clienteId: number;

  @ManyToOne(() => Client, (cliente) => cliente.areas)
  @JoinColumn({ name: 'cliente_id' })
  cliente: Client;

  @OneToMany(() => SubArea, (subArea) => subArea.area)
  subAreas: SubArea[];

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}