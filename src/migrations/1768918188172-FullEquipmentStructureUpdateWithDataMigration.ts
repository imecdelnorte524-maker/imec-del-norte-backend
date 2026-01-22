import { MigrationInterface, QueryRunner } from 'typeorm';

export class FullEquipmentStructureUpdateWithDataMigration1720251000000 implements MigrationInterface {
  name = 'FullEquipmentStructureUpdateWithDataMigration1720251000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =============================================================
    // 1. Crear tabla plan_mantenimiento
    // =============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "plan_mantenimiento" (
        "id" SERIAL PRIMARY KEY,
        "frecuencia" varchar(50),
        "fecha_programada" date,
        "notas" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "equipment_id" integer UNIQUE,
        CONSTRAINT "FK_plan_mantenimiento_equipment"
          FOREIGN KEY ("equipment_id")
          REFERENCES "equipos"("equipo_id")
          ON DELETE CASCADE
      );
    `);

    // =============================================================
    // 2. Eliminar columnas obsoletas de equipos
    // =============================================================
    await queryRunner.query(
      `ALTER TABLE "equipos" DROP COLUMN IF EXISTS "nombre_equipo";`,
    );
    await queryRunner.query(
      `ALTER TABLE "equipos" DROP COLUMN IF EXISTS "ubicacion_fisica";`,
    );

    // =============================================================
    // 3. Hacer equipment_id NULLABLE en motors y compressors (¡esto soluciona el error!)
    // =============================================================
    await queryRunner.query(`
      ALTER TABLE "equipment_motors"
        ALTER COLUMN "equipment_id" DROP NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "equipment_compressors"
        ALTER COLUMN "equipment_id" DROP NOT NULL;
    `);

    // =============================================================
    // 4. Preparar evaporators
    // =============================================================
    await queryRunner.query(`
      ALTER TABLE "equipment_evaporators"
        DROP COLUMN IF EXISTS "amperaje",
        DROP COLUMN IF EXISTS "voltaje",
        DROP COLUMN IF EXISTS "numero_fases";
      ALTER TABLE "equipment_evaporators"
        ADD COLUMN IF NOT EXISTS "marca" varchar(150),
        ADD COLUMN IF NOT EXISTS "modelo" varchar(150),
        ADD COLUMN IF NOT EXISTS "serial" varchar(150),
        ADD COLUMN IF NOT EXISTS "capacidad" varchar(150),
        ADD COLUMN IF NOT EXISTS "tipo_refrigerante" varchar(100);
    `);

    // =============================================================
    // 5. Asegurar campos en condensers
    // =============================================================
    await queryRunner.query(`
      ALTER TABLE "equipment_condensers"
        ADD COLUMN IF NOT EXISTS "marca" varchar(150),
        ADD COLUMN IF NOT EXISTS "modelo" varchar(150),
        ADD COLUMN IF NOT EXISTS "serial" varchar(150),
        ADD COLUMN IF NOT EXISTS "capacidad" varchar(150),
        ADD COLUMN IF NOT EXISTS "amperaje" varchar(50),
        ADD COLUMN IF NOT EXISTS "voltaje" varchar(50),
        ADD COLUMN IF NOT EXISTS "tipo_refrigerante" varchar(100),
        ADD COLUMN IF NOT EXISTS "numero_fases" varchar(50),
        ADD COLUMN IF NOT EXISTS "presion_alta" varchar(50),
        ADD COLUMN IF NOT EXISTS "presion_baja" varchar(50),
        ADD COLUMN IF NOT EXISTS "hp" varchar(50);
    `);

    // =============================================================
    // 6. Preparar motors
    // =============================================================
    await queryRunner.query(`
      ALTER TABLE "equipment_motors"
        DROP COLUMN IF EXISTS "serial_motor",
        DROP COLUMN IF EXISTS "modelo_motor";
      ALTER TABLE "equipment_motors"
        ADD COLUMN IF NOT EXISTS "amperaje" varchar(50),
        ADD COLUMN IF NOT EXISTS "voltaje" varchar(50),
        ADD COLUMN IF NOT EXISTS "numero_fases" varchar(50),
        ADD COLUMN IF NOT EXISTS "diametro_eje" varchar(50),
        ADD COLUMN IF NOT EXISTS "tipo_eje" varchar(100),
        ADD COLUMN IF NOT EXISTS "rpm" varchar(50),
        ADD COLUMN IF NOT EXISTS "correa" varchar(100),
        ADD COLUMN IF NOT EXISTS "diametro_polea" varchar(50),
        ADD COLUMN IF NOT EXISTS "capacidad_hp" varchar(50),
        ADD COLUMN IF NOT EXISTS "frecuencia" varchar(50),
        ADD COLUMN IF NOT EXISTS "evaporator_id" integer,
        ADD COLUMN IF NOT EXISTS "condenser_id" integer;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'FK_motor_evaporator' 
          AND conrelid = 'equipment_motors'::regclass
        ) THEN
          ALTER TABLE "equipment_motors"
            ADD CONSTRAINT "FK_motor_evaporator"
            FOREIGN KEY ("evaporator_id")
            REFERENCES "equipment_evaporators"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'FK_motor_condenser' 
          AND conrelid = 'equipment_motors'::regclass
        ) THEN
          ALTER TABLE "equipment_motors"
            ADD CONSTRAINT "FK_motor_condenser"
            FOREIGN KEY ("condenser_id")
            REFERENCES "equipment_condensers"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // =============================================================
    // 7. Preparar compressors
    // =============================================================
    await queryRunner.query(`
      ALTER TABLE "equipment_compressors"
        ADD COLUMN IF NOT EXISTS "marca" varchar(150),
        ADD COLUMN IF NOT EXISTS "modelo" varchar(150),
        ADD COLUMN IF NOT EXISTS "serial" varchar(150),
        ADD COLUMN IF NOT EXISTS "capacidad" varchar(150),
        ADD COLUMN IF NOT EXISTS "voltaje" varchar(50),
        ADD COLUMN IF NOT EXISTS "frecuencia" varchar(50),
        ADD COLUMN IF NOT EXISTS "tipo_refrigerante" varchar(100),
        ADD COLUMN IF NOT EXISTS "tipo_aceite" varchar(50),
        ADD COLUMN IF NOT EXISTS "cantidad_aceite" varchar(50),
        ADD COLUMN IF NOT EXISTS "capacitor" varchar(100),
        ADD COLUMN IF NOT EXISTS "lra" varchar(50),
        ADD COLUMN IF NOT EXISTS "fla" varchar(50),
        ADD COLUMN IF NOT EXISTS "cantidad_polos" varchar(50),
        ADD COLUMN IF NOT EXISTS "amperaje" varchar(50),
        ADD COLUMN IF NOT EXISTS "voltaje_bobina" varchar(50),
        ADD COLUMN IF NOT EXISTS "vac" varchar(50),
        ADD COLUMN IF NOT EXISTS "condenser_id" integer;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'FK_compressor_condenser' 
          AND conrelid = 'equipment_compressors'::regclass
        ) THEN
          ALTER TABLE "equipment_compressors"
            ADD CONSTRAINT "FK_compressor_condenser"
            FOREIGN KEY ("condenser_id")
            REFERENCES "equipment_condensers"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // =============================================================
    // 8. MIGRACIÓN DE DATOS (sin incluir equipment_id en las INSERT)
    // =============================================================

    // 8.1 Evaporadores nuevos desde antiguos
    await queryRunner.query(`
      INSERT INTO "equipment_evaporators" (
        "equipment_id", "marca", "modelo", "serial", "capacidad", "tipo_refrigerante",
        "created_at", "updated_at"
      )
      SELECT 
        ev."equipment_id",
        ev."marca",
        ev."modelo",
        ev."serial",
        ev."capacidad",
        ev."tipo_refrigerante",
        now(),
        now()
      FROM "equipment_evaporators" ev
      WHERE ev."equipment_id" IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);

    // 8.2 Condensadoras nuevas
    await queryRunner.query(`
      INSERT INTO "equipment_condensers" (
        "equipment_id", "marca", "modelo", "serial", "capacidad", "amperaje", "voltaje",
        "tipo_refrigerante", "numero_fases", "presion_alta", "presion_baja", "hp",
        "created_at", "updated_at"
      )
      SELECT 
        c."equipment_id",
        c."marca", c."modelo", c."serial", c."capacidad", c."amperaje", c."voltaje",
        c."tipo_refrigerante", c."numero_fases", c."presion_alta", c."presion_baja", c."hp",
        now(), now()
      FROM "equipment_condensers" c
      WHERE c."equipment_id" IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);

    // 8.3 Motores (sin equipment_id en la INSERT)
    await queryRunner.query(`
      INSERT INTO "equipment_motors" (
        "amperaje", "voltaje", "rpm", "diametro_eje", "tipo_eje",
        "correa", "diametro_polea", "capacidad_hp", "frecuencia", "numero_fases",
        "evaporator_id", "condenser_id",
        "created_at", "updated_at"
      )
      SELECT 
        m."amperaje",
        m."voltaje",
        m."rpm",
        m."diametro_eje",
        m."tipo_eje",
        NULL,  -- correa
        NULL,  -- diametro_polea
        NULL,  -- capacidad_hp
        NULL,  -- frecuencia
        m."numero_fases",
        ev_new.id,
        cond_new.id,
        now(),
        now()
      FROM "equipment_motors" m
      LEFT JOIN "equipment_evaporators" ev_new ON ev_new."equipment_id" = m."equipment_id"
      LEFT JOIN "equipment_condensers" cond_new ON cond_new."equipment_id" = m."equipment_id"
      WHERE m."equipment_id" IS NOT NULL
        AND (ev_new.id IS NOT NULL OR cond_new.id IS NOT NULL)
      ON CONFLICT DO NOTHING;
    `);

    // 8.4 Compresores (sin equipment_id en la INSERT)
    await queryRunner.query(`
      INSERT INTO "equipment_compressors" (
        "marca", "modelo", "serial", "capacidad", "amperaje", "voltaje",
        "tipo_refrigerante", "numero_fases", "tipo_aceite", "cantidad_aceite",
        "capacitor", "lra", "fla", "cantidad_polos", "voltaje_bobina", "vac",
        "condenser_id",
        "created_at", "updated_at"
      )
      SELECT 
        c."marca", c."modelo", c."serial", c."capacidad", c."amperaje", c."voltaje",
        c."tipo_refrigerante", c."numero_fases", c."tipo_aceite", c."cantidad_aceite",
        NULL, NULL, NULL, NULL, NULL, NULL,
        cond_new.id,
        now(), now()
      FROM "equipment_compressors" c
      JOIN "equipment_condensers" cond_new ON cond_new."equipment_id" = c."equipment_id"
      ON CONFLICT DO NOTHING;
    `);

    // Opcional: limpiar tablas antiguas (descomenta si quieres borrar registros viejos)
    // await queryRunner.query(`DELETE FROM "equipment_motors" WHERE evaporator_id IS NULL AND condenser_id IS NULL;`);
    // await queryRunner.query(`DELETE FROM "equipment_evaporators" WHERE true;`);
    // await queryRunner.query(`DELETE FROM "equipment_condensers" WHERE true;`);
    // await queryRunner.query(`DELETE FROM "equipment_compressors" WHERE true;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "plan_mantenimiento";`);

    await queryRunner.query(`
      ALTER TABLE "equipos"
        ADD COLUMN IF NOT EXISTS "nombre_equipo" varchar(255),
        ADD COLUMN IF NOT EXISTS "ubicacion_fisica" varchar(500);
    `);

    await queryRunner.query(`
      ALTER TABLE "equipment_motors"
        DROP COLUMN IF EXISTS "evaporator_id",
        DROP COLUMN IF EXISTS "condenser_id";
    `);

    await queryRunner.query(
      `ALTER TABLE "equipment_motors" DROP CONSTRAINT IF EXISTS "FK_motor_evaporator";`,
    );
    await queryRunner.query(
      `ALTER TABLE "equipment_motors" DROP CONSTRAINT IF EXISTS "FK_motor_condenser";`,
    );
    await queryRunner.query(
      `ALTER TABLE "equipment_compressors" DROP CONSTRAINT IF EXISTS "FK_compressor_condenser";`,
    );
  }
}
