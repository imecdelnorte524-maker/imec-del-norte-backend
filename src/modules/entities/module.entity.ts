import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity'; // Importa la entidad Role

@Entity('modulos')
export class Module {
  @PrimaryGeneratedColumn({ name: 'modulo_id' })
  moduloId: number;

  @Column({ name: 'nombre_modulo', length: 100, unique: true })
  nombreModulo: string;

  @Column({ type: 'text', nullable: true }) // Tipo 'text' para descripciones amplias
  descripcion: string;

  @Column({ default: true })
  activo: boolean; // Si el módulo está visible o no

  @Column({ type: 'int', default: 0 })
  orden: number; // Campo para definir el orden de visualización en el frontend

  @Column({ name: 'ruta_frontend', nullable: true, length: 255 })
  rutaFrontend: string; // Ruta del frontend asociada al módulo

  @Column({ name: 'icono', nullable: true, length: 50 })
  icono: string; // Icono asociado al módulo (ej: 'fa-user', 'material-dashboard')

  @Column({ name: 'codigo_interno', unique: true, nullable: true, length: 50 })
  codigoInterno: string; // Un código corto único para referencia interna

  @CreateDateColumn({
    name: 'fecha_creacion',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP', // Actualiza automáticamente la fecha en cada update
  })
  fechaActualizacion: Date;

  // Relación Many-to-Many con Roles
  // La tabla intermedia 'modulo_roles' se creará automáticamente
  @ManyToMany(() => Role, (role) => role.modules, { cascade: true }) // 'cascade: true' para guardar roles junto con el módulo
  @JoinTable({
    name: 'modulo_roles', // Nombre de la tabla intermedia
    joinColumn: {
      name: 'modulo_id',
      referencedColumnName: 'moduloId',
    },
    inverseJoinColumn: {
      name: 'rol_id',
      referencedColumnName: 'rolId',
    },
  })
  roles: Role[]; // Un módulo puede estar asociado a muchos roles
}
