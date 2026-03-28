import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedCoreData1774533397890 implements MigrationInterface {
  name = 'SeedCoreData1774533397890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Asegura que el schema base existe (si no, es mejor fallar).
    const requiredTables = [
      'roles',
      'usuarios',
      'servicios',
      'modulos',
      'modulo_roles',
    ];

    for (const t of requiredTables) {
      const ok = await queryRunner.hasTable(t);
      if (!ok) {
        throw new Error(
          `SeedCoreDataEnvAdmin: falta la tabla "${t}". Ejecuta InitialSchema primero.`,
        );
      }
    }

    // 1) Rol Administrador
    await queryRunner.query(`
      INSERT INTO roles (nombre_rol, descripcion, fecha_creacion)
      VALUES ('Administrador', 'Administrador del sistema con acceso completo', NOW())
      ON CONFLICT (nombre_rol) DO NOTHING;
    `);

    // 2) Servicios iniciales
    await queryRunner.query(`
      INSERT INTO servicios (nombre_servicio, descripcion, duracion_estimada, categoria_servicio)
      VALUES
        (
          'Aires Acondicionados',
          'Instalación profesional de sistemas de aire acondicionado residencial e industrial',
          'Variable',
          'Aires Acondicionados'::public."servicios_categoria_servicio_enum"
        ),
        (
          'Redes contra incendios',
          'Instalación y mantenimiento de sistemas de redes contra incendios',
          'Variable',
          'Redes Contra Incendios'::public."servicios_categoria_servicio_enum"
        ),
        (
          'Redes Eléctricas',
          'Instalación y mantenimiento de redes eléctricas residenciales e industriales',
          'Variable',
          'Redes Eléctricas'::public."servicios_categoria_servicio_enum"
        ),
        (
          'Obras Civiles',
          'Servicios de construcción y obras civiles para proyectos variados',
          'Variable',
          'Obras Civiles'::public."servicios_categoria_servicio_enum"
        )
      ON CONFLICT (nombre_servicio) DO NOTHING;
    `);

    // 3) Módulos iniciales (por codigo_interno)
    await queryRunner.query(`
      INSERT INTO modulos
        (nombre_modulo, descripcion, activo, orden, ruta_frontend, icono, codigo_interno, fecha_creacion, fecha_actualizacion)
      VALUES
        ('Página Principal','Visión general y acceso rápido a funcionalidades clave del sistema.', true, 100, '/dashboard', 'HomeIcon', 'MOD_DASHBOARD', NOW(), NOW()),
        ('Tablero de Registro','Gestiona y organiza el proceso de registro de elementos o eventos.', true, 110, '/registration-board', 'ClipboardIcon', 'MOD_REG_BOARD', NOW(), NOW()),
        ('SG-SST','Módulo para la gestión de Seguridad y Salud en el Trabajo.', true, 300, '/sg-sst', 'ShieldCheckIcon', 'MOD_SGSST', NOW(), NOW()),
        ('Órdenes de Servicio','Crea y gestiona órdenes de trabajo y servicio.', true, 200, '/orders', 'ClipboardDocumentListIcon', 'MOD_ORDERS', NOW(), NOW()),
        ('Recursos Humanos','Administración del personal y recursos humanos.', true, 310, '/human-resources', 'UsersIcon', 'MOD_HR', NOW(), NOW()),
        ('Requerimientos','Gestiona solicitudes y necesidades de recursos o servicios.', true, 210, '/requirements', 'DocumentTextIcon', 'MOD_REQUIREMENTS', NOW(), NOW()),
        ('Centro de Costos','Control y seguimiento de los costos asociados a diferentes áreas.', true, 320, '/cost-centers', 'CurrencyDollarIcon', 'MOD_COST_CENTERS', NOW(), NOW()),
        ('Reportes','Genera y visualiza informes de diversas áreas del sistema.', true, 330, '/reports', 'ChartBarSquareIcon', 'MOD_REPORTS', NOW(), NOW()),
        ('Inventario','Administración del inventario de equipos y materiales.', true, 340, '/inventory', 'CubeIcon', 'MOD_INVENTORY', NOW(), NOW()),
        ('Usuarios','Gestiona los usuarios del sistema y sus roles.', true, 350, '/users', 'UsersIcon', 'MOD_USERS', NOW(), NOW()),
        ('Clientes','Administra la información de los clientes.', true, 360, '/clients', 'UserGroupIcon', 'MOD_CLIENTS', NOW(), NOW()),
        ('Configuración','Configuración general del sistema y parámetros avanzados.', true, 370, '/settings', 'Cog6ToothIcon', 'MOD_SETTINGS', NOW(), NOW()),
        ('Equipos','Gestiona los equipos y herramientas de la empresa.', true, 220, '/equipment', 'WrenchIcon', 'MOD_EQUIPMENTS', NOW(), NOW())
      ON CONFLICT (codigo_interno) DO NOTHING;
    `);

    // 4) Dar acceso de todos los módulos al rol Administrador
    await queryRunner.query(`
      INSERT INTO modulo_roles (modulo_id, rol_id)
      SELECT m.modulo_id, r.rol_id
      FROM modulos m
      JOIN roles r ON r.nombre_rol = 'Administrador'
      ON CONFLICT (modulo_id, rol_id) DO NOTHING;
    `);

    // 5) Admin inicial desde ENV (solo si no existe)
    const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || '').trim();
    const adminUsername = (
      process.env.INITIAL_ADMIN_USERNAME || 'admin'
    ).trim();
    const adminPassword = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();
    const adminName = (
      process.env.INITIAL_ADMIN_NAME || 'Administrador'
    ).trim();

    // Si ya existe un admin por username o email, no hacemos nada (no pisamos).
    const exists = await queryRunner.query(
      `
      SELECT usuario_id
      FROM usuarios
      WHERE username = $1
         OR ($2 <> '' AND email = $2)
      LIMIT 1
      `,
      [adminUsername, adminEmail],
    );

    if (exists?.length) return;

    // Si no existe, entonces sí exigimos credenciales por ENV
    if (!adminEmail || !adminPassword) {
      throw new Error(
        'SeedCoreDataEnvAdmin: no existe el admin y faltan INITIAL_ADMIN_EMAIL o INITIAL_ADMIN_PASSWORD en variables de entorno.',
      );
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Partir nombre completo en nombre/apellido (simple)
    const parts = adminName.split(' ').filter(Boolean);
    const nombre = parts.shift() || 'Administrador';
    const apellido = parts.join(' ') || null;

    await queryRunner.query(
      `
      INSERT INTO usuarios
        (rol_id, nombre, apellido, email, username, password_hash, activo, fecha_creacion, must_change_password)
      SELECT
        r.rol_id, $1, $2, $3, $4, $5, true, NOW(), true
      FROM roles r
      WHERE r.nombre_rol = 'Administrador'
      `,
      [nombre, apellido, adminEmail, adminUsername, passwordHash],
    );
  }

  public async down(): Promise<void> {
    throw new Error('Down no soportado para SeedCoreDataEnvAdmin');
  }
}
