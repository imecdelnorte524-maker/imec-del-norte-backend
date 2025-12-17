import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCascadeDeleteToInventory1764882221815 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Eliminar foreign keys existentes
        await queryRunner.query(`
            ALTER TABLE inventario 
            DROP CONSTRAINT IF EXISTS inventario_equipo_id_fkey;
        `);

        await queryRunner.query(`
            ALTER TABLE inventario 
            DROP CONSTRAINT IF EXISTS inventario_insumo_id_fkey;
        `);

        // 2. Agregar foreign keys con CASCADE DELETE
        await queryRunner.query(`
            ALTER TABLE inventario 
            ADD CONSTRAINT "FK_inventario_insumo_cascade" 
            FOREIGN KEY (insumo_id) 
            REFERENCES insumos(insumo_id) 
            ON DELETE CASCADE;
        `);

        await queryRunner.query(`
            ALTER TABLE inventario 
            ADD CONSTRAINT "FK_inventario_equipo_cascade" 
            FOREIGN KEY (herramienta_id) 
            REFERENCES equipos(herramienta_id) 
            ON DELETE CASCADE;
        `);

        // 3. Agregar foreign keys inversas (de equipos/insumos a inventario)
        await queryRunner.query(`
            ALTER TABLE equipos 
            ADD CONSTRAINT "FK_equipo_inventario_cascade" 
            FOREIGN KEY (inventario_id) 
            REFERENCES inventario(inventario_id) 
            ON DELETE CASCADE;
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            ADD CONSTRAINT "FK_insumo_inventario_cascade" 
            FOREIGN KEY (inventario_id) 
            REFERENCES inventario(inventario_id) 
            ON DELETE CASCADE;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Eliminar foreign keys con CASCADE
        await queryRunner.query(`
            ALTER TABLE inventario 
            DROP CONSTRAINT IF EXISTS "FK_inventario_insumo_cascade";
        `);

        await queryRunner.query(`
            ALTER TABLE inventario 
            DROP CONSTRAINT IF EXISTS "FK_inventario_equipo_cascade";
        `);

        await queryRunner.query(`
            ALTER TABLE equipos 
            DROP CONSTRAINT IF EXISTS "FK_equipo_inventario_cascade";
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            DROP CONSTRAINT IF EXISTS "FK_insumo_inventario_cascade";
        `);

        // 2. Restaurar foreign keys originales (sin CASCADE)
        // NOTA: Necesitarás conocer los nombres originales de las constraints
        await queryRunner.query(`
            ALTER TABLE inventario 
            ADD CONSTRAINT "FK_inventario_insumo" 
            FOREIGN KEY (insumo_id) 
            REFERENCES insumos(insumo_id);
        `);

        await queryRunner.query(`
            ALTER TABLE inventario 
            ADD CONSTRAINT "FK_inventario_equipo" 
            FOREIGN KEY (herramienta_id) 
            REFERENCES equipos(herramienta_id);
        `);
        await queryRunner.query(`
            ALTER TABLE inventario 
            DROP CONSTRAINT IF EXISTS inventario_equipo_id_fkey;

            ALTER TABLE inventario 
            DROP CONSTRAINT IF EXISTS inventario_insumo_id_fkey;
        `);
    }

}
