import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAddressFieldsToClient1767908449366 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Renombrar la columna 'direccion' a 'direccion_completa'
    // Esto preserva los datos existentes en la columna.
    await queryRunner.renameColumn(
      'clientes',
      'direccion',
      'direccion_completa',
    );

    // 2. Modificar la columna 'direccion_completa' para que sea nullable
    // Esto es necesario porque ahora se autogenerará y no será directamente ingresada.
    await queryRunner.changeColumn(
      'clientes',
      'direccion_completa',
      new TableColumn({
        name: 'direccion_completa',
        type: 'varchar',
        length: '500',
        isNullable: true, // Ahora puede ser nula
      }),
    );

    // 3. Añadir las nuevas columnas de dirección desglosada
    // Se añaden con un valor DEFAULT temporal ('N/A' o 'Colombia') para permitir la adición
    // a una tabla con datos existentes si son NOT NULL. Luego, el UPDATE los llenará.
    await queryRunner.addColumns('clientes', [
      new TableColumn({
        name: 'direccion_base',
        type: 'varchar',
        length: '255',
        isNullable: false, // Estos campos son obligatorios
        default: "'N/A'", // Valor por defecto temporal para evitar errores si la tabla tiene datos
      }),
      new TableColumn({
        name: 'barrio',
        type: 'varchar',
        length: '100',
        isNullable: false,
        default: "'N/A'",
      }),
      new TableColumn({
        name: 'ciudad',
        type: 'varchar',
        length: '100',
        isNullable: false,
        default: "'N/A'",
      }),
      new TableColumn({
        name: 'departamento',
        type: 'varchar',
        length: '100',
        isNullable: false,
        default: "'N/A'",
      }),
      new TableColumn({
        name: 'pais',
        type: 'varchar',
        length: '100',
        isNullable: false,
        default: "'Colombia'", // Valor por defecto sensato
      }),
    ]);

    // 4. Migrar datos existentes (OPCIONAL pero RECOMENDADO si tienes datos)
    // Esta parte intenta rellenar los nuevos campos desglosados a partir de la antigua 'direccion_completa'.
    // ATENCIÓN: La lógica de parseo es simplificada.
    // - 'direccion_base' toma el valor de la antigua 'direccion_completa'.
    // - 'barrio', 'ciudad', 'departamento' se rellenan con 'Sin especificar'.
    // - 'pais' se rellena con 'Colombia'.
    // Si tus direcciones antiguas tienen un formato muy específico y quieres un parseo más inteligente,
    // necesitarás adaptar esta consulta SQL con funciones de cadena de tu base de datos (ej. REGEXP_REPLACE, SUBSTRING_INDEX).
    await queryRunner.query(`
            UPDATE "clientes"
            SET
                "direccion_base" = COALESCE("direccion_completa", 'Dirección Desconocida'),
                "barrio" = 'Sin especificar',
                "ciudad" = 'Sin especificar',
                "departamento" = 'Sin especificar',
                "pais" = 'Colombia';
        `);

    // 5. Re-generar 'direccion_completa' utilizando los nuevos campos desglosados
    // Esto asegura que 'direccion_completa' esté en el formato deseado después de la migración.
    await queryRunner.query(`
            UPDATE "clientes"
            SET
                "direccion_completa" = CONCAT_WS(', ', "direccion_base", "barrio", "ciudad", "departamento", "pais");
        `);

    // 6. Eliminar los valores DEFAULT temporales si deseas que los campos sean estrictamente NOT NULL
    // (TypeORM no hace esto automáticamente al cambiar a NOT NULL después de un DEFAULT)
    // Es posible que necesites ejecutar esto si tu base de datos lo requiere.
    // Ej: ALTER TABLE clientes ALTER COLUMN direccion_base DROP DEFAULT;
    // Para PostgreSQL, esto puede ser:
    await queryRunner.query(
      `ALTER TABLE "clientes" ALTER COLUMN "direccion_base" DROP DEFAULT;`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ALTER COLUMN "barrio" DROP DEFAULT;`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ALTER COLUMN "ciudad" DROP DEFAULT;`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ALTER COLUMN "departamento" DROP DEFAULT;`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ALTER COLUMN "pais" DROP DEFAULT;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir los cambios en orden inverso

    // 1. Revertir la eliminación de valores DEFAULT (si se hizo en up)
    await queryRunner.query(
      `ALTER TABLE "clientes" ALTER COLUMN "pais" SET DEFAULT 'Colombia';`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ALTER COLUMN "departamento" SET DEFAULT 'N/A';`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ALTER COLUMN "ciudad" SET DEFAULT 'N/A';`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ALTER COLUMN "barrio" SET DEFAULT 'N/A';`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ALTER COLUMN "direccion_base" SET DEFAULT 'N/A';`,
    );

    // 2. Eliminar las nuevas columnas
    await queryRunner.dropColumns('clientes', [
      'direccion_base',
      'barrio',
      'ciudad',
      'departamento',
      'pais',
    ]);

    // 3. Renombrar 'direccion_completa' de nuevo a 'direccion'
    await queryRunner.renameColumn(
      'clientes',
      'direccion_completa',
      'direccion',
    );

    // 4. Modificar la columna 'direccion' para que no sea nullable nuevamente (si era así originalmente)
    // Asegúrate de que el estado `isNullable` coincida con el original.
    await queryRunner.changeColumn(
      'clientes',
      'direccion',
      new TableColumn({
        name: 'direccion',
        type: 'varchar',
        length: '500', // Usa la longitud original
        isNullable: false, // Volver a ser no nula
      }),
    );
  }
}
