import { MigrationInterface, QueryRunner, TableForeignKey } from "typeorm";

export class UpdateWorkOrderRelations1768970693154 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar que las tablas necesarias existen
    const tables = await queryRunner.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('equipos', 'ordenes_trabajo', 'equipment_work_order')
    `);

    const equiposExists = tables.some((t: any) => t.table_name === 'equipos');
    const ordenesExists = tables.some((t: any) => t.table_name === 'ordenes_trabajo');
    const equipmentWorkOrderExists = tables.some((t: any) => t.table_name === 'equipment_work_order');

    if (!equiposExists || !ordenesExists) {
      console.log('Las tablas base no existen, saltando migración...');
      return;
    }

    // Verificar si equipment_work_order ya tiene las foreign keys
    if (equipmentWorkOrderExists) {
      const foreignKeys = await queryRunner.query(`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'equipment_work_order'
      `);

      const hasEquipmentFK = foreignKeys.some((fk: any) => 
        fk.column_name === 'equipment_id' && fk.foreign_table_name === 'equipos'
      );
      
      const hasWorkOrderFK = foreignKeys.some((fk: any) => 
        fk.column_name === 'work_order_id' && fk.foreign_table_name === 'ordenes_trabajo'
      );

      // Crear foreign keys si no existen
      if (!hasEquipmentFK) {
        await queryRunner.createForeignKey(
          'equipment_work_order',
          new TableForeignKey({
            name: 'FK_EQUIPMENT_WORK_ORDER_EQUIPMENT',
            columnNames: ['equipment_id'],
            referencedColumnNames: ['equipo_id'],
            referencedTableName: 'equipos',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          }),
        );
      }

      if (!hasWorkOrderFK) {
        await queryRunner.createForeignKey(
          'equipment_work_order',
          new TableForeignKey({
            name: 'FK_EQUIPMENT_WORK_ORDER_WORK_ORDER',
            columnNames: ['work_order_id'],
            referencedColumnNames: ['orden_id'],
            referencedTableName: 'ordenes_trabajo',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          }),
        );
      }
    }

    // Limpiar datos duplicados en equipment_work_order
    await queryRunner.query(`
      DELETE FROM equipment_work_order ewo1
      USING equipment_work_order ewo2
      WHERE ewo1.id > ewo2.id
        AND ewo1.equipment_id = ewo2.equipment_id
        AND ewo1.work_order_id = ewo2.work_order_id
    `);

    // Asegurar índice único
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_work_order 
      ON equipment_work_order (equipment_id, work_order_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar índices únicos
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_equipment_work_order
    `);

    // Eliminar foreign keys si existen
    const foreignKeys = await queryRunner.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'equipment_work_order'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name IN (
          'FK_EQUIPMENT_WORK_ORDER_EQUIPMENT',
          'FK_EQUIPMENT_WORK_ORDER_WORK_ORDER'
        )
    `);

    for (const fk of foreignKeys) {
      await queryRunner.query(`
        ALTER TABLE equipment_work_order 
        DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"
      `);
    }
  }

}
