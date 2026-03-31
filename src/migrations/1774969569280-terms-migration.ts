import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class TermsMigration1774969569280 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'terms_conditions',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'dataprivacy',
              'ats',
              'height_work',
              'preoperational_form',
              'security',
            ],
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'items',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
          },
          {
            name: 'createdBy',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'varchar',
            length: '100',
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

    // Crear índice único para el campo type
    await queryRunner.createIndex(
      'terms_conditions',
      new TableIndex({
        name: 'IDX_TERMS_TYPE',
        columnNames: ['type'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar el índice primero
    await queryRunner.dropIndex('terms_conditions', 'IDX_TERMS_TYPE');
    // Eliminar la tabla
    await queryRunner.dropTable('terms_conditions');
  }
}
