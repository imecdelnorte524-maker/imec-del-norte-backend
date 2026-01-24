import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddInitialModulesAndRolesData1707000000000 implements MigrationInterface {

  private async ensureModulosTableExists(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('modulos');
    
    if (!tableExists) {
      console.log('⚠️ Tabla modulos no existe, creándola...');
      
      await queryRunner.createTable(
        new Table({
          name: 'modulos',
          columns: [
            {
              name: 'modulo_id',
              type: 'serial',
              isPrimary: true,
            },
            {
              name: 'nombre_modulo',
              type: 'varchar',
              length: '100',
              isNullable: false,
              isUnique: true,
            },
            {
              name: 'descripcion',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'activo',
              type: 'boolean',
              default: true,
              isNullable: false,
            },
            {
              name: 'orden',
              type: 'int',
              default: 0,
              isNullable: false,
            },
            {
              name: 'ruta_frontend',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'icono',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'codigo_interno',
              type: 'varchar',
              length: '50',
              isNullable: true,
              isUnique: true,
            },
            {
              name: 'fecha_creacion',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
            {
              name: 'fecha_actualizacion',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
          ],
        }),
        true // skipIfExists: true
      );
      
      console.log('✅ Tabla modulos creada');
    } else {
      console.log('ℹ️ Tabla modulos ya existe');
    }
  }

  private async ensureModuloRolesTableExists(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('modulo_roles');
    
    if (!tableExists) {
      console.log('⚠️ Tabla modulo_roles no existe, creándola...');
      
      await queryRunner.createTable(
        new Table({
          name: 'modulo_roles',
          columns: [
            {
              name: 'modulo_rol_id',
              type: 'serial',
              isPrimary: true,
            },
            {
              name: 'modulo_id',
              type: 'int',
              isNullable: false,
            },
            {
              name: 'rol_id',
              type: 'int',
              isNullable: false,
            },
            {
              name: 'fecha_asignacion',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
          ],
          foreignKeys: [
            {
              columnNames: ['modulo_id'],
              referencedTableName: 'modulos',
              referencedColumnNames: ['modulo_id'],
              onDelete: 'CASCADE',
            },
            {
              columnNames: ['rol_id'],
              referencedTableName: 'roles',
              referencedColumnNames: ['rol_id'],
              onDelete: 'CASCADE',
            },
          ],
          uniques: [
            {
              columnNames: ['modulo_id', 'rol_id'],
            }
          ]
        }),
        true // skipIfExists: true
      );
      
      console.log('✅ Tabla modulo_roles creada');
    } else {
      console.log('ℹ️ Tabla modulo_roles ya existe');
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Iniciando migración de datos iniciales: AddInitialModulesAndRolesData');

    // =========================================================================
    // 0. PRIMERO: Asegurar que las tablas existan
    // =========================================================================
    await this.ensureModulosTableExists(queryRunner);
    await this.ensureModuloRolesTableExists(queryRunner);

    // =========================================================================
    // 1. Insertar/Actualizar Roles (si no existen por nombre)
    // =========================================================================
    const initialRoles = [
      { nombreRol: 'Administrador', descripcion: 'Administrador del sistema con acceso completo' },
      { nombreRol: 'Técnico', descripcion: 'Personal técnico especializado' },
      { nombreRol: 'Cliente', descripcion: 'Clientes de los servicios' },
      { nombreRol: 'Secretaria', descripcion: 'Personal administrativo y de soporte' },
      { nombreRol: 'Supervisor', descripcion: 'Supervisa todos lo procesos de obras' },
      { nombreRol: 'SGSST', descripcion: 'Personal de Seguridad y Salud en el Trabajo' },
      { nombreRol: 'Marketing', descripcion: 'Encargado de marketing y publicidad' },
      { nombreRol: 'Dev', descripcion: 'Desarrollo de software de la aplicación.' },
    ];

    for (const role of initialRoles) {
      await queryRunner.query(`
        INSERT INTO roles (nombre_rol, descripcion)
        VALUES ($1, $2)
        ON CONFLICT (nombre_rol) DO NOTHING;
      `, [role.nombreRol, role.descripcion]);
    }

    await queryRunner.query(`SELECT setval('roles_rol_id_seq', COALESCE((SELECT MAX(rol_id) + 1 FROM roles), 1), false);`);
    console.log('✅ Roles insertados/verificados (ON CONFLICT DO NOTHING).');

    // =========================================================================
    // 2. Insertar Módulos (si no existen por nombre)
    // =========================================================================
    const initialModules = [
      { name: 'Página Principal', href: '/dashboard', icon: 'HomeIcon', order: 100, codigoInterno: 'MOD_DASHBOARD', description: 'Visión general y acceso rápido a funcionalidades clave del sistema.' },
      { name: 'Tablero de Registro', href: '/registration-board', icon: 'ClipboardIcon', order: 110, codigoInterno: 'MOD_REG_BOARD', description: 'Gestiona y organiza el proceso de registro de elementos o eventos.' },
      { name: 'SG-SST', href: '/sg-sst', icon: 'ShieldCheckIcon', order: 300, codigoInterno: 'MOD_SGSST', description: 'Módulo para la gestión de Seguridad y Salud en el Trabajo.' },
      { name: 'Órdenes de Servicio', href: '/orders', icon: 'ClipboardDocumentListIcon', order: 200, codigoInterno: 'MOD_ORDERS', description: 'Crea y gestiona órdenes de trabajo y servicio.' },
      { name: 'Recursos Humanos', href: '/human-resources', icon: 'UsersIcon', order: 310, codigoInterno: 'MOD_HR', description: 'Administración del personal y recursos humanos.' },
      { name: 'Requerimientos', href: '/requirements', icon: 'DocumentTextIcon', order: 210, codigoInterno: 'MOD_REQUIREMENTS', description: 'Gestiona solicitudes y necesidades de recursos o servicios.' },
      { name: 'Centro de Costos', href: '/cost-centers', icon: 'CurrencyDollarIcon', order: 320, codigoInterno: 'MOD_COST_CENTERS', description: 'Control y seguimiento de los costos asociados a diferentes áreas.' },
      { name: 'Reportes', href: '/reports', icon: 'ChartBarSquareIcon', order: 330, codigoInterno: 'MOD_REPORTS', description: 'Genera y visualiza informes de diversas áreas del sistema.' },
      { name: 'Inventario', href: '/inventory', icon: 'CubeIcon', order: 340, codigoInterno: 'MOD_INVENTORY', description: 'Administración del inventario de equipos y materiales.' },
      { name: 'Usuarios', href: '/users', icon: 'UsersIcon', order: 350, codigoInterno: 'MOD_USERS', description: 'Gestiona los usuarios del sistema y sus roles.' },
      { name: 'Clientes', href: '/clients', icon: 'UserGroupIcon', order: 360, codigoInterno: 'MOD_CLIENTS', description: 'Administra la información de los clientes.' },
      { name: 'Configuración', href: '/settings', icon: 'Cog6ToothIcon', order: 370, codigoInterno: 'MOD_SETTINGS', description: 'Configuración general del sistema y parámetros avanzados.' },
      { name: 'Equipos', href: '/equipment', icon: 'WrenchIcon', order: 220, codigoInterno: 'MOD_EQUIPMENTS', description: 'Gestiona los equipos y herramientas de la empresa.' },
      { name: 'Inspecciones', href: '/inspections', icon: 'ShieldCheckIcon', order: 230, codigoInterno: 'MOD_INSPECTIONS', description: 'Gestiona y registra las inspecciones realizadas en campo o planta.' },
    ];

    for (const mod of initialModules) {
      await queryRunner.query(`
        INSERT INTO modulos (nombre_modulo, descripcion, activo, orden, ruta_frontend, icono, codigo_interno, fecha_creacion, fecha_actualizacion)
        VALUES ($1, $2, TRUE, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (nombre_modulo) DO NOTHING;
      `, [mod.name, mod.description, mod.order, mod.href, mod.icon, mod.codigoInterno]);
    }

    await queryRunner.query(`SELECT setval('modulos_modulo_id_seq', COALESCE((SELECT MAX(modulo_id) + 1 FROM modulos), 1), false);`);
    console.log('✅ Módulos insertados/verificados (ON CONFLICT DO NOTHING).');

    // =========================================================================
    // 3. Insertar Relaciones Módulo-Rol (si no existen)
    // =========================================================================
    const roleAccess = {
      'Administrador': ["all"],
      'SGSST': ["Página Principal", "SG-SST", "Órdenes de Servicio", "Requerimientos", "Reportes", "Inspecciones"],
      'Secretaria': ["all"],
      'Supervisor': ["Página Principal", "Órdenes de Servicio", "Requerimientos", "Reportes", "Inventario"],
      'Técnico': ["Página Principal", "Órdenes de Servicio", "Reportes", "SG-SST"],
      'Cliente': ["Página Principal", "Órdenes de Servicio", "Requerimientos", "Reportes"],
      'Marketing': ["all"],
      'Dev': ["all"],
    };

    const allModuleNames = initialModules.map(m => m.name);

    for (const roleName in roleAccess) {
      const allowedModulesConfig = roleAccess[roleName];

      const modulesToAssign = allowedModulesConfig[0] === "all" ? allModuleNames : allowedModulesConfig;

      for (const moduleName of modulesToAssign) {
        await queryRunner.query(`
          INSERT INTO modulo_roles (modulo_id, rol_id)
          SELECT m.modulo_id, r.rol_id
          FROM modulos m, roles r
          WHERE m.nombre_modulo = $1 AND r.nombre_rol = $2
          ON CONFLICT (modulo_id, rol_id) DO NOTHING;
        `, [moduleName, roleName]);
      }
    }
    console.log('✅ Relaciones Módulo-Rol insertadas/verificadas (ON CONFLICT DO NOTHING).');
    console.log('Migración de datos iniciales finalizada: AddInitialModulesAndRolesData');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Iniciando rollback de datos iniciales: AddInitialModulesAndRolesData');

    // Listas de identificación para los DELETEs
    const allModuleNames = [ // Usamos nombres para los módulos
        'Página Principal', 'Tablero de Registro', 'SG-SST', 'Órdenes de Servicio', 'Recursos Humanos',
        'Requerimientos', 'Centro de Costos', 'Reportes', 'Inventario', 'Usuarios',
        'Clientes', 'Configuración', 'Equipos', 'Inspecciones'
    ];
    const allRoleNames = [
      'Administrador', 'Técnico', 'Cliente', 'Secretaria', 'Supervisor',
      'SGSST', 'Marketing', 'Dev',
    ];

    // =========================================================================
    // 1. Eliminar relaciones Módulo-Rol (solo las que esta migración pudo insertar)
    //    Usamos nombres para identificar los registros.
    // =========================================================================
    await queryRunner.query(`
      DELETE FROM modulo_roles
      WHERE modulo_id IN (
          SELECT modulo_id FROM modulos WHERE nombre_modulo IN (${allModuleNames.map((name) => `'${name}'`).join(', ')})
      ) AND rol_id IN (
          SELECT rol_id FROM roles WHERE nombre_rol IN (${allRoleNames.map((name) => `'${name}'`).join(', ')})
      );
    `);
    console.log('✅ Relaciones Módulo-Rol eliminadas.');

    // =========================================================================
    // 2. Eliminar Módulos (solo los que esta migración pudo insertar)
    //    Usamos los nombres para identificarlos.
    // =========================================================================
    await queryRunner.query(`
      DELETE FROM modulos
      WHERE nombre_modulo IN (${allModuleNames.map((name) => `'${name}'`).join(', ')})
    `);
    console.log('✅ Módulos eliminados.');

    // =========================================================================
    // 3. Eliminar Roles (solo los que esta migración pudo insertar)
    //    Ahora, SIN un try-catch. Si el rol tiene usuarios, el DELETE fallará
    //    y la migración se revertirá, lo cual es el comportamiento esperado
    //    para una migración de "seeding" de roles que tienen FKs.
    //    La alternativa sería NULLIFY los usuarios, pero eso es una decisión
    //    de negocio que va más allá de un simple seeding.
    // =========================================================================
    await queryRunner.query(`
        DELETE FROM roles
        WHERE nombre_rol IN (${allRoleNames.map((name) => `'${name}'`).join(', ')})
    `);
    console.log('✅ Roles eliminados.');

    console.log('Rollback de datos iniciales finalizado: AddInitialModulesAndRolesData');
  }
}