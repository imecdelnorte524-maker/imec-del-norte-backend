import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateUserPasswordHistory1767017112608 implements MigrationInterface {
  private tableName = 'user_password_history';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear tabla
    await queryRunner.createTable(
      new Table({
        name: this.tableName,
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'user_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'password_hash',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'NOW()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Índices
    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({
        name: 'IDX_user_password_history_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({
        name: 'IDX_user_password_history_created_at',
        columnNames: ['created_at'],
      }),
    );

    // FK hacia usuarios(usuario_id)
    await queryRunner.createForeignKey(
      this.tableName,
      new TableForeignKey({
        name: 'FK_user_password_history_user',
        columnNames: ['user_id'],
        referencedTableName: 'usuarios',
        referencedColumnNames: ['usuario_id'],
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar FK
    const table = await queryRunner.getTable(this.tableName);
    if (table) {
      const fk = table.foreignKeys.find(
        (fk) => fk.name === 'FK_user_password_history_user',
      );
      if (fk) {
        await queryRunner.dropForeignKey(this.tableName, fk);
      }

      const idxUserId = table.indices.find(
        (idx) => idx.name === 'IDX_user_password_history_user_id',
      );
      if (idxUserId) {
        await queryRunner.dropIndex(this.tableName, idxUserId);
      }

      const idxCreatedAt = table.indices.find(
        (idx) => idx.name === 'IDX_user_password_history_created_at',
      );
      if (idxCreatedAt) {
        await queryRunner.dropIndex(this.tableName, idxCreatedAt);
      }
    }

    // Eliminar tabla
    await queryRunner.dropTable(this.tableName, true);
  }
}
