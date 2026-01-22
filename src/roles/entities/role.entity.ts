import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, ManyToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Module } from '../../modules/entities/module.entity'; // Importa la nueva entidad Module

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

  // Nueva relación Many-to-Many con Módulos
  @ManyToMany(() => Module, module => module.roles)
  modules: Module[]; // Un rol puede estar asociado a muchos módulos
}