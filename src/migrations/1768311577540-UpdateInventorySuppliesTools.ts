import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateInventorySuppliesTools1768311577540 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. CREAR TABLA UNIDADES_MEDIDA primero (para las referencias)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS unidades_medida (
                unidad_medida_id SERIAL PRIMARY KEY,
                nombre VARCHAR(50) UNIQUE NOT NULL,
                abreviatura VARCHAR(10),
                activa BOOLEAN DEFAULT TRUE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_eliminacion TIMESTAMP
            );
        `);

        // 2. CREAR TABLA BODEGAS
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS bodegas (
                bodega_id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) UNIQUE NOT NULL,
                descripcion TEXT,
                direccion VARCHAR(200),
                activa BOOLEAN DEFAULT TRUE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_eliminacion TIMESTAMP
            );
        `);

        // 3. AGREGAR COLUMNA UNIDAD_MEDIDA_ID A INSUMOS
        await queryRunner.query(`
            ALTER TABLE insumos 
            ADD COLUMN IF NOT EXISTS unidad_medida_id INTEGER REFERENCES unidades_medida(unidad_medida_id) ON DELETE RESTRICT;
        `);

        // 4. AGREGAR COLUMNA BODEGA_ID A INVENTARIO
        await queryRunner.query(`
            ALTER TABLE inventario 
            ADD COLUMN IF NOT EXISTS bodega_id INTEGER REFERENCES bodegas(bodega_id) ON DELETE SET NULL;
        `);

        // 5. AGREGAR CAMPOS DE SOFT DELETE Y MOTIVOS A HERRAMIENTAS
        await queryRunner.query(`
            ALTER TABLE herramientas 
            ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS fecha_eliminacion TIMESTAMP,
            ADD COLUMN IF NOT EXISTS motivo_eliminacion VARCHAR(50),
            ADD COLUMN IF NOT EXISTS observacion_eliminacion VARCHAR(500);
        `);

        // 6. AGREGAR SOFT DELETE A INSUMOS
        await queryRunner.query(`
            ALTER TABLE insumos 
            ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS fecha_eliminacion TIMESTAMP;
        `);

        // 7. AGREGAR SOFT DELETE A INVENTARIO
        await queryRunner.query(`
            ALTER TABLE inventario 
            ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS fecha_eliminacion TIMESTAMP;
        `);

        // 8. MANEJAR LA MIGRACIÓN DE DATOS EXISTENTES (OPCIONAL Y SEGURO)
        // Solo si hay datos existentes, intentar migrar
        await queryRunner.query(`
            DO $$ 
            BEGIN
                -- Solo intentar migrar si hay datos en insumos
                IF EXISTS (SELECT 1 FROM insumos LIMIT 1) THEN
                    -- Verificar si la columna unidad_medida existe y tiene datos
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'insumos' AND column_name = 'unidad_medida'
                    ) THEN
                        -- Insertar valores únicos del enum (si existe) en unidades_medida
                        BEGIN
                            INSERT INTO unidades_medida (nombre)
                            SELECT DISTINCT enumlabel::text
                            FROM pg_enum 
                            JOIN pg_type ON pg_type.oid = enumtypid
                            WHERE typname = 'unit_of_measure_enum'
                            ON CONFLICT (nombre) DO NOTHING;
                            
                            -- Intentar migrar los datos existentes
                            UPDATE insumos i
                            SET unidad_medida_id = um.unidad_medida_id
                            FROM unidades_medida um
                            WHERE i.unidad_medida::text = um.nombre
                            AND i.unidad_medida IS NOT NULL;
                            
                            RAISE NOTICE 'Datos existentes migrados a unidades_medida';
                        EXCEPTION WHEN OTHERS THEN
                            RAISE NOTICE 'No se pudieron migrar datos existentes: %', SQLERRM;
                        END;
                    END IF;
                ELSE
                    RAISE NOTICE 'Tabla insumos vacía, no hay datos para migrar';
                END IF;
            END $$;
        `);

        // 9. CREAR ÍNDICES PARA MEJORAR PERFORMANCE
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS IDX_INVENTARIO_BODEGA_EQUIPO 
            ON inventario(bodega_id, herramienta_id) 
            WHERE herramienta_id IS NOT NULL AND bodega_id IS NOT NULL;
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS IDX_INVENTARIO_BODEGA_INSUMO 
            ON inventario(bodega_id, insumo_id) 
            WHERE insumo_id IS NOT NULL AND bodega_id IS NOT NULL;
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS IDX_HERRAMIENTAS_SERIAL ON herramientas(serial);
            CREATE INDEX IF NOT EXISTS IDX_HERRAMIENTAS_ESTADO ON herramientas(estado);
            CREATE INDEX IF NOT EXISTS IDX_HERRAMIENTAS_TIPO ON herramientas(tipo);
            CREATE INDEX IF NOT EXISTS IDX_INSUMOS_CATEGORIA ON insumos(categoria);
            CREATE INDEX IF NOT EXISTS IDX_INSUMOS_ESTADO ON insumos(estado);
            CREATE INDEX IF NOT EXISTS IDX_BODEGAS_ACTIVA ON bodegas(activa);
            CREATE INDEX IF NOT EXISTS IDX_INSUMOS_UNIDAD_MEDIDA ON insumos(unidad_medida_id);
            CREATE INDEX IF NOT EXISTS IDX_INVENTARIO_BODEGA ON inventario(bodega_id);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ELIMINAR ÍNDICES
        await queryRunner.query(`DROP INDEX IF EXISTS IDX_INVENTARIO_BODEGA_EQUIPO;`);
        await queryRunner.query(`DROP INDEX IF EXISTS IDX_INVENTARIO_BODEGA_INSUMO;`);
        await queryRunner.query(`DROP INDEX IF EXISTS IDX_HERRAMIENTAS_SERIAL;`);
        await queryRunner.query(`DROP INDEX IF EXISTS IDX_HERRAMIENTAS_ESTADO;`);
        await queryRunner.query(`DROP INDEX IF EXISTS IDX_HERRAMIENTAS_TIPO;`);
        await queryRunner.query(`DROP INDEX IF EXISTS IDX_INSUMOS_CATEGORIA;`);
        await queryRunner.query(`DROP INDEX IF EXISTS IDX_INSUMOS_ESTADO;`);
        await queryRunner.query(`DROP INDEX IF EXISTS IDX_BODEGAS_ACTIVA;`);
        await queryRunner.query(`DROP INDEX IF EXISTS IDX_INSUMOS_UNIDAD_MEDIDA;`);
        await queryRunner.query(`DROP INDEX IF EXISTS IDX_INVENTARIO_BODEGA;`);

        // ELIMINAR COLUMNAS AGREGADAS
        await queryRunner.query(`
            ALTER TABLE herramientas 
            DROP COLUMN IF EXISTS fecha_actualizacion,
            DROP COLUMN IF EXISTS fecha_eliminacion,
            DROP COLUMN IF EXISTS motivo_eliminacion,
            DROP COLUMN IF EXISTS observacion_eliminacion;
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            DROP COLUMN IF EXISTS fecha_actualizacion,
            DROP COLUMN IF EXISTS fecha_eliminacion,
            DROP COLUMN IF EXISTS unidad_medida_id;
        `);

        await queryRunner.query(`
            ALTER TABLE inventario 
            DROP COLUMN IF EXISTS fecha_actualizacion,
            DROP COLUMN IF EXISTS fecha_eliminacion,
            DROP COLUMN IF EXISTS bodega_id;
        `);

        // ELIMINAR TABLAS NUEVAS
        await queryRunner.query(`DROP TABLE IF EXISTS bodegas CASCADE;`);
        await queryRunner.query(`DROP TABLE IF EXISTS unidades_medida CASCADE;`);
    }
}