import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationType } from '../enums/notification-types.enum';

@Entity('notificaciones')
export class Notification {
  @PrimaryGeneratedColumn({ name: 'notificacion_id' })
  notificacionId: number;

  @Column({ name: 'usuario_id' })
  usuarioId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  user: User;

  @Column({
    name: 'tipo',
    type: 'enum',
    enum: NotificationType,
    enumName: 'notificaciones_tipo_enum',
  })
  tipo: NotificationType;

  @Column({ name: 'titulo', length: 150 })
  titulo: string;

  @Column({ name: 'mensaje', type: 'text' })
  mensaje: string;

  @Column({ name: 'data', type: 'jsonb', nullable: true })
  data: Record<string, any> | null;

  @Column({ name: 'leida', type: 'boolean', default: false })
  leida: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
