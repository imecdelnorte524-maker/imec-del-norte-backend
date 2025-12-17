import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddFechaCreacionToRoles1764273243043 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'roles',
      new TableColumn({
        name: 'fecha_creacion',
        type: 'timestamp',
        default: 'CURRENT_TIMESTAMP',
        isNullable: false,
      }),
    );

    // Si quieres actualizar los registros existentes con una fecha por defecto
    await queryRunner.query(`
      UPDATE roles 
      SET fecha_creacion = CURRENT_TIMESTAMP 
      WHERE fecha_creacion IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('roles', 'fecha_creacion');
  }

}
