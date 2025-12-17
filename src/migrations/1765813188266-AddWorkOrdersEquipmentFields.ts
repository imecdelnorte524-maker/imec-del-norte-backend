import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkOrdersEquipmentFields1765813188266 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Crear tabla EQUIPOS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "equipos" (
        "equipo_id" SERIAL PRIMARY KEY,
        "cliente_id" integer NOT NULL,
        "area_id" integer,
        "sub_area_id" integer,
        "categoria_equipo" varchar(100) NOT NULL,
        "nombre_equipo" varchar(255) NOT NULL,
        "codigo_equipo" varchar(100),
        "marca" varchar(150),
        "modelo" varchar(150),
        "numero_serie" varchar(150),
        "capacidad" varchar(150),
        "tipo_refrigerante" varchar(100),
        "voltaje" varchar(50),
        "ubicacion_fisica" varchar(500),
        "fabricante" varchar(150),
        "estado_equipo" varchar(50) NOT NULL DEFAULT 'Activo',
        "fecha_instalacion" date,
        "observaciones" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // Clave foránea a clientes
    await queryRunner.query(`
      ALTER TABLE "equipos"
      ADD CONSTRAINT "fk_equipos_cliente"
      FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id_cliente")
      ON UPDATE CASCADE ON DELETE CASCADE;
    `);

    // Claves foráneas a áreas y subáreas (opcionales)
    await queryRunner.query(`
      ALTER TABLE "equipos"
      ADD CONSTRAINT "fk_equipos_area"
      FOREIGN KEY ("area_id") REFERENCES "areas"("id_area")
      ON UPDATE CASCADE ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "equipos"
      ADD CONSTRAINT "fk_equipos_sub_area"
      FOREIGN KEY ("sub_area_id") REFERENCES "sub_areas"("id_sub_area")
      ON UPDATE CASCADE ON DELETE SET NULL;
    `);

    // 2) Crear tabla EQUIPOS_FOTOS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "equipos_fotos" (
        "foto_id" SERIAL PRIMARY KEY,
        "equipo_id" integer NOT NULL,
        "url" varchar(500) NOT NULL,
        "descripcion" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "equipos_fotos"
      ADD CONSTRAINT "fk_equipos_fotos_equipo"
      FOREIGN KEY ("equipo_id") REFERENCES "equipos"("equipo_id")
      ON UPDATE CASCADE ON DELETE CASCADE;
    `);

    // 3) Agregar columnas nuevas a ORDENES_TRABAJO
    await queryRunner.query(`
      ALTER TABLE "ordenes_trabajo"
      ADD COLUMN IF NOT EXISTS "cliente_empresa_id" integer NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "ordenes_trabajo"
      ADD COLUMN IF NOT EXISTS "equipo_id" integer NULL;
    `);

    // FKs desde ordenes_trabajo a clientes (empresa) y equipos
    await queryRunner.query(`
      ALTER TABLE "ordenes_trabajo"
      ADD CONSTRAINT "fk_ordenes_trabajo_cliente_empresa"
      FOREIGN KEY ("cliente_empresa_id") REFERENCES "clientes"("id_cliente")
      ON UPDATE CASCADE ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "ordenes_trabajo"
      ADD CONSTRAINT "fk_ordenes_trabajo_equipo"
      FOREIGN KEY ("equipo_id") REFERENCES "equipos"("equipo_id")
      ON UPDATE CASCADE ON DELETE SET NULL;
    `);

    // 4) Agregar columnas nuevas a SERVICIOS
    await queryRunner.query(`
      ALTER TABLE "servicios"
      ADD COLUMN IF NOT EXISTS "categoria_servicio" varchar(100);
    `);

    await queryRunner.query(`
      ALTER TABLE "servicios"
      ADD COLUMN IF NOT EXISTS "tipo_trabajo" varchar(50);
    `);

    await queryRunner.query(`
      ALTER TABLE "servicios"
      ADD COLUMN IF NOT EXISTS "tipo_mantenimiento" varchar(50);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1) Quitar FKs y columnas de ORDENES_TRABAJO
    await queryRunner.query(`
      ALTER TABLE "ordenes_trabajo"
      DROP CONSTRAINT IF EXISTS "fk_ordenes_trabajo_cliente_empresa";
    `);

    await queryRunner.query(`
      ALTER TABLE "ordenes_trabajo"
      DROP CONSTRAINT IF EXISTS "fk_ordenes_trabajo_equipo";
    `);

    await queryRunner.query(`
      ALTER TABLE "ordenes_trabajo"
      DROP COLUMN IF EXISTS "cliente_empresa_id";
    `);

    await queryRunner.query(`
      ALTER TABLE "ordenes_trabajo"
      DROP COLUMN IF EXISTS "equipo_id";
    `);

    // 2) Quitar columnas nuevas de SERVICIOS
    await queryRunner.query(`
      ALTER TABLE "servicios"
      DROP COLUMN IF EXISTS "categoria_servicio";
    `);

    await queryRunner.query(`
      ALTER TABLE "servicios"
      DROP COLUMN IF EXISTS "tipo_trabajo";
    `);

    await queryRunner.query(`
      ALTER TABLE "servicios"
      DROP COLUMN IF EXISTS "tipo_mantenimiento";
    `);

    // 3) Eliminar tablas de equipos (fotos primero por FK)
    await queryRunner.query(`
      DROP TABLE IF EXISTS "equipos_fotos";
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "equipos";
    `);
  }
}
