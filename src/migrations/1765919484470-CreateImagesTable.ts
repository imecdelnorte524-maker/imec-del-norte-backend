import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateImagesTable1765919484470 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'images',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'url',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'public_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'folder',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'tool_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'supply_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'user_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
    );

    // FK → herramientas
    await queryRunner.createForeignKey(
      'images',
      new TableForeignKey({
        columnNames: ['tool_id'],
        referencedTableName: 'herramientas',
        referencedColumnNames: ['herramienta_id'],
        onDelete: 'CASCADE',
      }),
    );

    // FK → insumos
    await queryRunner.createForeignKey(
      'images',
      new TableForeignKey({
        columnNames: ['supply_id'],
        referencedTableName: 'insumos',
        referencedColumnNames: ['insumo_id'],
        onDelete: 'CASCADE',
      }),
    );

    // FK → usuarios
    await queryRunner.createForeignKey(
      'images',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'usuarios',
        referencedColumnNames: ['usuario_id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('images');
  }
}
