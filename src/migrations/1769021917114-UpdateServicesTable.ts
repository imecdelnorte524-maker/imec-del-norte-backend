import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateServicesTable1769021917114 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Primero actualizar los servicios existentes para que tengan categoría
    await queryRunner.query(`
      UPDATE servicios 
      SET categoria_servicio = 'Aires Acondicionados'
      WHERE nombre_servicio = 'Aires Acondicionados';
    `);

    await queryRunner.query(`
      UPDATE servicios 
      SET categoria_servicio = 'Redes Contra Incendios'
      WHERE nombre_servicio = 'Redes contra incendios';
    `);

    await queryRunner.query(`
      UPDATE servicios 
      SET categoria_servicio = 'Redes Eléctricas'
      WHERE nombre_servicio = 'Redes Eléctricas';
    `);

    await queryRunner.query(`
      UPDATE servicios 
      SET categoria_servicio = 'Obras Civiles'
      WHERE nombre_servicio = 'Obras Civiles';
    `);

    // 2. Hacer que categoria_servicio no sea nullable
    await queryRunner.query(`
      ALTER TABLE servicios 
      ALTER COLUMN categoria_servicio SET NOT NULL;
    `);

    // 3. Eliminar las columnas que ya no necesitamos
    await queryRunner.query(`
      ALTER TABLE servicios 
      DROP COLUMN IF EXISTS tipo_trabajo;
    `);

    await queryRunner.query(`
      ALTER TABLE servicios 
      DROP COLUMN IF EXISTS tipo_mantenimiento;
    `);

    await queryRunner.query(`
      ALTER TABLE servicios 
      DROP COLUMN IF EXISTS precio_base;
    `);

    // 4. Asegurarnos de que los valores sean válidos
    await queryRunner.query(`
      UPDATE servicios 
      SET categoria_servicio = 'Aires Acondicionados'
      WHERE categoria_servicio NOT IN (
        'Aires Acondicionados',
        'Redes Contra Incendios', 
        'Redes Eléctricas',
        'Obras Civiles'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Para revertir los cambios
    await queryRunner.query(`
      ALTER TABLE servicios 
      ADD COLUMN IF NOT EXISTS precio_base DECIMAL(10,2) DEFAULT 0;
    `);

    await queryRunner.query(`
      ALTER TABLE servicios 
      ADD COLUMN IF NOT EXISTS tipo_trabajo VARCHAR(50);
    `);

    await queryRunner.query(`
      ALTER TABLE servicios 
      ADD COLUMN IF NOT EXISTS tipo_mantenimiento VARCHAR(50);
    `);

    await queryRunner.query(`
      ALTER TABLE servicios 
      ALTER COLUMN categoria_servicio DROP NOT NULL;
    `);

    await queryRunner.query(`
      UPDATE servicios 
      SET categoria_servicio = NULL;
    `);
  }
}
