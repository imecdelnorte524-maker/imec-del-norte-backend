import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class RemoveEquipoIdFromOrdenesTrabajo1766180917021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * 1️⃣ AGREGAR work_order_id A EQUIPOS
     */
    await queryRunner.addColumn(
      'equipos',
      new TableColumn({
        name: 'work_order_id',
        type: 'int',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'equipos',
      new TableForeignKey({
        columnNames: ['work_order_id'],
        referencedTableName: 'ordenes_trabajo',
        referencedColumnNames: ['orden_id'],
        onDelete: 'SET NULL',
      }),
    );

    /**
     * 2️⃣ MIGRAR DATOS EXISTENTES
     * ordenes_trabajo.equipo_id  →  equipos.work_order_id
     */
    await queryRunner.query(`
      UPDATE equipos e
      SET work_order_id = ot.orden_id
      FROM ordenes_trabajo ot
      WHERE ot.equipo_id = e.equipo_id
    `);

    /**
     * 3️⃣ ELIMINAR FK Y COLUMNA equipo_id DE ordenes_trabajo
     */
    const ordenesTable = await queryRunner.getTable('ordenes_trabajo');

    const foreignKey = ordenesTable?.foreignKeys.find((fk) =>
      fk.columnNames.includes('equipo_id'),
    );

    if (foreignKey) {
      await queryRunner.dropForeignKey('ordenes_trabajo', foreignKey);
    }

    const column = ordenesTable?.findColumnByName('equipo_id');

    if (column) {
      await queryRunner.dropColumn('ordenes_trabajo', 'equipo_id');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /**
     * 🔁 1️⃣ VOLVER A CREAR equipo_id EN ordenes_trabajo
     */
    await queryRunner.addColumn(
      'ordenes_trabajo',
      new TableColumn({
        name: 'equipo_id',
        type: 'int',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'ordenes_trabajo',
      new TableForeignKey({
        columnNames: ['equipo_id'],
        referencedTableName: 'equipos',
        referencedColumnNames: ['equipo_id'],
        onDelete: 'SET NULL',
      }),
    );

    /**
     * 🔁 2️⃣ MIGRAR DATOS DE REGRESO
     * equipos.work_order_id → ordenes_trabajo.equipo_id
     */
    await queryRunner.query(`
      UPDATE ordenes_trabajo ot
      SET equipo_id = e.equipo_id
      FROM equipos e
      WHERE e.work_order_id = ot.orden_id
    `);

    /**
     * 🔁 3️⃣ ELIMINAR work_order_id DE equipos
     */
    const equiposTable = await queryRunner.getTable('equipos');

    const fk = equiposTable?.foreignKeys.find((fk) =>
      fk.columnNames.includes('work_order_id'),
    );

    if (fk) {
      await queryRunner.dropForeignKey('equipos', fk);
    }

    const col = equiposTable?.findColumnByName('work_order_id');

    if (col) {
      await queryRunner.dropColumn('equipos', 'work_order_id');
    }
  }
}
