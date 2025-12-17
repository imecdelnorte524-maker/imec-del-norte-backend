import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn({ name: 'rol_id' })
  rolId: number;

  @Column({ name: 'nombre_rol', length: 50, unique: true })
  nombreRol: string;

  @Column({ nullable: true })
  descripcion: string;

  @CreateDateColumn({ 
    name: 'fecha_creacion', 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP' 
  })
  fechaCreacion: Date;

  @OneToMany(() => User, user => user.role)
  users: User[];
}