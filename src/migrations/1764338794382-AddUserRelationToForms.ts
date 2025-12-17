import { MigrationInterface, QueryRunner, TableForeignKey } from "typeorm";

export class AddUserRelationToForms1764338794382 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Verificar si ya existen las foreign keys
        const table = await queryRunner.getTable('forms');
        const existingForeignKeys = table?.foreignKeys || [];

        const hasUserIdFK = existingForeignKeys.find(fk => 
            fk.columnNames.includes('userId') && 
            fk.referencedTableName === 'usuarios'
        );

        const hasCreatedByFK = existingForeignKeys.find(fk => 
            fk.columnNames.includes('createdBy') && 
            fk.referencedTableName === 'usuarios'
        );

        // Crear FK para userId si no existe
        if (!hasUserIdFK) {
            await queryRunner.createForeignKey('forms', new TableForeignKey({
                columnNames: ['userId'],
                referencedColumnNames: ['usuario_id'],
                referencedTableName: 'usuarios',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
                name: 'FK_forms_user_id'
            }));
        }

        // Crear FK para createdBy si no existe
        if (!hasCreatedByFK) {
            await queryRunner.createForeignKey('forms', new TableForeignKey({
                columnNames: ['createdBy'],
                referencedColumnNames: ['usuario_id'],
                referencedTableName: 'usuarios',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
                name: 'FK_forms_created_by'
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar las foreign keys
        await queryRunner.dropForeignKey('forms', 'FK_forms_user_id');
        await queryRunner.dropForeignKey('forms', 'FK_forms_created_by');
    }

}
