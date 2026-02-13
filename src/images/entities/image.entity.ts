import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tool } from '../../tools/entities/tool.entity';
import { Supply } from '../../supplies/entities/supply.entity';
import { User } from '../../users/entities/user.entity';
import { Equipment } from '../../equipment/entities/equipment.entity';
import { Client } from '../../client/entities/client.entity';
import { WorkOrder } from 'src/work-orders/entities/work-order.entity';

@Entity('images')
export class Image {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  url: string;

  @Column()
  public_id: string;

  @Column()
  folder: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ name: 'is_logo', type: 'boolean', default: false })
  isLogo: boolean;

  // Herramienta
  @ManyToOne(() => Tool, (tool) => tool.images, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'tool_id' })
  tool?: Tool;

  // Insumo
  @ManyToOne(() => Supply, (supply) => supply.images, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'supply_id' })
  supply?: Supply;

  // Usuario
  @ManyToOne(() => User, (user) => user.images, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // Equipo (hoja de vida)
  @ManyToOne(() => Equipment, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment?: Equipment;

  // Cliente
  @ManyToOne(() => Client, (client) => client.images, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'client_id' })
  client?: Client;

  @ManyToOne(() => WorkOrder, (wo) => wo.images, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'work_order_id' })
  workOrder?: WorkOrder;
}
