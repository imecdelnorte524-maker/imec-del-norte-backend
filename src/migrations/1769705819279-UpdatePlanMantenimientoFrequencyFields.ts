import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdatePlanMantenimientoFrequencyFields1769705819279 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear el tipo ENUM para unidad_frecuencia
    await queryRunner.query(`
      CREATE TYPE "public"."plan_mantenimiento_unidad_frecuencia_enum" 
      AS ENUM ('DIA', 'SEMANA', 'MES')
    `);

    // 2. Agregar la columna unidad_frecuencia usando el enum
    await queryRunner.query(`
      ALTER TABLE "plan_mantenimiento"
      ADD COLUMN "unidad_frecuencia" "public"."plan_mantenimiento_unidad_frecuencia_enum"
    `);

    // 3. Agregar la columna dia_del_mes
    await queryRunner.query(`
      ALTER TABLE "plan_mantenimiento"
      ADD COLUMN "dia_del_mes" integer
    `);

    // 4. (Opcional pero recomendado) Agregar constraint para limitar dia_del_mes entre 1 y 31
    await queryRunner.query(`
      ALTER TABLE "plan_mantenimiento"
      ADD CONSTRAINT "CHK_plan_mantenimiento_dia_del_mes"
      CHECK ("dia_del_mes" BETWEEN 1 AND 31)
    `);

    // 5. Eliminar la antigua columna frecuencia
    await queryRunner.query(`
      ALTER TABLE "plan_mantenimiento"
      DROP COLUMN "frecuencia"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Volver a crear la columna frecuencia (como estaba antes)
    await queryRunner.query(`
      ALTER TABLE "plan_mantenimiento"
      ADD COLUMN "frecuencia" character varying(50)
    `);

    // 2. Eliminar el CHECK de dia_del_mes
    await queryRunner.query(`
      ALTER TABLE "plan_mantenimiento"
      DROP CONSTRAINT IF EXISTS "CHK_plan_mantenimiento_dia_del_mes"
    `);

    // 3. Eliminar columnas nuevas
    await queryRunner.query(`
      ALTER TABLE "plan_mantenimiento"
      DROP COLUMN "dia_del_mes"
    `);

    await queryRunner.query(`
      ALTER TABLE "plan_mantenimiento"
      DROP COLUMN "unidad_frecuencia"
    `);

    // 4. Eliminar el tipo ENUM
    await queryRunner.query(`
      DROP TYPE "public"."plan_mantenimiento_unidad_frecuencia_enum"
    `);
  }
}
