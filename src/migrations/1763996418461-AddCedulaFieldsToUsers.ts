import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from "typeorm";

export class AddCedulaFieldsToUsers1763996418461 implements MigrationInterface {
    name = 'AddCedulaFieldsToUsers1763996418461'

    public async up(queryRunner: QueryRunner): Promise<void> {

        // 1. Crear tabla de roles si no existe
        await this.createRolesTable(queryRunner);

        // 2. Crear tabla de usuarios si no existe (con los campos nuevos)
        await this.createUsersTable(queryRunner);

        // 3. Crear tabla de servicios si no existe
        await this.createServicesTable(queryRunner);

        // 4. Crear tabla de equipos si no existe
        await this.createEquipmentTable(queryRunner);

        // 5. Crear tabla de insumos si no existe
        await this.createSuppliesTable(queryRunner);

        // 6. Crear tabla de inventario si no existe
        await this.createInventoryTable(queryRunner);

        // 7. Crear tabla de órdenes de trabajo si no existe
        await this.createWorkOrdersTable(queryRunner);

        // 8. Crear tabla de detalles de insumos usados si no existe
        await this.createUsedSuppliesTable(queryRunner);

        // 9. Crear tabla de detalles de herramienta asignado si no existe
        await this.createAssignedEquipmentTable(queryRunner);

        // 10. Insertar datos iniciales
        await this.insertInitialData(queryRunner);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        
        // Eliminar en orden inverso (por dependencias de FK)
        await queryRunner.dropTable('detalles_equipo_asignado');
        await queryRunner.dropTable('detalles_insumo_usado');
        await queryRunner.dropTable('ordenes_trabajo');
        await queryRunner.dropTable('inventario');
        await queryRunner.dropTable('insumos');
        await queryRunner.dropTable('equipos');
        await queryRunner.dropTable('servicios');
        await queryRunner.dropTable('usuarios');
        await queryRunner.dropTable('roles');
        
    }

    private async createRolesTable(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('roles');
        if (!tableExists) {
            await queryRunner.createTable(new Table({
                name: 'roles',
                columns: [
                    {
                        name: 'rol_id',
                        type: 'serial',
                        isPrimary: true
                    },
                    {
                        name: 'nombre_rol',
                        type: 'varchar',
                        length: '50',
                        isUnique: true,
                        isNullable: false
                    },
                    {
                        name: 'descripcion',
                        type: 'text',
                        isNullable: true
                    }
                ]
            }));
        } else {
            console.log('ℹ️  Tabla roles ya existe');
        }
    }

    private async createUsersTable(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('usuarios');
        if (!tableExists) {
            await queryRunner.createTable(new Table({
                name: 'usuarios',
                columns: [
                    {
                        name: 'usuario_id',
                        type: 'serial',
                        isPrimary: true
                    },
                    {
                        name: 'rol_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'nombre',
                        type: 'varchar',
                        length: '100',
                        isNullable: false
                    },
                    {
                        name: 'apellido',
                        type: 'varchar',
                        length: '100',
                        isNullable: true
                    },
                    {
                        name: 'tipo_cedula',
                        type: 'varchar',
                        length: '10',
                        default: "'CC'",
                        isNullable: true
                    },
                    {
                        name: 'cedula',
                        type: 'varchar',
                        length: '20',
                        isNullable: true
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                        length: '150',
                        isUnique: true,
                        isNullable: false
                    },
                    {
                        name: 'username',
                        type: 'varchar',
                        length: '50',
                        isUnique: true,
                        isNullable: false
                    },
                    {
                        name: 'password_hash',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'telefono',
                        type: 'varchar',
                        length: '20',
                        isNullable: true
                    },
                    {
                        name: 'activo',
                        type: 'boolean',
                        default: true
                    },
                    {
                        name: 'fecha_creacion',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    }
                ],
                foreignKeys: [
                    {
                        columnNames: ['rol_id'],
                        referencedTableName: 'roles',
                        referencedColumnNames: ['rol_id'],
                        onDelete: 'RESTRICT'
                    }
                ]
            }));
        } else {
            console.log('ℹ️  Tabla usuarios ya existe');
            // Agregar columnas faltantes si la tabla ya existe
            await this.addMissingColumnsToUsers(queryRunner);
        }
    }

    private async addMissingColumnsToUsers(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('usuarios');
        
        // Agregar tipo_cedula si no existe
        const tipoCedulaColumn = table?.findColumnByName('tipo_cedula');
        if (!tipoCedulaColumn) {
            await queryRunner.addColumn('usuarios', 
                new TableColumn({
                    name: 'tipo_cedula',
                    type: 'varchar',
                    length: '10',
                    default: "'CC'",
                    isNullable: true,
                })
            );
        }

        // Agregar cedula si no existe
        const cedulaColumn = table?.findColumnByName('cedula');
        if (!cedulaColumn) {
            await queryRunner.addColumn('usuarios', 
                new TableColumn({
                    name: 'cedula',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                })
            );
        }
    }

    private async createServicesTable(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('servicios');
        if (!tableExists) {
            await queryRunner.createTable(new Table({
                name: 'servicios',
                columns: [
                    {
                        name: 'servicio_id',
                        type: 'serial',
                        isPrimary: true
                    },
                    {
                        name: 'nombre_servicio',
                        type: 'varchar',
                        length: '150',
                        isUnique: true,
                        isNullable: false
                    },
                    {
                        name: 'descripcion',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'precio_base',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: 'duracion_estimada',
                        type: 'varchar',
                        length: '50',
                        isNullable: true
                    }
                ]
            }));
        } else {
            console.log('ℹ️  Tabla servicios ya existe');
        }
    }

    private async createEquipmentTable(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('equipos');
        if (!tableExists) {
            await queryRunner.createTable(new Table({
                name: 'equipos',
                columns: [
                    {
                        name: 'herramienta_id',
                        type: 'serial',
                        isPrimary: true
                    },
                    {
                        name: 'nombre',
                        type: 'varchar',
                        length: '100',
                        isNullable: false
                    },
                    {
                        name: 'marca',
                        type: 'varchar',
                        length: '100',
                        isNullable: true
                    },
                    {
                        name: 'serial',
                        type: 'varchar',
                        length: '100',
                        isUnique: true,
                        isNullable: true
                    },
                    {
                        name: 'modelo',
                        type: 'varchar',
                        length: '100',
                        isNullable: true
                    },
                    {
                        name: 'caracteristicas_tecnicas',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'observacion',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'fecha_registro',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'tipo',
                        type: 'varchar',
                        length: '50',
                        isNullable: false
                    },
                    {
                        name: 'estado',
                        type: 'varchar',
                        length: '50',
                        isNullable: false
                    },
                    {
                        name: 'valor_unitario',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: 'foto_url',
                        type: 'text',
                        isNullable: true
                    }
                ]
            }));
        } else {
            console.log('ℹ️  Tabla equipos ya existe');
        }
    }

    private async createSuppliesTable(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('insumos');
        if (!tableExists) {
            await queryRunner.createTable(new Table({
                name: 'insumos',
                columns: [
                    {
                        name: 'insumo_id',
                        type: 'serial',
                        isPrimary: true
                    },
                    {
                        name: 'nombre',
                        type: 'varchar',
                        length: '100',
                        isNullable: false
                    },
                    {
                        name: 'categoria',
                        type: 'varchar',
                        length: '100',
                        isNullable: false
                    },
                    {
                        name: 'unidad_medida',
                        type: 'varchar',
                        length: '50',
                        isNullable: false
                    },
                    {
                        name: 'stock',
                        type: 'int',
                        default: 0
                    },
                    {
                        name: 'estado',
                        type: 'varchar',
                        length: '50',
                        isNullable: false
                    },
                    {
                        name: 'fecha_registro',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'stock_min',
                        type: 'int',
                        default: 0
                    },
                    {
                        name: 'valor_unitario',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: 'foto_url',
                        type: 'text',
                        isNullable: true
                    }
                ]
            }));
        } else {
            console.log('ℹ️  Tabla insumos ya existe');
        }
    }

    private async createInventoryTable(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('inventario');
        if (!tableExists) {
            await queryRunner.createTable(new Table({
                name: 'inventario',
                columns: [
                    {
                        name: 'inventario_id',
                        type: 'serial',
                        isPrimary: true
                    },
                    {
                        name: 'insumo_id',
                        type: 'int',
                        isNullable: true
                    },
                    {
                        name: 'herramienta_id',
                        type: 'int',
                        isNullable: true
                    },
                    {
                        name: 'cantidad_actual',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        default: 0
                    },
                    {
                        name: 'ubicacion',
                        type: 'varchar',
                        length: '100',
                        isNullable: true
                    },
                    {
                        name: 'fecha_ultima_actualizacion',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    }
                ],
                foreignKeys: [
                    {
                        columnNames: ['insumo_id'],
                        referencedTableName: 'insumos',
                        referencedColumnNames: ['insumo_id'],
                        onDelete: 'CASCADE'
                    },
                    {
                        columnNames: ['herramienta_id'],
                        referencedTableName: 'equipos',
                        referencedColumnNames: ['herramienta_id'],
                        onDelete: 'CASCADE'
                    }
                ],
                uniques: [
                    {
                        columnNames: ['ubicacion', 'insumo_id', 'herramienta_id']
                    }
                ]
            }));
        } else {
            console.log('ℹ️  Tabla inventario ya existe');
        }
    }

    private async createWorkOrdersTable(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('ordenes_trabajo');
        if (!tableExists) {
            await queryRunner.createTable(new Table({
                name: 'ordenes_trabajo',
                columns: [
                    {
                        name: 'orden_id',
                        type: 'serial',
                        isPrimary: true
                    },
                    {
                        name: 'servicio_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'cliente_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'tecnico_id',
                        type: 'int',
                        isNullable: true
                    },
                    {
                        name: 'fecha_solicitud',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'fecha_inicio',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'fecha_finalizacion',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'estado',
                        type: 'varchar',
                        length: '50',
                        default: "'Pendiente'"
                    },
                    {
                        name: 'comentarios',
                        type: 'text',
                        isNullable: true
                    }
                ],
                foreignKeys: [
                    {
                        columnNames: ['servicio_id'],
                        referencedTableName: 'servicios',
                        referencedColumnNames: ['servicio_id'],
                        onDelete: 'RESTRICT'
                    },
                    {
                        columnNames: ['cliente_id'],
                        referencedTableName: 'usuarios',
                        referencedColumnNames: ['usuario_id'],
                        onDelete: 'RESTRICT'
                    },
                    {
                        columnNames: ['tecnico_id'],
                        referencedTableName: 'usuarios',
                        referencedColumnNames: ['usuario_id'],
                        onDelete: 'SET NULL'
                    }
                ]
            }));
        } else {
            console.log('ℹ️  Tabla ordenes_trabajo ya existe');
        }
    }

    private async createUsedSuppliesTable(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('detalles_insumo_usado');
        if (!tableExists) {
            await queryRunner.createTable(new Table({
                name: 'detalles_insumo_usado',
                columns: [
                    {
                        name: 'detalle_insumo_id',
                        type: 'serial',
                        isPrimary: true
                    },
                    {
                        name: 'orden_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'insumo_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'cantidad_usada',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: 'costo_unitario_al_momento',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: true
                    }
                ],
                foreignKeys: [
                    {
                        columnNames: ['orden_id'],
                        referencedTableName: 'ordenes_trabajo',
                        referencedColumnNames: ['orden_id'],
                        onDelete: 'CASCADE'
                    },
                    {
                        columnNames: ['insumo_id'],
                        referencedTableName: 'insumos',
                        referencedColumnNames: ['insumo_id'],
                        onDelete: 'RESTRICT'
                    }
                ]
            }));
        } else {
            console.log('ℹ️  Tabla detalles_insumo_usado ya existe');
        }
    }

    private async createAssignedEquipmentTable(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('detalles_equipo_asignado');
        if (!tableExists) {
            await queryRunner.createTable(new Table({
                name: 'detalles_equipo_asignado',
                columns: [
                    {
                        name: 'detalle_equipo_id',
                        type: 'serial',
                        isPrimary: true
                    },
                    {
                        name: 'orden_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'herramienta_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'tiempo_uso',
                        type: 'varchar',
                        length: '50',
                        isNullable: true
                    },
                    {
                        name: 'comentarios_uso',
                        type: 'text',
                        isNullable: true
                    }
                ],
                foreignKeys: [
                    {
                        columnNames: ['orden_id'],
                        referencedTableName: 'ordenes_trabajo',
                        referencedColumnNames: ['orden_id'],
                        onDelete: 'CASCADE'
                    },
                    {
                        columnNames: ['herramienta_id'],
                        referencedTableName: 'equipos',
                        referencedColumnNames: ['herramienta_id'],
                        onDelete: 'RESTRICT'
                    }
                ]
            }));
        } else {
            console.log('ℹ️  Tabla detalles_equipo_asignado ya existe');
        }
    }

    private async insertInitialData(queryRunner: QueryRunner): Promise<void> {

        // 1. Insertar roles básicos del sistema
        await queryRunner.query(`
            INSERT INTO roles (nombre_rol, descripcion) VALUES
            ('Administrador', 'Administrador del sistema con acceso completo'),
            ('Técnico', 'Personal técnico especializado'),
            ('Cliente', 'Clientes de los servicios'),
            ('Secretaria', 'Personal administrativo y de soporte'),
            ('Supervisor', 'Supervisa todos lo procesos de obras'),
            ('SGSST', 'Personal de Seguridad y Salud en el Trabajo'),
            ('Marketing', 'Encargado de marketing y publicidad')
            ON CONFLICT (nombre_rol) DO NOTHING;
        `);

        // 2. Obtener el ID real del rol Administrador
        const adminRoles = await queryRunner.query(
            `SELECT rol_id FROM roles WHERE nombre_rol = 'Administrador'`
        );
        
        if (adminRoles.length === 0) {
            throw new Error('❌ No se pudo encontrar el rol Administrador');
        }

        const adminRoleId = adminRoles[0].rol_id;

        // 3. Insertar usuario administrador con los nuevos campos
        await queryRunner.query(
            `INSERT INTO usuarios (
                rol_id, 
                nombre, 
                apellido, 
                tipo_cedula, 
                cedula, 
                email, 
                username, 
                password_hash, 
                telefono, 
                activo
            ) VALUES ($1, 'Luis Alberto', 'Talero Martinez', 'CC', '1066280771', 
                     'lt726875@gmail.com', 'admin', 
                     'Admin123!', 
                     '3008932430', true)
            ON CONFLICT (email) DO NOTHING`,
            [adminRoleId]
        );

        // 4. Insertar servicios base del sistema
        await queryRunner.query(`
            INSERT INTO servicios (nombre_servicio, descripcion, precio_base, duracion_estimada) VALUES
            ('Instalación de Aires Acondicionados', 'Instalación profesional de sistemas de aire acondicionado residencial e industrial', 0.00, '4-6 horas'),
            ('Redes contra incendios', 'Instalación y mantenimiento de sistemas de redes contra incendios', 0.00, '1-2 días'),
            ('Obras Civiles', 'Servicios de construcción y obras civiles para proyectos variados', 0.00, 'Variable'),
            ('Redes Eléctricas', 'Instalación y mantenimiento de redes eléctricas residenciales e industriales', 0.00, '1-3 días'),
            ('Mantenimiento Preventivo', 'Mantenimiento preventivo de equipos y sistemas', 0.00, '2-4 horas'),
            ('Reparación de Equipos', 'Diagnóstico y reparación de equipos especializados', 0.00, '2-8 horas')
            ON CONFLICT (nombre_servicio) DO NOTHING;
        `);
    }
}