import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveEquipmentSpecificColumns1768360289234 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la tabla existe
    const tableExists = await queryRunner.hasTable('equipos');
    
    if (!tableExists) {
      console.log('⚠️ La tabla equipos no existe');
      return;
    }

    // Solo estas columnas se eliminan (ubicacion_fisica se mantiene)
    const columnsToRemove = [
      'marca',           // brand
      'modelo',          // model
      'numero_serie',    // serialNumber
      'capacidad',       // capacity
      'tipo_refrigerante', // refrigerantType
      'voltaje',         // voltage
      'fabricante'       // manufacturer
    ];

    // Obtener la tabla para verificar qué columnas existen
    const table = await queryRunner.getTable('equipos');
    
    // Verificar que table no sea undefined
    if (!table) {
      console.log('❌ No se pudo obtener la tabla equipos');
      return;
    }
    
    // Eliminar cada columna si existe
    for (const columnName of columnsToRemove) {
      const columnExists = table.columns.find(col => col.name === columnName);
      
      if (columnExists) {
        console.log(`🗑️ Eliminando columna: ${columnName}`);
        await queryRunner.dropColumn('equipos', columnName);
      } else {
        console.log(`ℹ️ La columna ${columnName} no existe o ya fue eliminada`);
      }
    }

    console.log('✅ Columnas específicas de equipo eliminadas (ubicacion_fisica se mantiene)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la tabla existe
    const tableExists = await queryRunner.hasTable('equipos');
    
    if (!tableExists) {
      console.log('⚠️ La tabla equipos no existe');
      return;
    }

    console.log('🔄 Restaurando columnas específicas de equipo...');

    // Columnas a restaurar (sin ubicacion_fisica)
    const columnsToRestore = [
      { name: 'marca', type: 'varchar', length: '150' },
      { name: 'modelo', type: 'varchar', length: '150' },
      { name: 'numero_serie', type: 'varchar', length: '150' },
      { name: 'capacidad', type: 'varchar', length: '150' },
      { name: 'tipo_refrigerante', type: 'varchar', length: '100' },
      { name: 'voltaje', type: 'varchar', length: '50' },
      { name: 'fabricante', type: 'varchar', length: '150' }
    ];

    // Restaurar cada columna si no existe
    for (const columnDef of columnsToRestore) {
      const table = await queryRunner.getTable('equipos');
      
      // Verificar que table no sea undefined
      if (!table) {
        console.log('❌ No se pudo obtener la tabla equipos');
        continue;
      }
      
      const columnExists = table.columns.find(col => col.name === columnDef.name);
      
      if (!columnExists) {
        console.log(`➕ Restaurando columna: ${columnDef.name}`);
        await queryRunner.addColumn('equipos', 
          new TableColumn({
            name: columnDef.name,
            type: columnDef.type as any,
            length: columnDef.length,
            isNullable: true,
          })
        );
      }
    }

    console.log('✅ Columnas específicas de equipo restauradas');
  }
}
