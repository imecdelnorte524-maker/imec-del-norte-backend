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
import { User } from 'src/users/entities/user.entity';

@Entity('images')
export class Image {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  url: string;

  @Column()
  publicId: string;

  @Column()
  folder: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relaciones (nullable para reutilizar la tabla)
  @ManyToOne(() => Tool, (tool) => tool.images, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  tool?: Tool;

  @ManyToOne(() => Supply, (supply) => supply.images, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  supply?: Supply;

  @ManyToOne(() => User, (user) => user.images, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
