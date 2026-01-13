import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Equipment } from './equipment.entity';

@Entity('equipment_motors')
export class EquipmentMotor {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'equipment_id' })
  equipmentId: number;

  @ManyToOne(() => Equipment, (equipment) => equipment.motors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column({ name: 'amperaje', type: 'varchar', length: 50, nullable: true })
  amperaje?: string;

  @Column({ name: 'voltaje', type: 'varchar', length: 50, nullable: true })
  voltaje?: string;

  @Column({ name: 'rpm', type: 'varchar', length: 50, nullable: true })
  rpm?: string;

  @Column({ name: 'serial_motor', type: 'varchar', length: 150, nullable: true })
  serialMotor?: string;

  @Column({ name: 'modelo_motor', type: 'varchar', length: 150, nullable: true })
  modeloMotor?: string;

  @Column({ name: 'diametro_eje', type: 'varchar', length: 50, nullable: true })
  diametroEje?: string;

  @Column({ name: 'tipo_eje', type: 'varchar', length: 100, nullable: true })
  tipoEje?: string;

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