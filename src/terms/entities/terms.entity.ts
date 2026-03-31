// src/entities/terms.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum TermsType {
  DATA_PRIVACY = 'dataprivacy',
  ATS = 'ats',
  HEIGHT_WORK = 'height_work',
  PREOPERATIONAL_FORM = 'preoperational_form',
  SECURITY = 'security',
}

@Entity('terms_conditions')
@Unique(['type'])
export class TermsConditions {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: TermsType,
    unique: true,
  })
  @Index()
  type: TermsType;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json' })
  items: string[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  updatedBy: string;

  // 🔥 CORRECCIÓN: Especifica el nombre exacto de la columna
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
