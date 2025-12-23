import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkOrderIdToForms1766438133347 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Agregar la columna work_order_id a forms
    await queryRunner.query(`
      ALTER TABLE "forms"
      ADD COLUMN "work_order_id" integer
    `);

    // 2. Crear la FK hacia ordenes_trabajo(orden_id)
    await queryRunner.query(`
      ALTER TABLE "forms"
      ADD CONSTRAINT "FK_forms_work_order"
      FOREIGN KEY ("work_order_id")
      REFERENCES "ordenes_trabajo"("orden_id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir los cambios
    await queryRunner.query(`
      ALTER TABLE "forms"
      DROP CONSTRAINT "FK_forms_work_order"
    `);

    await queryRunner.query(`
      ALTER TABLE "forms"
      DROP COLUMN "work_order_id"
    `);
  }
}
