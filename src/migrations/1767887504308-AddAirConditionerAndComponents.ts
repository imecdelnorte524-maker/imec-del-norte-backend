import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAirConditionerAndComponents1767887504308 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Tabla de tipos de aire acondicionado
    await queryRunner.query(`
      CREATE TABLE "air_conditioner_types" (
        "id" SERIAL NOT NULL,
        "name" character varying(150) NOT NULL,
        "has_evaporator" boolean NOT NULL DEFAULT false,
        "has_condenser" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_air_conditioner_types_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_air_conditioner_types_name" UNIQUE ("name")
      )
    `);

    // 2) Columna en equipos para el tipo de aire
    await queryRunner.query(`
      ALTER TABLE "equipos"
      ADD "air_conditioner_type_id" integer
    `);

    // 3) Tabla de motores
    await queryRunner.query(`
      CREATE TABLE "equipment_motors" (
        "id" SERIAL NOT NULL,
        "equipment_id" integer NOT NULL,
        "amperaje" character varying(50),
        "voltaje" character varying(50),
        "rpm" character varying(50),
        "serial_motor" character varying(150),
        "modelo_motor" character varying(150),
        "diametro_eje" character varying(50),
        "tipo_eje" character varying(100),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_motors_id" PRIMARY KEY ("id")
      )
    `);

    // 4) Tabla de evaporadores
    await queryRunner.query(`
      CREATE TABLE "equipment_evaporators" (
        "id" SERIAL NOT NULL,
        "equipment_id" integer NOT NULL,
        "marca" character varying(150),
        "modelo" character varying(150),
        "serial" character varying(150),
        "capacidad" character varying(150),
        "amperaje" character varying(50),
        "tipo_refrigerante" character varying(100),
        "voltaje" character varying(50),
        "numero_fases" character varying(50),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_evaporators_id" PRIMARY KEY ("id")
      )
    `);

    // 5) Tabla de condensadoras
    await queryRunner.query(`
      CREATE TABLE "equipment_condensers" (
        "id" SERIAL NOT NULL,
        "equipment_id" integer NOT NULL,
        "marca" character varying(150),
        "modelo" character varying(150),
        "serial" character varying(150),
        "capacidad" character varying(150),
        "amperaje" character varying(50),
        "voltaje" character varying(50),
        "tipo_refrigerante" character varying(100),
        "numero_fases" character varying(50),
        "presion_alta" character varying(50),
        "presion_baja" character varying(50),
        "hp" character varying(50),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_condensers_id" PRIMARY KEY ("id")
      )
    `);

    // 6) FKs

    // equipos → air_conditioner_types
    await queryRunner.query(`
      ALTER TABLE "equipos"
      ADD CONSTRAINT "FK_equipos_air_conditioner_type"
      FOREIGN KEY ("air_conditioner_type_id") REFERENCES "air_conditioner_types"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // equipment_motors → equipos
    await queryRunner.query(`
      ALTER TABLE "equipment_motors"
      ADD CONSTRAINT "FK_equipment_motors_equipment"
      FOREIGN KEY ("equipment_id") REFERENCES "equipos"("equipo_id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // equipment_evaporators → equipos
    await queryRunner.query(`
      ALTER TABLE "equipment_evaporators"
      ADD CONSTRAINT "FK_equipment_evaporators_equipment"
      FOREIGN KEY ("equipment_id") REFERENCES "equipos"("equipo_id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // equipment_condensers → equipos
    await queryRunner.query(`
      ALTER TABLE "equipment_condensers"
      ADD CONSTRAINT "FK_equipment_condensers_equipment"
      FOREIGN KEY ("equipment_id") REFERENCES "equipos"("equipo_id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Quitar FKs
    await queryRunner.query(`
      ALTER TABLE "equipment_condensers"
      DROP CONSTRAINT "FK_equipment_condensers_equipment"
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_evaporators"
      DROP CONSTRAINT "FK_equipment_evaporators_equipment"
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_motors"
      DROP CONSTRAINT "FK_equipment_motors_equipment"
    `);
    await queryRunner.query(`
      ALTER TABLE "equipos"
      DROP CONSTRAINT "FK_equipos_air_conditioner_type"
    `);

    // Borrar tablas
    await queryRunner.query(`DROP TABLE "equipment_condensers"`);
    await queryRunner.query(`DROP TABLE "equipment_evaporators"`);
    await queryRunner.query(`DROP TABLE "equipment_motors"`);
    await queryRunner.query(
      `ALTER TABLE "equipos" DROP COLUMN "air_conditioner_type_id"`,
    );
    await queryRunner.query(`DROP TABLE "air_conditioner_types"`);
  }
}
