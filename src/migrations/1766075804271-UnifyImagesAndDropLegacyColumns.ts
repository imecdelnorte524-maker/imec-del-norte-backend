import { MigrationInterface, QueryRunner } from "typeorm";

export class UnifyImagesAndDropLegacyColumns1766075804271 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
    // ===========================
    //  1. ELIMINAR foto_url EN HERRAMIENTAS
    // ===========================
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'herramientas'
            AND column_name = 'foto_url'
        ) THEN
          ALTER TABLE "herramientas" DROP COLUMN "foto_url";
        END IF;
      END
      $$;
    `);

    // ===========================
    //  2. ELIMINAR foto_url EN INSUMOS
    // ===========================
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'insumos'
            AND column_name = 'foto_url'
        ) THEN
          ALTER TABLE "insumos" DROP COLUMN "foto_url";
        END IF;
      END
      $$;
    `);

    // ===========================
    //  3. AGREGAR equipment_id A IMAGES + FK A EQUIPOS
    // ===========================
    // 3.1. Columna equipment_id
    await queryRunner.query(`
      ALTER TABLE "images"
      ADD COLUMN IF NOT EXISTS "equipment_id" integer
    `);

    // 3.2. FK a tabla "equipos"("equipo_id") con ON DELETE CASCADE
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_images_equipment_equipment_id'
            AND table_name = 'images'
        ) THEN
          ALTER TABLE "images"
          ADD CONSTRAINT "FK_images_equipment_equipment_id"
          FOREIGN KEY ("equipment_id") REFERENCES "equipos"("equipo_id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    // ===========================
    //  4. ELIMINAR TABLA equipos_fotos (legacy de equipos)
    // ===========================
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_name = 'equipos_fotos'
        ) THEN
          DROP TABLE "equipos_fotos";
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ===========================
    // 1. RECREAR TABLA equipos_fotos (estructura mínima original)
    // ===========================
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_name = 'equipos_fotos'
        ) THEN
          CREATE TABLE "equipos_fotos" (
            "foto_id" SERIAL PRIMARY KEY,
            "equipo_id" integer NOT NULL,
            "url" character varying(500) NOT NULL,
            "descripcion" text,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "FK_equipos_fotos_equipos_equipo_id"
              FOREIGN KEY ("equipo_id") REFERENCES "equipos"("equipo_id")
              ON DELETE CASCADE
          );
        END IF;
      END
      $$;
    `);

    // ===========================
    // 2. QUITAR FK Y COLUMNA equipment_id DE IMAGES
    // ===========================
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_images_equipment_equipment_id'
            AND table_name = 'images'
        ) THEN
          ALTER TABLE "images"
          DROP CONSTRAINT "FK_images_equipment_equipment_id";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "images"
      DROP COLUMN IF EXISTS "equipment_id"
    `);

    // ===========================
    // 3. VOLVER A CREAR foto_url EN HERRAMIENTAS
    // ===========================
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'herramientas'
            AND column_name = 'foto_url'
        ) THEN
          ALTER TABLE "herramientas"
          ADD COLUMN "foto_url" character varying;
        END IF;
      END
      $$;
    `);

    // ===========================
    // 4. VOLVER A CREAR foto_url EN INSUMOS
    // ===========================
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'insumos'
            AND column_name = 'foto_url'
        ) THEN
          ALTER TABLE "insumos"
          ADD COLUMN "foto_url" character varying;
        END IF;
      END
      $$;
    `);
  }
}
