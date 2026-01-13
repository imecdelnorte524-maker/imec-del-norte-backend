import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddModulesAndModuleRolesTables1768005854091 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear la tabla 'modulos'
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
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true, // indica que si la tabla existe, no lance error
    );

    // 2. Crear índices para la tabla 'modulos' (opcional pero recomendado para rendimiento)
    await queryRunner.createIndex(
      'modulos',
      new TableIndex({
        name: 'IDX_MODULOS_NOMBRE',
        columnNames: ['nombre_modulo'],
      }),
    );

    await queryRunner.createIndex(
      'modulos',
      new TableIndex({
        name: 'IDX_MODULOS_CODIGO_INTERNO',
        columnNames: ['codigo_interno'],
      }),
    );

    await queryRunner.createIndex(
      'modulos',
      new TableIndex({
        name: 'IDX_MODULOS_ACTIVO',
        columnNames: ['activo'],
      }),
    );

    // 3. Crear la tabla intermedia 'modulo_roles' para la relación Many-to-Many
    await queryRunner.createTable(
      new Table({
        name: 'modulo_roles',
        columns: [
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
        ],
      }),
      true,
    );

    // 4. Crear la clave primaria compuesta en 'modulo_roles'
    await queryRunner.query(
      `ALTER TABLE "modulo_roles" ADD CONSTRAINT "PK_modulo_roles" PRIMARY KEY ("modulo_id", "rol_id")`,
    );

    // 5. Crear la Foreign Key de 'modulo_roles.modulo_id' hacia 'modulos.modulo_id'
    await queryRunner.createForeignKey(
      'modulo_roles',
      new TableForeignKey({
        name: 'FK_modulo_roles_modulo',
        columnNames: ['modulo_id'],
        referencedTableName: 'modulos',
        referencedColumnNames: ['modulo_id'],
        onDelete: 'CASCADE', // Si se elimina un módulo, se eliminan sus relaciones
        onUpdate: 'CASCADE',
      }),
    );

    // 6. Crear la Foreign Key de 'modulo_roles.rol_id' hacia 'roles.rol_id'
    await queryRunner.createForeignKey(
      'modulo_roles',
      new TableForeignKey({
        name: 'FK_modulo_roles_rol',
        columnNames: ['rol_id'],
        referencedTableName: 'roles',
        referencedColumnNames: ['rol_id'],
        onDelete: 'CASCADE', // Si se elimina un rol, se eliminan sus relaciones
        onUpdate: 'CASCADE',
      }),
    );

    // 7. Crear índices para la tabla intermedia (recomendado para búsquedas rápidas)
    await queryRunner.createIndex(
      'modulo_roles',
      new TableIndex({
        name: 'IDX_MODULO_ROLES_MODULO',
        columnNames: ['modulo_id'],
      }),
    );

    await queryRunner.createIndex(
      'modulo_roles',
      new TableIndex({
        name: 'IDX_MODULO_ROLES_ROL',
        columnNames: ['rol_id'],
      }),
    );

    console.log('✅ Tablas "modulos" y "modulo_roles" creadas exitosamente');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir los cambios en orden inverso

    // 1. Eliminar índices de 'modulo_roles'
    await queryRunner.dropIndex('modulo_roles', 'IDX_MODULO_ROLES_ROL');
    await queryRunner.dropIndex('modulo_roles', 'IDX_MODULO_ROLES_MODULO');

    // 2. Eliminar las Foreign Keys de 'modulo_roles'
    await queryRunner.dropForeignKey('modulo_roles', 'FK_modulo_roles_rol');
    await queryRunner.dropForeignKey('modulo_roles', 'FK_modulo_roles_modulo');

    // 3. Eliminar la tabla 'modulo_roles' (primero porque tiene FKs)
    await queryRunner.dropTable('modulo_roles', true);

    // 4. Eliminar índices de 'modulos'
    await queryRunner.dropIndex('modulos', 'IDX_MODULOS_ACTIVO');
    await queryRunner.dropIndex('modulos', 'IDX_MODULOS_CODIGO_INTERNO');
    await queryRunner.dropIndex('modulos', 'IDX_MODULOS_NOMBRE');

    // 5. Eliminar la tabla 'modulos'
    await queryRunner.dropTable('modulos', true);

    console.log(
      '✅ Tablas "modulos" y "modulo_roles" eliminadas exitosamente (rollback)',
    );
  }
}
