import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from "typeorm";

export class CreateEquipmentWorkOrderTable1768969820257 implements MigrationInterface {
    name = 'CreateEquipmentWorkOrderTable1768969820257';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Verificar si las tablas necesarias existen
        const equiposTableExists = await queryRunner.hasTable('equipos');
        const ordenesTableExists = await queryRunner.hasTable('ordenes_trabajo');

        if (!equiposTableExists || !ordenesTableExists) {
            console.log('⚠️  Advertencia: Las tablas equipos u ordenes_trabajo no existen. Saltando migración...');
            return;
        }

        // 2. Crear tabla intermedia equipment_work_order
        const tableExists = await queryRunner.hasTable('equipment_work_order');
        
        if (!tableExists) {
            await queryRunner.createTable(
                new Table({
                    name: 'equipment_work_order',
                    columns: [
                        {
                            name: 'id',
                            type: 'int',
                            isPrimary: true,
                            isGenerated: true,
                            generationStrategy: 'increment',
                        },
                        {
                            name: 'equipment_id',
                            type: 'int',
                            isNullable: false,
                        },
                        {
                            name: 'work_order_id',
                            type: 'int',
                            isNullable: false,
                        },
                        {
                            name: 'description',
                            type: 'text',
                            isNullable: true,
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
        }

        // 3. Verificar y crear índices para mejor rendimiento
        // Verificar índice único
        const uniqueIndexExists = await this.indexExists(queryRunner, 'equipment_work_order', 'IDX_EQUIPMENT_WORK_ORDER_UNIQUE');
        if (!uniqueIndexExists) {
            await queryRunner.createIndex(
                'equipment_work_order',
                new TableIndex({
                    name: 'IDX_EQUIPMENT_WORK_ORDER_UNIQUE',
                    columnNames: ['equipment_id', 'work_order_id'],
                    isUnique: true,
                }),
            );
        }

        // Verificar índice para equipment_id
        const equipmentIndexExists = await this.indexExists(queryRunner, 'equipment_work_order', 'IDX_EQUIPMENT_WORK_ORDER_EQUIPMENT');
        if (!equipmentIndexExists) {
            await queryRunner.createIndex(
                'equipment_work_order',
                new TableIndex({
                    name: 'IDX_EQUIPMENT_WORK_ORDER_EQUIPMENT',
                    columnNames: ['equipment_id'],
                }),
            );
        }

        // Verificar índice para work_order_id
        const workOrderIndexExists = await this.indexExists(queryRunner, 'equipment_work_order', 'IDX_EQUIPMENT_WORK_ORDER_WORK_ORDER');
        if (!workOrderIndexExists) {
            await queryRunner.createIndex(
                'equipment_work_order',
                new TableIndex({
                    name: 'IDX_EQUIPMENT_WORK_ORDER_WORK_ORDER',
                    columnNames: ['work_order_id'],
                }),
            );
        }

        // 4. Crear foreign keys
        const fkEquipmentExists = await this.foreignKeyExists(queryRunner, 'equipment_work_order', 'FK_EQUIPMENT_WORK_ORDER_EQUIPMENT');
        if (!fkEquipmentExists) {
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

        const fkWorkOrderExists = await this.foreignKeyExists(queryRunner, 'equipment_work_order', 'FK_EQUIPMENT_WORK_ORDER_WORK_ORDER');
        if (!fkWorkOrderExists) {
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

        // 5. Verificar si existe la columna work_order_id en equipos
        const equiposTable = await queryRunner.getTable('equipos');
        
        if (equiposTable) {
            const workOrderColumnExists = equiposTable.findColumnByName('work_order_id');

            if (workOrderColumnExists) {
                // 6. Migrar datos existentes de equipos.work_order_id a la nueva tabla
                await queryRunner.query(`
                    INSERT INTO equipment_work_order (equipment_id, work_order_id)
                    SELECT e.equipo_id, e.work_order_id
                    FROM equipos e
                    WHERE e.work_order_id IS NOT NULL
                    ON CONFLICT (equipment_id, work_order_id) DO NOTHING
                `);

                // 7. Eliminar foreign key existente si existe
                const existingForeignKey = equiposTable.foreignKeys.find(
                    fk => fk.columnNames.includes('work_order_id')
                );
                
                if (existingForeignKey) {
                    await queryRunner.dropForeignKey('equipos', existingForeignKey);
                }

                // 8. Eliminar la columna work_order_id de equipos
                await queryRunner.dropColumn('equipos', 'work_order_id');
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Verificar si las tablas existen
        const equiposTableExists = await queryRunner.hasTable('equipos');
        const equipmentWorkOrderTableExists = await queryRunner.hasTable('equipment_work_order');

        if (!equiposTableExists || !equipmentWorkOrderTableExists) {
            console.log('⚠️  Advertencia: Las tablas necesarias no existen. Saltando reversión...');
            return;
        }

        // 1. Restaurar columna work_order_id en equipos si no existe
        const equiposTable = await queryRunner.getTable('equipos');
        const workOrderColumnExists = equiposTable?.findColumnByName('work_order_id');

        if (!workOrderColumnExists) {
            await queryRunner.addColumn(
                'equipos',
                new TableColumn({
                    name: 'work_order_id',
                    type: 'int',
                    isNullable: true,
                }),
            );
        }

        // 2. Restaurar datos desde equipment_work_order
        await queryRunner.query(`
            UPDATE equipos e
            SET work_order_id = ewo.work_order_id
            FROM equipment_work_order ewo
            WHERE e.equipo_id = ewo.equipment_id
            AND ewo.work_order_id IS NOT NULL
        `);

        // 3. Crear foreign key en equipos si no existe
        const fkEquiposExists = await this.foreignKeyExists(queryRunner, 'equipos', 'FK_EQUIPOS_WORK_ORDER');
        if (!fkEquiposExists) {
            await queryRunner.createForeignKey(
                'equipos',
                new TableForeignKey({
                    name: 'FK_EQUIPOS_WORK_ORDER',
                    columnNames: ['work_order_id'],
                    referencedColumnNames: ['orden_id'],
                    referencedTableName: 'ordenes_trabajo',
                    onDelete: 'SET NULL',
                    onUpdate: 'CASCADE',
                }),
            );
        }

        // 4. Eliminar foreign keys de equipment_work_order
        const fkEquipmentExists = await this.foreignKeyExists(queryRunner, 'equipment_work_order', 'FK_EQUIPMENT_WORK_ORDER_EQUIPMENT');
        if (fkEquipmentExists) {
            await queryRunner.dropForeignKey('equipment_work_order', 'FK_EQUIPMENT_WORK_ORDER_EQUIPMENT');
        }

        const fkWorkOrderExists = await this.foreignKeyExists(queryRunner, 'equipment_work_order', 'FK_EQUIPMENT_WORK_ORDER_WORK_ORDER');
        if (fkWorkOrderExists) {
            await queryRunner.dropForeignKey('equipment_work_order', 'FK_EQUIPMENT_WORK_ORDER_WORK_ORDER');
        }

        // 5. Eliminar índices
        const uniqueIndexExists = await this.indexExists(queryRunner, 'equipment_work_order', 'IDX_EQUIPMENT_WORK_ORDER_UNIQUE');
        if (uniqueIndexExists) {
            await queryRunner.query(`DROP INDEX IF EXISTS "IDX_EQUIPMENT_WORK_ORDER_UNIQUE"`);
        }

        const equipmentIndexExists = await this.indexExists(queryRunner, 'equipment_work_order', 'IDX_EQUIPMENT_WORK_ORDER_EQUIPMENT');
        if (equipmentIndexExists) {
            await queryRunner.query(`DROP INDEX IF EXISTS "IDX_EQUIPMENT_WORK_ORDER_EQUIPMENT"`);
        }

        const workOrderIndexExists = await this.indexExists(queryRunner, 'equipment_work_order', 'IDX_EQUIPMENT_WORK_ORDER_WORK_ORDER');
        if (workOrderIndexExists) {
            await queryRunner.query(`DROP INDEX IF EXISTS "IDX_EQUIPMENT_WORK_ORDER_WORK_ORDER"`);
        }

        // 6. Eliminar tabla intermedia
        await queryRunner.dropTable('equipment_work_order');
    }

    /**
     * Método auxiliar para verificar si existe una foreign key
     */
    private async foreignKeyExists(queryRunner: QueryRunner, tableName: string, fkName: string): Promise<boolean> {
        try {
            const result = await queryRunner.query(`
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = $1
                AND constraint_name = $2
                AND constraint_type = 'FOREIGN KEY'
            `, [tableName, fkName]);
            
            return result.length > 0;
        } catch (error) {
            console.log(`Error verificando foreign key ${fkName}:`, error);
            return false;
        }
    }

    /**
     * Método auxiliar para verificar si existe un índice
     */
    private async indexExists(queryRunner: QueryRunner, tableName: string, indexName: string): Promise<boolean> {
        try {
            const result = await queryRunner.query(`
                SELECT 1 FROM pg_indexes 
                WHERE tablename = $1 
                AND indexname = $2
            `, [tableName, indexName]);
            
            return result.length > 0;
        } catch (error) {
            console.log(`Error verificando índice ${indexName}:`, error);
            return false;
        }
    }
}