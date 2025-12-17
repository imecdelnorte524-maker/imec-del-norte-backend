import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class AddRelationsToSubArea1764678220678 implements MigrationInterface {

     public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear tabla clientes
    await queryRunner.createTable(
      new Table({
        name: 'clientes',
        columns: [
          {
            name: 'id_cliente',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'nombre',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'nit',
            type: 'varchar',
            length: '20',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'direccion',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'contacto',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'telefono',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'localizacion',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'id_usuario_contacto',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Índices para clientes
    await queryRunner.createIndex(
      'clientes',
      new TableIndex({
        name: 'IDX_CLIENTES_NIT',
        columnNames: ['nit'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'clientes',
      new TableIndex({
        name: 'IDX_CLIENTES_EMAIL',
        columnNames: ['email'],
        isUnique: true,
      }),
    );

    // 2. Crear tabla areas
    await queryRunner.createTable(
      new Table({
        name: 'areas',
        columns: [
          {
            name: 'id_area',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'nombre_area',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'cliente_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Índices para areas
    await queryRunner.createIndex(
      'areas',
      new TableIndex({
        name: 'IDX_AREAS_CLIENTE',
        columnNames: ['cliente_id'],
      }),
    );

    await queryRunner.createIndex(
      'areas',
      new TableIndex({
        name: 'IDX_AREAS_NOMBRE_CLIENTE',
        columnNames: ['nombre_area', 'cliente_id'],
        isUnique: true,
      }),
    );

    // 3. Crear tabla sub_areas
    await queryRunner.createTable(
      new Table({
        name: 'sub_areas',
        columns: [
          {
            name: 'id_sub_area',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'nombre_sub_area',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'area_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Índices para sub_areas
    await queryRunner.createIndex(
      'sub_areas',
      new TableIndex({
        name: 'IDX_SUB_AREAS_AREA',
        columnNames: ['area_id'],
      }),
    );

    await queryRunner.createIndex(
      'sub_areas',
      new TableIndex({
        name: 'IDX_SUB_AREAS_NOMBRE_AREA',
        columnNames: ['nombre_sub_area', 'area_id'],
        isUnique: true,
      }),
    );

    // 4. Crear foreign keys

    // FK: areas -> clientes
    await queryRunner.createForeignKey(
      'areas',
      new TableForeignKey({
        name: 'FK_AREAS_CLIENTES',
        columnNames: ['cliente_id'],
        referencedColumnNames: ['id_cliente'],
        referencedTableName: 'clientes',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // FK: sub_areas -> areas
    await queryRunner.createForeignKey(
      'sub_areas',
      new TableForeignKey({
        name: 'FK_SUB_AREAS_AREAS',
        columnNames: ['area_id'],
        referencedColumnNames: ['id_area'],
        referencedTableName: 'areas',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // 5. Agregar comentarios a las tablas (opcional pero útil)
    await queryRunner.query(`COMMENT ON TABLE clientes IS 'Tabla de clientes del sistema'`);
    await queryRunner.query(`COMMENT ON COLUMN clientes.id_cliente IS 'Identificador único del cliente'`);
    await queryRunner.query(`COMMENT ON COLUMN clientes.nit IS 'Número de Identificación Tributaria único'`);
    await queryRunner.query(`COMMENT ON COLUMN clientes.id_usuario_contacto IS 'ID del usuario que es contacto principal'`);

    await queryRunner.query(`COMMENT ON TABLE areas IS 'Tabla de áreas por cliente'`);
    await queryRunner.query(`COMMENT ON COLUMN areas.cliente_id IS 'Referencia al cliente dueño del área'`);

    await queryRunner.query(`COMMENT ON TABLE sub_areas IS 'Tabla de subáreas por área'`);
    await queryRunner.query(`COMMENT ON COLUMN sub_areas.area_id IS 'Referencia al área padre'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar foreign keys
    const subAreasTable = await queryRunner.getTable('sub_areas');
    if (subAreasTable) {
      const foreignKeys = subAreasTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('sub_areas', foreignKey);
      }
    }

    const areasTable = await queryRunner.getTable('areas');
    if (areasTable) {
      const foreignKeys = areasTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('areas', foreignKey);
      }
    }

    // 2. Eliminar índices
    await queryRunner.dropIndex('sub_areas', 'IDX_SUB_AREAS_NOMBRE_AREA');
    await queryRunner.dropIndex('sub_areas', 'IDX_SUB_AREAS_AREA');
    
    await queryRunner.dropIndex('areas', 'IDX_AREAS_NOMBRE_CLIENTE');
    await queryRunner.dropIndex('areas', 'IDX_AREAS_CLIENTE');
    
    await queryRunner.dropIndex('clientes', 'IDX_CLIENTES_EMAIL');
    await queryRunner.dropIndex('clientes', 'IDX_CLIENTES_NIT');

    // 3. Eliminar tablas (en orden inverso por dependencias)
    await queryRunner.dropTable('sub_areas', true);
    await queryRunner.dropTable('areas', true);
    await queryRunner.dropTable('clientes', true);
  }

}
