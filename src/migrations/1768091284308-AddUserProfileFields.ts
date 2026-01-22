import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfileFields1768091284308 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "ubicacion_residencia" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "arl" character varying(150)`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "eps" character varying(150)`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "afp" character varying(150)`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "contacto_emergencia_nombre" character varying(150)`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "contacto_emergencia_telefono" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "contacto_emergencia_parentesco" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "contacto_emergencia_parentesco"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "contacto_emergencia_telefono"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "contacto_emergencia_nombre"`,
    );
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "afp"`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "eps"`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "arl"`);
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "ubicacion_residencia"`,
    );
  }
}
