import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddClienteIdToBodegas1768320862800 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna cliente_id (nullable, ya que es opcional)
    await queryRunner.addColumn(
      'bodegas',
      new TableColumn({
        name: 'cliente_id',
        type: 'int',
        isNullable: true, // Hacemos que sea opcional
      }),
    );

    // Agregar foreign key constraint
    await queryRunner.createForeignKey(
      'bodegas',
      new TableForeignKey({
        columnNames: ['cliente_id'],
        referencedColumnNames: ['id_cliente'],
        referencedTableName: 'clientes',
        onDelete: 'SET NULL', // Si se elimina el cliente, la bodega queda sin cliente
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Obtener la foreign key para eliminarla
    const table = await queryRunner.getTable('bodegas');

    // Verificar si la tabla existe
    if (!table) {
      throw new Error("Tabla 'bodegas' no encontrada");
    }

    const foreignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('cliente_id') !== -1,
    );

    if (foreignKey) {
      await queryRunner.dropForeignKey('bodegas', foreignKey);
    }

    // Eliminar la columna
    await queryRunner.dropColumn('bodegas', 'cliente_id');
  }
}
