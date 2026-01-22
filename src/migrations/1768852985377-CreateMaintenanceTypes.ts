import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMaintenanceTypes1768852985377 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear tabla tipos_mantenimiento
    await queryRunner.query(`
      CREATE TABLE "tipos_mantenimiento" (
        "tipo_mantenimiento_id" SERIAL NOT NULL,
        "nombre" character varying(100) NOT NULL,
        "descripcion" text,
        "activo" boolean NOT NULL DEFAULT true,
        CONSTRAINT "UQ_nombre_tipo_mant" UNIQUE ("nombre"),
        CONSTRAINT "PK_tipo_mantenimiento" PRIMARY KEY ("tipo_mantenimiento_id")
      )
    `);

    // 2. Insertar datos semilla (Preventivo y Correctivo)
    await queryRunner.query(`
      INSERT INTO "tipos_mantenimiento" ("nombre", "descripcion") VALUES 
      ('Preventivo', 'Mantenimiento planificado para prevenir fallos'),
      ('Correctivo', 'Mantenimiento realizado tras una falla')
    `);

    // 3. Agregar columna a ordenes_trabajo
    await queryRunner.query(`
      ALTER TABLE "ordenes_trabajo" ADD "tipo_mantenimiento_id" integer
    `);

    // 4. Crear Foreign Key
    await queryRunner.query(`
      ALTER TABLE "ordenes_trabajo" 
      ADD CONSTRAINT "FK_orden_tipo_mantenimiento" 
      FOREIGN KEY ("tipo_mantenimiento_id") 
      REFERENCES "tipos_mantenimiento"("tipo_mantenimiento_id") 
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ordenes_trabajo" DROP CONSTRAINT "FK_orden_tipo_mantenimiento"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ordenes_trabajo" DROP COLUMN "tipo_mantenimiento_id"`,
    );
    await queryRunner.query(`DROP TABLE "tipos_mantenimiento"`);
  }
}
