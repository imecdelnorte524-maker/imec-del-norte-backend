// src/unit-measure/entities/unit-measure.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Supply } from '../../supplies/entities/supply.entity';

@Entity('unidades_medida')
export class UnitMeasure {
  @PrimaryGeneratedColumn({ name: 'unidad_medida_id' })
  unidadMedidaId: number;

  @Column({ length: 50, unique: true })
  nombre: string;

  @Column({ length: 10, nullable: true, name: 'abreviatura' })
  abreviatura: string;

  @Column({ default: true, name: 'activa' })
  activa: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;

  @OneToMany(() => Supply, (supply) => supply.unidadMedida)
  supplies: Supply[];
}