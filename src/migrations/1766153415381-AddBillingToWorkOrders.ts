import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddBillingToWorkOrders1766153415381 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Crear tipo enum para estado_facturacion (Postgres)
    await queryRunner.query(`
      CREATE TYPE "public"."enum_ordenes_trabajo_estado_facturacion" 
      AS ENUM ('No facturado', 'Facturado')
    `);

    // 2) Agregar columna estado_facturacion
    await queryRunner.addColumn(
      'ordenes_trabajo',
      new TableColumn({
        name: 'estado_facturacion',
        type: 'enum',
        enum: ['No facturado', 'Facturado'],
        enumName: 'enum_ordenes_trabajo_estado_facturacion',
        isNullable: false,
        default: `'No facturado'`,
      }),
    );

    // 3) Agregar columna factura_pdf_url
    await queryRunner.addColumn(
      'ordenes_trabajo',
      new TableColumn({
        name: 'factura_pdf_url',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1) Eliminar columna factura_pdf_url
    await queryRunner.dropColumn('ordenes_trabajo', 'factura_pdf_url');

    // 2) Eliminar columna estado_facturacion
    await queryRunner.dropColumn('ordenes_trabajo', 'estado_facturacion');

    // 3) Eliminar tipo enum
    await queryRunner.query(`
      DROP TYPE "public"."enum_ordenes_trabajo_estado_facturacion"
    `);
  }

}
