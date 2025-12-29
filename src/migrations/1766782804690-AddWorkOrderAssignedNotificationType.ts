import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkOrderAssignedNotificationType1766782804690 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."notificaciones_tipo_enum"
      ADD VALUE IF NOT EXISTS 'WORK_ORDER_ASSIGNED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // -- No se puede eliminar valores de un ENUM en Postgres fácilmente,
    // -- así que dejamos el down vacío o con un comentario.
  }
}
