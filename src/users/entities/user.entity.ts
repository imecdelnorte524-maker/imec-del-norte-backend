import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { TipoCedula } from '../enums/Type-cedula.enum';
import { Form } from '../../sg-sst/entities/form.entity';
import { Image } from '../../images/entities/image.entity';
import { UserPasswordHistory } from './user-password-history.entity';
import { Genero } from '../enums/genero.enum';
import { Client } from '../../client/entities/client.entity';

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn({ name: 'usuario_id' })
  usuarioId: number;

  @Column({ name: 'rol_id', type: 'int' })
  rolId: number;

  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: 'rol_id' })
  role: Role;

  @Column({
    name: 'tipo_cedula',
    type: 'enum',
    enum: TipoCedula,
    default: TipoCedula.CC,
    nullable: true,
  })
  tipoCedula?: TipoCedula | null;

  @Column({ name: 'cedula', type: 'varchar', length: 10, nullable: true })
  cedula?: string | null;

  @Column({ name: 'nombre', type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'apellido', type: 'varchar', length: 100, nullable: true })
  apellido?: string | null;

  @Column({ name: 'email', type: 'varchar', length: 150, unique: true })
  email: string;

  @Column({ name: 'username', type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash?: string | null;

  @Column({ name: 'telefono', type: 'varchar', length: 20, nullable: true })
  telefono?: string | null;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' })
  fechaCreacion: Date;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento?: Date | null;

  @Column({
    name: 'genero',
    type: 'enum',
    enum: Genero,
    nullable: true,
  })
  genero?: Genero | null;

  @Column({ name: 'reset_token', type: 'varchar', length: 255, nullable: true })
  resetToken?: string | null;

  @Column({ name: 'reset_token_expiry', type: 'timestamp', nullable: true })
  resetTokenExpiry?: Date | null;

  @OneToMany(() => Form, (form) => form.user)
  forms: Form[];

  @OneToMany(() => Image, (image) => image.user)
  images: Image[];

  @OneToMany(() => UserPasswordHistory, (history) => history.user)
  passwordHistory: UserPasswordHistory[];

  @Column({
    name: 'must_change_password',
    type: 'boolean',
    default: false,
  })
  mustChangePassword: boolean;

  @Column({
    name: 'ubicacion_residencia',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ubicacionResidencia?: string | null;

  @Column({
    name: 'arl',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  arl?: string | null;

  @Column({
    name: 'eps',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  eps?: string | null;

  @Column({
    name: 'afp',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  afp?: string | null;

  @Column({
    name: 'contacto_emergencia_nombre',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  contactoEmergenciaNombre?: string | null;

  @Column({
    name: 'contacto_emergencia_telefono',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  contactoEmergenciaTelefono?: string | null;

  @Column({
    name: 'contacto_emergencia_parentesco',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  contactoEmergenciaParentesco?: string | null;

  // RELACIÓN BIDIRECCIONAL CON CLIENTES
  @ManyToMany(() => Client, (client) => client.usuariosContacto)
  clientesContacto: Client[];
}