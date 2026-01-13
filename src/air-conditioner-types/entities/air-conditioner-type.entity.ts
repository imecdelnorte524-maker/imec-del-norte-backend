import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Equipment } from '../../equipment/entities/equipment.entity';

@Entity('air_conditioner_types')
export class AirConditionerType {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'name', length: 150, unique: true })
  name: string;

  @Column({ name: 'has_evaporator', type: 'boolean', default: false })
  hasEvaporator: boolean;

  @Column({ name: 'has_condenser', type: 'boolean', default: false })
  hasCondenser: boolean;

  // Relación opcional (1 a muchos): equipos que usan este tipo
  @OneToMany(() => Equipment, (equipment) => equipment.airConditionerType)
  equipments: Equipment[];
}