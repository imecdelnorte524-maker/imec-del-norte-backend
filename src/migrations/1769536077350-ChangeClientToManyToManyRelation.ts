import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableColumn,
} from 'typeorm';

export class ChangeClientToManyToManyRelation1769536077350 implements MigrationInterface {
  name = 'ChangeClientToManyToManyRelation1769536077350';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log(
      '🚀 Iniciando migración para cambiar relación a ManyToMany...\n',
    );

    // ========== PASO 1: Crear tabla intermedia ==========
    console.log('📋 PASO 1: Creando tabla intermedia...');

    const tableExists = await queryRunner.hasTable(
      'clientes_usuarios_contacto',
    );

    if (tableExists) {
      console.log(
        'ℹ️  La tabla clientes_usuarios_contacto ya existe, continuando...',
      );
    } else {
      await queryRunner.createTable(
        new Table({
          name: 'clientes_usuarios_contacto',
          columns: [
            {
              name: 'id_cliente',
              type: 'int',
              isNullable: false,
            },
            {
              name: 'id_usuario',
              type: 'int',
              isNullable: false,
            },
            {
              name: 'created_at',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );

      // Agregar clave primaria compuesta
      await queryRunner.createPrimaryKey('clientes_usuarios_contacto', [
        'id_cliente',
        'id_usuario',
      ]);

      // Agregar claves foráneas
      await queryRunner.createForeignKey(
        'clientes_usuarios_contacto',
        new TableForeignKey({
          name: 'FK_cliente_usuario_contacto_cliente',
          columnNames: ['id_cliente'],
          referencedColumnNames: ['id_cliente'],
          referencedTableName: 'clientes',
          onDelete: 'CASCADE',
        }),
      );

      await queryRunner.createForeignKey(
        'clientes_usuarios_contacto',
        new TableForeignKey({
          name: 'FK_cliente_usuario_contacto_usuario',
          columnNames: ['id_usuario'],
          referencedColumnNames: ['usuario_id'],
          referencedTableName: 'usuarios',
          onDelete: 'CASCADE',
        }),
      );

      // Crear índices
      await queryRunner.createIndex(
        'clientes_usuarios_contacto',
        new TableIndex({
          name: 'IDX_cliente_usuario_contacto_cliente',
          columnNames: ['id_cliente'],
        }),
      );

      await queryRunner.createIndex(
        'clientes_usuarios_contacto',
        new TableIndex({
          name: 'IDX_cliente_usuario_contacto_usuario',
          columnNames: ['id_usuario'],
        }),
      );

      console.log('✅ Tabla intermedia creada exitosamente');
    }

    // ========== PASO 2: Migrar datos existentes ==========
    console.log('\n📋 PASO 2: Migrando datos existentes...');

    const columnExists = await queryRunner.hasColumn(
      'clientes',
      'id_usuario_contacto',
    );

    if (columnExists) {
      // Verificar cuántos registros hay para migrar
      const countResult = await queryRunner.query(`
        SELECT COUNT(*) as count 
        FROM clientes 
        WHERE id_usuario_contacto IS NOT NULL 
        AND id_usuario_contacto > 0
      `);

      const count = parseInt(countResult[0]?.count || '0');

      if (count > 0) {
        console.log(`🔍 Encontrados ${count} registros para migrar`);

        try {
          await queryRunner.query(`
            INSERT INTO clientes_usuarios_contacto (id_cliente, id_usuario)
            SELECT id_cliente, id_usuario_contacto 
            FROM clientes 
            WHERE id_usuario_contacto IS NOT NULL
            AND id_usuario_contacto > 0
            AND NOT EXISTS (
              SELECT 1 FROM clientes_usuarios_contacto cuc 
              WHERE cuc.id_cliente = clientes.id_cliente 
              AND cuc.id_usuario = clientes.id_usuario_contacto
            )
          `);

          // Verificar cuántos se migraron
          const migratedResult = await queryRunner.query(
            'SELECT COUNT(*) as count FROM clientes_usuarios_contacto',
          );

          const migratedCount = parseInt(migratedResult[0]?.count || '0');
          console.log(`✅ Migrados ${migratedCount} registros exitosamente`);
        } catch (error) {
          console.warn('⚠️  Error migrando datos:', error.message);
          console.warn('Continuando con la migración...');
        }
      } else {
        console.log('ℹ️  No hay datos existentes para migrar');
      }
    } else {
      console.log('ℹ️  La columna id_usuario_contacto no existe');
    }

    // ========== PASO 3: Verificar y limpiar columna antigua ==========
    console.log('\n📋 PASO 3: Verificando columna antigua...');

    const oldColumnExists = await queryRunner.hasColumn(
      'clientes',
      'id_usuario_contacto',
    );

    if (oldColumnExists) {
      // Verificar si la columna tiene clave foránea y eliminarla
      const table = await queryRunner.getTable('clientes');
      if (table) {
        const foreignKey = table.foreignKeys.find(
          (fk) => fk.columnNames.indexOf('id_usuario_contacto') !== -1,
        );

        if (foreignKey) {
          console.log(
            `🗑️  Eliminando clave foránea antigua: ${foreignKey.name}`,
          );
          await queryRunner.dropForeignKey('clientes', foreignKey);
        }
      }

      // Verificar si hay datos que NO fueron migrados (para debug)
      const nonMigratedResult = await queryRunner.query(`
        SELECT COUNT(*) as count 
        FROM clientes 
        WHERE id_usuario_contacto IS NOT NULL 
        AND id_usuario_contacto > 0
        AND id_cliente NOT IN (
          SELECT id_cliente FROM clientes_usuarios_contacto
        )
      `);

      const nonMigratedCount = parseInt(nonMigratedResult[0]?.count || '0');

      if (nonMigratedCount > 0) {
        console.warn(
          `⚠️  ADVERTENCIA: ${nonMigratedCount} registros NO fueron migrados`,
        );
        console.warn('⚠️  La columna se mantendrá para preservar datos');
        console.log(
          'ℹ️  Ejecuta manualmente esta consulta para migrar datos faltantes:',
        );
        console.log(`
          INSERT INTO clientes_usuarios_contacto (id_cliente, id_usuario)
          SELECT id_cliente, id_usuario_contacto 
          FROM clientes 
          WHERE id_usuario_contacto IS NOT NULL
          AND id_usuario_contacto > 0
          AND id_cliente NOT IN (SELECT id_cliente FROM clientes_usuarios_contacto)
        `);
      } else {
        console.log('✅ Todos los datos fueron migrados correctamente');
      }
    } else {
      console.log('ℹ️  La columna id_usuario_contacto ya no existe');
    }

    // ========== PASO 4: Verificar estado final ==========
    console.log('\n📋 PASO 4: Verificando estado final...');

    // Verificar tabla intermedia
    const junctionTableExists = await queryRunner.hasTable(
      'clientes_usuarios_contacto',
    );
    if (junctionTableExists) {
      const junctionCountResult = await queryRunner.query(
        'SELECT COUNT(*) as count FROM clientes_usuarios_contacto',
      );
      const junctionCount = parseInt(junctionCountResult[0]?.count || '0');
      console.log(`✅ Tabla intermedia: EXISTE (${junctionCount} registros)`);
    } else {
      console.log('❌ Tabla intermedia: NO EXISTE');
    }

    // Verificar claves foráneas
    const foreignKeysResult = await queryRunner.query(`
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY'
      AND table_name = 'clientes_usuarios_contacto'
    `);

    const fkCount = parseInt(foreignKeysResult[0]?.count || '0');
    console.log(`✅ Claves foráneas en tabla intermedia: ${fkCount}`);

    // Verificar índices
    const indicesResult = await queryRunner.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes 
      WHERE tablename = 'clientes_usuarios_contacto'
    `);

    const idxCount = parseInt(indicesResult[0]?.count || '0');
    console.log(`✅ Índices en tabla intermedia: ${idxCount}`);

    console.log('\n🎉 ¡Migración completada exitosamente!');
    console.log('\n⚠️  RECOMENDACIONES:');
    console.log(
      '1. Actualiza las entidades Client y User para usar @ManyToMany',
    );
    console.log('2. Actualiza DTOs, servicios y controladores');
    console.log(
      '3. Si todo funciona correctamente, puedes eliminar manualmente la columna id_usuario_contacto',
    );
    console.log(
      '   usando: ALTER TABLE clientes DROP COLUMN IF EXISTS id_usuario_contacto;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Iniciando reversión de migración...\n');

    // ========== PASO 1: Restaurar columna si no existe ==========
    console.log('📋 PASO 1: Restaurando columna id_usuario_contacto...');

    const columnExists = await queryRunner.hasColumn(
      'clientes',
      'id_usuario_contacto',
    );

    if (!columnExists) {
      await queryRunner.addColumn(
        'clientes',
        new TableColumn({
          name: 'id_usuario_contacto',
          type: 'int',
          isNullable: true,
          comment: 'Columna restaurada después de reversión ManyToMany',
        }),
      );

      console.log('✅ Columna restaurada');

      // Restaurar clave foránea
      await queryRunner.createForeignKey(
        'clientes',
        new TableForeignKey({
          name: 'FK_clientes_usuario_contacto_restored',
          columnNames: ['id_usuario_contacto'],
          referencedColumnNames: ['usuario_id'],
          referencedTableName: 'usuarios',
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        }),
      );

      console.log('✅ Clave foránea restaurada');
    } else {
      console.log('ℹ️  La columna ya existe');
    }

    // ========== PASO 2: Restaurar datos desde tabla intermedia ==========
    console.log('\n📋 PASO 2: Restaurando datos...');

    const tableExists = await queryRunner.hasTable(
      'clientes_usuarios_contacto',
    );

    if (tableExists) {
      try {
        await queryRunner.query(`
          UPDATE clientes c
          SET id_usuario_contacto = (
            SELECT cuc.id_usuario 
            FROM clientes_usuarios_contacto cuc
            WHERE cuc.id_cliente = c.id_cliente
            ORDER BY cuc.created_at ASC
            LIMIT 1
          )
          WHERE id_usuario_contacto IS NULL
        `);

        const updatedResult = await queryRunner.query(`
          SELECT COUNT(*) as count 
          FROM clientes 
          WHERE id_usuario_contacto IS NOT NULL
        `);

        const updatedCount = parseInt(updatedResult[0]?.count || '0');
        console.log(`✅ ${updatedCount} registros actualizados`);
      } catch (error) {
        console.warn('⚠️  Error restaurando datos:', error.message);
      }
    } else {
      console.log(
        'ℹ️  Tabla intermedia no existe, no hay datos para restaurar',
      );
    }

    // ========== PASO 3: Eliminar tabla intermedia ==========
    console.log('\n📋 PASO 3: Eliminando tabla intermedia...');

    if (tableExists) {
      // Eliminar índices
      try {
        await queryRunner.dropIndex(
          'clientes_usuarios_contacto',
          'IDX_cliente_usuario_contacto_usuario',
        );
        await queryRunner.dropIndex(
          'clientes_usuarios_contacto',
          'IDX_cliente_usuario_contacto_cliente',
        );
        console.log('✅ Índices eliminados');
      } catch (error) {
        console.warn('Error eliminando índices:', error.message);
      }

      // Eliminar claves foráneas
      try {
        await queryRunner.dropForeignKey(
          'clientes_usuarios_contacto',
          'FK_cliente_usuario_contacto_usuario',
        );
        await queryRunner.dropForeignKey(
          'clientes_usuarios_contacto',
          'FK_cliente_usuario_contacto_cliente',
        );
        console.log('✅ Claves foráneas eliminadas');
      } catch (error) {
        console.warn('Error eliminando claves foráneas:', error.message);
      }

      // Eliminar clave primaria
      try {
        await queryRunner.dropPrimaryKey('clientes_usuarios_contacto');
        console.log('✅ Clave primaria eliminada');
      } catch (error) {
        console.warn('Error eliminando clave primaria:', error.message);
      }

      // Eliminar tabla
      try {
        await queryRunner.dropTable('clientes_usuarios_contacto');
        console.log('✅ Tabla intermedia eliminada');
      } catch (error) {
        console.warn('Error eliminando tabla:', error.message);
      }
    } else {
      console.log('ℹ️  Tabla intermedia ya no existe');
    }

    console.log('\n✅ ¡Reversión completada exitosamente!');
    console.log(
      '\n⚠️  NOTA: Las entidades TypeORM deben revertirse manualmente a la relación ManyToOne',
    );
  }
}
