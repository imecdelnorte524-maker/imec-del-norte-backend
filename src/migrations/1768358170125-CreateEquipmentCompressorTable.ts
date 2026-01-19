import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateEquipmentCompressorTable1768358170125 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la tabla ya existe
    const tableExists = await queryRunner.hasTable('equipment_compressors');
    
    if (!tableExists) {
      // 1. Crear tabla equipment_compressors
      await queryRunner.createTable(
        new Table({
          name: 'equipment_compressors',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'equipment_id',
              type: 'int',
              isNullable: false,
            },
            {
              name: 'marca',
              type: 'varchar',
              length: '150',
              isNullable: true,
            },
            {
              name: 'modelo',
              type: 'varchar',
              length: '150',
              isNullable: true,
            },
            {
              name: 'serial',
              type: 'varchar',
              length: '150',
              isNullable: true,
            },
            {
              name: 'capacidad',
              type: 'varchar',
              length: '150',
              isNullable: true,
            },
            {
              name: 'amperaje',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'tipo_refrigerante',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'voltaje',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'numero_fases',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'tipo_aceite',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'cantidad_aceite',
              type: 'varchar',
              length: '50',
              isNullable: true,
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

      // 2. Crear foreign key a la tabla equipos
      await queryRunner.createForeignKey(
        'equipment_compressors',
        new TableForeignKey({
          columnNames: ['equipment_id'],
          referencedColumnNames: ['equipo_id'],
          referencedTableName: 'equipos',
          onDelete: 'CASCADE',
        }),
      );

      // 3. Crear índice para mejor performance - CORREGIDO
      await queryRunner.createIndex(
        'equipment_compressors',
        new TableIndex({
          name: 'IDX_EQUIPMENT_COMPRESSORS_EQUIPMENT_ID',
          columnNames: ['equipment_id'],
        }),
      );

      console.log('✅ Tabla equipment_compressors creada exitosamente');
    } else {
      console.log('ℹ️ La tabla equipment_compressors ya existe');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar índice - CORREGIDO
    const table = await queryRunner.getTable('equipment_compressors');
    if (table) {
      const index = table.indices.find(idx => idx.name === 'IDX_EQUIPMENT_COMPRESSORS_EQUIPMENT_ID');
      if (index) {
        await queryRunner.dropIndex('equipment_compressors', index);
      }
    }

    // 2. Eliminar foreign key
    const tableWithFk = await queryRunner.getTable('equipment_compressors');
    if (tableWithFk) {
      const foreignKey = tableWithFk.foreignKeys.find(
        fk => fk.columnNames.indexOf('equipment_id') !== -1,
      );
      
      if (foreignKey) {
        await queryRunner.dropForeignKey('equipment_compressors', foreignKey);
      }
    }

    // 3. Eliminar tabla
    const tableExists = await queryRunner.hasTable('equipment_compressors');
    if (tableExists) {
      await queryRunner.dropTable('equipment_compressors');
    }

    console.log('🗑️ Tabla equipment_compressors eliminada');
  }
}
