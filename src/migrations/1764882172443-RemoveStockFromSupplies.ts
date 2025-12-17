import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveStockFromSupplies1764882172443 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Primero eliminar la columna stock de la tabla insumos
        await queryRunner.query(`
            ALTER TABLE insumos 
            DROP COLUMN IF EXISTS stock;
        `);

        // 2. Agregar columna inventario_id a equipos
        await queryRunner.query(`
            ALTER TABLE equipos 
            ADD COLUMN IF NOT EXISTS inventario_id INTEGER;
        `);

        // 3. Agregar columna inventario_id a insumos
        await queryRunner.query(`
            ALTER TABLE insumos 
            ADD COLUMN IF NOT EXISTS inventario_id INTEGER;
        `);

        // 4. Crear índices únicos para evitar duplicados
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_EQUIPO_UNICO_INVENTARIO" 
            ON inventario(herramienta_id) 
            WHERE herramienta_id IS NOT NULL;
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_INSUMO_UNICO_INVENTARIO" 
            ON inventario(insumo_id) 
            WHERE insumo_id IS NOT NULL;
        `);

        // 5. Ajustar restricciones de ubicación para permitir NULL
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_INVENTARIO_UBICACION_EQUIPO";
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_INVENTARIO_UBICACION_INSUMO";
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_INVENTARIO_UBICACION_EQUIPO" 
            ON inventario(ubicacion, herramienta_id) 
            WHERE herramienta_id IS NOT NULL AND ubicacion IS NOT NULL;
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_INVENTARIO_UBICACION_INSUMO" 
            ON inventario(ubicacion, insumo_id) 
            WHERE insumo_id IS NOT NULL AND ubicacion IS NOT NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Restaurar columna stock en insumos
        await queryRunner.query(`
            ALTER TABLE insumos 
            ADD COLUMN stock DECIMAL(10,2) DEFAULT 0;
        `);

        // 2. Eliminar columnas de relación
        await queryRunner.query(`
            ALTER TABLE equipos 
            DROP COLUMN IF EXISTS inventario_id;
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            DROP COLUMN IF EXISTS inventario_id;
        `);

        // 3. Eliminar índices únicos
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_EQUIPO_UNICO_INVENTARIO";
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_INSUMO_UNICO_INVENTARIO";
        `);

        // 4. Restaurar índices originales de ubicación
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_INVENTARIO_UBICACION_EQUIPO";
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_INVENTARIO_UBICACION_INSUMO";
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_INVENTARIO_UBICACION_EQUIPO" 
            ON inventario(ubicacion, herramienta_id) 
            WHERE herramienta_id IS NOT NULL;
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_INVENTARIO_UBICACION_INSUMO" 
            ON inventario(ubicacion, insumo_id) 
            WHERE insumo_id IS NOT NULL;
        `);
    }
}
