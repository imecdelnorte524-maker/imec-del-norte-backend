import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddResetPasswordUsers1764018560526 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Agregar columna reset_token
        await queryRunner.addColumn('usuarios', new TableColumn({
            name: 'reset_token',
            type: 'varchar',
            length: '255',
            isNullable: true,
        }));

        // Agregar columna reset_token_expiry
        await queryRunner.addColumn('usuarios', new TableColumn({
            name: 'reset_token_expiry',
            type: 'timestamp',
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar columnas en reversa
        await queryRunner.dropColumn('usuarios', 'reset_token_expiry');
        await queryRunner.dropColumn('usuarios', 'reset_token');
    }

}
