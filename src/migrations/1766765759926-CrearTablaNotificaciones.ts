import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearTablaNotificaciones1766765759926 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Crear el tipo ENUM para la columna "tipo"
    await queryRunner.query(`
      CREATE TYPE "public"."notificaciones_tipo_enum" AS ENUM ('WORK_ORDER_CREATED', 'STOCK_BELOW_MIN')
    `);

    // 2) Crear la tabla "notificaciones"
    await queryRunner.query(`
      CREATE TABLE "notificaciones" (
        "notificacion_id" SERIAL NOT NULL,
        "usuario_id" integer NOT NULL,
        "tipo" "public"."notificaciones_tipo_enum" NOT NULL,
        "titulo" character varying(150) NOT NULL,
        "mensaje" text NOT NULL,
        "data" jsonb,
        "leida" boolean NOT NULL DEFAULT false,
        "fecha_creacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notificaciones_notificacion_id" PRIMARY KEY ("notificacion_id"),
        CONSTRAINT "FK_notificaciones_usuario_id" FOREIGN KEY ("usuario_id")
          REFERENCES "usuarios"("usuario_id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // 3) Índices útiles (opcional pero recomendado)
    await queryRunner.query(`
      CREATE INDEX "IDX_notificaciones_usuario_id" ON "notificaciones" ("usuario_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notificaciones_usuario_leida" ON "notificaciones" ("usuario_id", "leida")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notificaciones_fecha_creacion" ON "notificaciones" ("fecha_creacion")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notificaciones_fecha_creacion"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notificaciones_usuario_leida"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notificaciones_usuario_id"`);
    await queryRunner.query(`DROP TABLE "notificaciones"`);
    await queryRunner.query(`DROP TYPE "public"."notificaciones_tipo_enum"`);
  }

}
