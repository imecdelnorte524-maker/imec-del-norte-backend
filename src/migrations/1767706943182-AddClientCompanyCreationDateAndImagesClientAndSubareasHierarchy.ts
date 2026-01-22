import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddClientCompanyCreationDateAndImagesClientAndSubareasHierarchy1767706943182
  implements MigrationInterface
{
  name =
    'AddClientCompanyCreationDateAndImagesClientAndSubareasHierarchy1767706943182';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==============================
    //  CLIENTES
    // ==============================

    // 1) Agregar columna fecha_creacion_empresa (NOT NULL, DEFAULT CURRENT_DATE)
    await queryRunner.addColumn(
      'clientes',
      new TableColumn({
        name: 'fecha_creacion_empresa',
        type: 'date',
        isNullable: false,
        default: 'CURRENT_DATE',
      }),
    );

    // 2) Asegurar columna localizacion y longitud 500
    //    Usamos SQL crudo para evitar que TypeORM meta NOT NULL.
    //    - Si no existe: la creamos como nullable.
    //    - Si existe: solo aseguramos el tipo/longitud.
    await queryRunner.query(`
      ALTER TABLE "clientes"
      ADD COLUMN IF NOT EXISTS "localizacion" character varying(500)
    `);

    await queryRunner.query(`
      ALTER TABLE "clientes"
      ALTER COLUMN "localizacion" TYPE character varying(500)
    `);

    // ==============================
    //  IMAGES
    // ==============================

    // 3) Agregar columna is_logo (boolean, NOT NULL, DEFAULT false)
    await queryRunner.addColumn(
      'images',
      new TableColumn({
        name: 'is_logo',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );

    // 4) Agregar columna client_id (FK a clientes.id_cliente, nullable)
    await queryRunner.addColumn(
      'images',
      new TableColumn({
        name: 'client_id',
        type: 'int',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'images',
      new TableForeignKey({
        name: 'FK_images_client',
        columnNames: ['client_id'],
        referencedTableName: 'clientes',
        referencedColumnNames: ['id_cliente'],
        onDelete: 'CASCADE',
      }),
    );

    // ==============================
    //  SUB_AREAS
    // ==============================

    // 5) Agregar columna parent_sub_area_id (nullable)
    await queryRunner.addColumn(
      'sub_areas',
      new TableColumn({
        name: 'parent_sub_area_id',
        type: 'int',
        isNullable: true,
      }),
    );

    // 6) FK self-reference a sub_areas.id_sub_area
    await queryRunner.createForeignKey(
      'sub_areas',
      new TableForeignKey({
        name: 'FK_sub_areas_parent_sub_area',
        columnNames: ['parent_sub_area_id'],
        referencedTableName: 'sub_areas',
        referencedColumnNames: ['id_sub_area'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ==============================
    //  SUB_AREAS
    // ==============================

    const subAreasTable = await queryRunner.getTable('sub_areas');
    if (subAreasTable) {
      const parentFk = subAreasTable.foreignKeys.find((fk) =>
        fk.columnNames.includes('parent_sub_area_id'),
      );
      if (parentFk) {
        await queryRunner.dropForeignKey('sub_areas', parentFk);
      }
    }

    await queryRunner.dropColumn('sub_areas', 'parent_sub_area_id');

    // ==============================
    //  IMAGES
    // ==============================

    const imagesTable = await queryRunner.getTable('images');
    if (imagesTable) {
      const clientFk = imagesTable.foreignKeys.find((fk) =>
        fk.columnNames.includes('client_id'),
      );
      if (clientFk) {
        await queryRunner.dropForeignKey('images', clientFk);
      }
    }

    await queryRunner.dropColumn('images', 'client_id');
    await queryRunner.dropColumn('images', 'is_logo');

    // ==============================
    //  CLIENTES
    // ==============================

    // Intentar devolver localizacion a length 255 si existe
    const clientesTable = await queryRunner.getTable('clientes');
    if (clientesTable) {
      const localizacionColumn =
        clientesTable.findColumnByName('localizacion');
      if (localizacionColumn) {
        const originalLocalizacionColumn = localizacionColumn.clone();
        originalLocalizacionColumn.length = '255';
        // Respetamos nulabilidad actual
        originalLocalizacionColumn.isNullable =
          localizacionColumn.isNullable;

        await queryRunner.changeColumn(
          clientesTable,
          localizacionColumn,
          originalLocalizacionColumn,
        );
      }
    }

    // Eliminar columna fecha_creacion_empresa
    await queryRunner.dropColumn('clientes', 'fecha_creacion_empresa');
  }
}