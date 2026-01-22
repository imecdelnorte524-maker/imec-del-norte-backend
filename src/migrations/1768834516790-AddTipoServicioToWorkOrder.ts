import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTipoServicioToWorkOrder1768834516790 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear el tipo ENUM en la base de datos
    // Nota: Los nombres de valores deben coincidir exactamente con tu enum ServiceRequestType
    await queryRunner.query(
      `CREATE TYPE "service_request_type_enum" AS ENUM ('Mantenimiento', 'Instalación', 'Mantenimiento e Instalación')`,
    );

    // 2. Agregar la columna 'tipo_servicio' a la tabla 'ordenes_trabajo'
    await queryRunner.query(
      `ALTER TABLE "ordenes_trabajo" ADD "tipo_servicio" "service_request_type_enum" NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Borrar la columna (reversión)
    await queryRunner.query(
      `ALTER TABLE "ordenes_trabajo" DROP COLUMN "tipo_servicio"`,
    );

    // 2. Borrar el tipo ENUM (reversión)
    await queryRunner.query(`DROP TYPE "service_request_type_enum"`);
  }
}
