import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexes1774533399450 implements MigrationInterface {
  name = 'AddIndexes1774534000001';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const mustExist = await queryRunner.hasTable('ordenes_trabajo');
    if (!mustExist) {
      throw new Error(
        'AddIndexes: falta ordenes_trabajo. Ejecuta InitialSchema primero.',
      );
    }

    // Ordenes (listados / filtros)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordenes_trabajo_cliente_id
      ON public.ordenes_trabajo (cliente_id);
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordenes_trabajo_cliente_empresa_id
      ON public.ordenes_trabajo (cliente_empresa_id);
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordenes_trabajo_servicio_id
      ON public.ordenes_trabajo (servicio_id);
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordenes_trabajo_estado_fecha
      ON public.ordenes_trabajo (estado, fecha_solicitud DESC);
    `);

    // Detalles por orden (PDF / reportes)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipment_work_order_work_order_id
      ON public.equipment_work_order (work_order_id);
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordenes_trabajo_tecnicos_orden_id
      ON public.ordenes_trabajo_tecnicos (orden_id);
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordenes_trabajo_timer_orden_id
      ON public.ordenes_trabajo_timer (orden_id);
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordenes_trabajo_pausas_orden_id
      ON public.ordenes_trabajo_pausas (orden_id);
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_detalles_insumo_usado_orden_id
      ON public.detalles_insumo_usado (orden_id);
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_detalles_herramienta_asignado_orden_id
      ON public.detalles_herramienta_asignado (orden_id);
    `);

    // AC inspections
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ac_inspections_order_phase_equipment
      ON public.ac_inspections (work_order_id, phase, equipment_id);
    `);

    // Imágenes (parcial porque work_order_id puede ser NULL)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_work_order_id
      ON public.images (work_order_id)
      WHERE work_order_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_work_order_phase_equipment
      ON public.images (work_order_id, evidence_phase, equipment_id)
      WHERE work_order_id IS NOT NULL;
    `);
  }

  public async down(): Promise<void> {
    throw new Error('Down no soportado para AddIndexes');
  }
}
