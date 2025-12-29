import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMustChangePasswordToUsers1767018645552 implements MigrationInterface {
  private tableName = 'usuarios';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Añadir columna must_change_password (boolean, default false)
    await queryRunner.addColumn(
      this.tableName,
      new TableColumn({
        name: 'must_change_password',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(this.tableName, 'must_change_password');
  }
}
