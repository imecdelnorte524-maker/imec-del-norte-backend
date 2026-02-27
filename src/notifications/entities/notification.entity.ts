// notifications/entities/notification.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import {
  NotificationType,
  NotificationModule,
  NotificationPriority,
} from '../../shared/index';

@Entity('notificaciones')
@Index(['usuarioId', 'leida', 'modulo']) // Índice compuesto para búsquedas frecuentes
@Index(['usuarioId', 'fechaCreacion']) // Índice para ordenamiento
export class Notification {
  @PrimaryGeneratedColumn({ name: 'notificacion_id' })
  notificacionId: number;

  @Column({ name: 'usuario_id' })
  @Index()
  usuarioId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  user: User;

  @Column({
    name: 'tipo',
    type: 'enum',
    enum: NotificationType,
  })
  tipo: NotificationType;

  @Column({
    name: 'modulo',
    type: 'enum',
    enum: NotificationModule,
    nullable: true,
  })
  modulo: NotificationModule;

  @Column({
    name: 'prioridad',
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  prioridad: NotificationPriority;

  @Column({ name: 'titulo', length: 150 })
  titulo: string;

  @Column({ name: 'mensaje', type: 'text' })
  mensaje: string;

  @Column({ name: 'mensaje_corto', length: 100, nullable: true })
  mensajeCorto: string; // Para mostrar en dropdowns

  @Column({ name: 'data', type: 'jsonb', nullable: true })
  data: Record<string, any> | null;

  @Column({ name: 'accion', type: 'jsonb', nullable: true })
  accion: {
    label: string;
    ruta: string;
    params?: Record<string, any>;
  } | null;

  @Column({ name: 'leida', type: 'boolean', default: false })
  @Index()
  leida: boolean;

  @Column({ name: 'fecha_lectura', type: 'timestamp', nullable: true })
  fechaLectura: Date | null;

  @Column({ name: 'visible_hasta', type: 'timestamp', nullable: true })
  visibleHasta: Date | null; // Para notificaciones con expiración

  @CreateDateColumn({ name: 'fecha_creacion' })
  @Index()
  fechaCreacion: Date;
}
