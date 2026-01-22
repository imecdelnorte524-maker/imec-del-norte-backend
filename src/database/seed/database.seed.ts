import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../../roles/entities/role.entity';
import { User } from '../../users/entities/user.entity';
import { Service } from '../../services/entities/service.entity';

export class DatabaseSeed {
  constructor(private dataSource: DataSource) {}

  async seed() {
    console.log('🌱 Iniciando seed de la base de datos...');

    try {
      // 1. Crear roles si no existen
      const roleRepository = this.dataSource.getRepository(Role);
      const rolesData = [
        { nombreRol: 'Administrador', descripcion: 'Administrador del sistema' },
        { nombreRol: 'Técnico', descripcion: 'Personal técnico' },
        { nombreRol: 'Cliente', descripcion: 'Clientes del servicio' },
        { nombreRol: 'Secretaria', descripcion: 'Secretaria en sede principal, encargada de otros asuntos contables' },
      ];

      for (const roleData of rolesData) {
        await roleRepository.save(
          roleRepository.create(roleData)
        ).catch(() => {
          console.log(`✅ Rol ${roleData.nombreRol} ya existe`);
        });
      }
      console.log('✅ Roles creados/verificados');

      // 2. Obtener IDs de los roles
      const rolAdmin = await roleRepository.findOne({ where: { nombreRol: 'Administrador' } });
      const rolTecnico = await roleRepository.findOne({ where: { nombreRol: 'Técnico' } });
      const rolCliente = await roleRepository.findOne({ where: { nombreRol: 'Cliente' } });
      const rolSecretaria = await roleRepository.findOne({ where: { nombreRol: 'Secretaria' } });

      if (!rolAdmin || !rolTecnico || !rolCliente || !rolSecretaria) {
        throw new Error('No se pudieron encontrar los roles');
      }

      // 3. Hash de contraseña por defecto
      const passwordHash = await bcrypt.hash('password123!', 10);

      // 4. Crear usuarios
      const userRepository = this.dataSource.getRepository(User);
      const usersData = [
        {
          rolId: rolAdmin.rolId,
          nombre: 'William',
          apellido: 'Rojas',
          email: 'willian.rojas@imec.com',
          username: 'willianrojas',
          passwordHash: passwordHash,
          telefono: '+1234567890',
        },
        {
          rolId: rolAdmin.rolId,
          nombre: 'Luis',
          apellido: 'Talero',
          email: 'luis.talero@imec.com',
          username: 'luistalero',
          passwordHash: passwordHash,
          telefono: '3008932430',
        },
        {
          rolId: rolTecnico.rolId,
          nombre: 'German',
          apellido: 'Rincón',
          email: 'german.rincon@imec.com',
          username: 'germanrincon',
          passwordHash: passwordHash,
          telefono: '+1234567892',
        },
        {
          rolId: rolCliente.rolId,
          nombre: 'Carlos',
          apellido: 'López',
          email: 'carlos.lopez@cliente.com',
          username: 'carloslopez',
          passwordHash: passwordHash,
          telefono: '+1234567892',
        },
        {
          rolId: rolSecretaria.rolId,
          nombre: 'Alexandra',
          apellido: 'Hernández',
          email: 'alexandra.hernandez@imec.com',
          username: 'alexandrahernandez',
          passwordHash: passwordHash,
          telefono: '+1234567893',
        },
      ];

      for (const userData of usersData) {
        await userRepository.save(
          userRepository.create(userData)
        ).catch((error) => {
          if (error.code === '23505') { // Unique violation
            console.log(`✅ Usuario ${userData.email} ya existe`);
          } else {
            throw error;
          }
        });
      }
      console.log('✅ Usuarios creados/verificados');

      // 5. Crear servicios
      const serviceRepository = this.dataSource.getRepository(Service);
      const servicesData = [
        {
          nombreServicio: 'Instalación de Aires Acondicionados',
          descripcion: 'Instalación profesional de sistemas de aire acondicionado',
          precioBase: 0.00,
          duracionEstimada: '4-6 horas',
        },
        {
          nombreServicio: 'Redes contra incendios',
          descripcion: 'Instalación y mantenimiento de sistemas de redes contra incendios',
          precioBase: 0.00,
          duracionEstimada: '1-2 días',
        },
        {
          nombreServicio: 'Obras Civiles',
          descripcion: 'Servicios de construcción y obras civiles para proyectos variados',
          precioBase: 0.00,
          duracionEstimada: 'Variable',
        },
        {
          nombreServicio: 'Redes Electricas',
          descripcion: 'Instalación y mantenimiento de redes eléctricas residenciales e industriales',
          precioBase: 0.00,
          duracionEstimada: '1-3 días',
        },
      ];

      for (const serviceData of servicesData) {
        await serviceRepository.save(
          serviceRepository.create(serviceData)
        ).catch((error) => {
          if (error.code === '23505') {
            console.log(`✅ Servicio ${serviceData.nombreServicio} ya existe`);
          } else {
            throw error;
          }
        });
      }

      console.log('✅ Servicios creados');
      console.log('🎉 Seed completado exitosamente!');

    } catch (error) {
      console.error('❌ Error durante el seed:', error);
      throw error;
    }
  }
}