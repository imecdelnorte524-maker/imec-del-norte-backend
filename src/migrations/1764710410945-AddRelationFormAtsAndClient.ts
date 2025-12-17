import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from "typeorm";

export class AddRelationFormAtsAndClient1764710410945 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Agregar nuevos campos
        await queryRunner.addColumns('ats_reports', [
            new TableColumn({
                name: 'client_id',
                type: 'integer',
                isNullable: true,
            }),
            new TableColumn({
                name: 'client_name',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }),
            new TableColumn({
                name: 'client_nit',
                type: 'varchar',
                length: '20',
                isNullable: true,
            }),
            new TableColumn({
                name: 'worker_identification',
                type: 'varchar',
                length: '50',
                isNullable: true,
            }),
            new TableColumn({
                name: 'sub_area',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }),
        ]);

        // Agregar foreign key
        await queryRunner.createForeignKey(
            'ats_reports',
            new TableForeignKey({
                columnNames: ['client_id'],
                referencedColumnNames: ['id_cliente'],
                referencedTableName: 'clientes',
                onDelete: 'SET NULL',
            }),
        );

        // Crear índices
        await queryRunner.createIndex('ats_reports', new TableIndex({
            name: 'IDX_ATS_REPORTS_CLIENT_ID',
            columnNames: ['client_id'],
        }));

        await queryRunner.createIndex('ats_reports', new TableIndex({
            name: 'IDX_ATS_REPORTS_WORKER_IDENTIFICATION',
            columnNames: ['worker_identification'],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Obtener la tabla
        const table = await queryRunner.getTable('ats_reports');
        
        if (table) {
            // Eliminar foreign key
            const foreignKey = table.foreignKeys.find(
                fk => fk.columnNames.indexOf('client_id') !== -1,
            );
            if (foreignKey) {
                await queryRunner.dropForeignKey('ats_reports', foreignKey);
            }

            // Eliminar índices si existen
            const clientIndex = table.indices.find(
                idx => idx.name === 'IDX_ATS_REPORTS_CLIENT_ID'
            );
            if (clientIndex) {
                await queryRunner.dropIndex('ats_reports', 'IDX_ATS_REPORTS_CLIENT_ID');
            }

            const workerIdIndex = table.indices.find(
                idx => idx.name === 'IDX_ATS_REPORTS_WORKER_IDENTIFICATION'
            );
            if (workerIdIndex) {
                await queryRunner.dropIndex('ats_reports', 'IDX_ATS_REPORTS_WORKER_IDENTIFICATION');
            }
        }

        // Eliminar columnas UNA POR UNA (método más seguro)
        const columnsToDrop = ['client_id', 'client_name', 'client_nit', 'worker_identification', 'sub_area'];
        
        for (const columnName of columnsToDrop) {
            const hasColumn = await queryRunner.hasColumn('ats_reports', columnName);
            if (hasColumn) {
                await queryRunner.dropColumn('ats_reports', columnName);
            }
        }
    }
}