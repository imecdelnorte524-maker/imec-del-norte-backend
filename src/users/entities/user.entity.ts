import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { TipoCedula } from '../enums/Type-cedula.enum';
import { Form } from '../../sg-sst/entities/form.entity';
import { Image } from 'src/images/entities/image.entity';
import { UserPasswordHistory } from './user-password-history.entity';

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn({ name: 'usuario_id' })
  usuarioId: number;

  @Column({ name: 'rol_id' })
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
  tipoCedula: TipoCedula;

  @Column({ length: 10, nullable: true })
  cedula: string;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 100, nullable: true })
  apellido: string;

  @Column({ length: 150, unique: true })
  email: string;

  @Column({ length: 50, unique: true })
  username: string;

  @Column({ name: 'password_hash', length: 255, nullable: true })
  passwordHash: string;

  @Column({ length: 20, nullable: true })
  telefono: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @Column({
    name: 'reset_token',
    length: 255,
    nullable: true,
  })
  resetToken: string;

  @Column({
    name: 'reset_token_expiry',
    type: 'timestamp',
    nullable: true,
  })
  resetTokenExpiry: Date;

  @OneToMany(() => Form, (form) => form.user)
  forms: Form[];

  @OneToMany(() => Image, (image) => image.user)
  images: Image[];

  // Historial de contraseñas
  @OneToMany(() => UserPasswordHistory, (history) => history.user)
  passwordHistory: UserPasswordHistory[];
  
  @Column({
    name: 'must_change_password',
    type: 'boolean',
    default: false,
  })
  mustChangePassword: boolean;
}
