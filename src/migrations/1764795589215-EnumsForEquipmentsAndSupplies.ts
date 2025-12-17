import { MigrationInterface, QueryRunner } from "typeorm";

export class EnumsForEquipmentsAndSupplies1764795589215 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🚀 Iniciando migración para convertir a ENUMs...');
        
        // PRIMERO: Verificar y limpiar datos existentes
        await queryRunner.query(`
            -- Normalizar valores de equipos.estado
            UPDATE equipos 
            SET estado = 'Disponible' 
            WHERE estado IS NULL OR estado NOT IN (
                'Disponible', 'En Uso', 'En Mantenimiento', 'Dañado', 'Retirado'
            );
        `);

        await queryRunner.query(`
            -- Normalizar valores de equipos.tipo  
            UPDATE equipos 
            SET tipo = 'Herramienta' 
            WHERE tipo IS NULL OR tipo NOT IN (
                'Herramienta', 'Instrumento', 'Equipo', 'Maquinaria', 'Electrónico'
            );
        `);

        await queryRunner.query(`
            -- Normalizar valores de insumos.estado
            UPDATE insumos 
            SET estado = 'Disponible' 
            WHERE estado IS NULL OR estado NOT IN (
                'Disponible', 'Agotado', 'Stock Bajo', 'Inactivo'
            );
            
            -- También convertir 'Activo' a 'Disponible'
            UPDATE insumos 
            SET estado = 'Disponible' 
            WHERE estado = 'Activo';
        `);

        await queryRunner.query(`
            -- Normalizar valores de insumos.categoria
            UPDATE insumos 
            SET categoria = 'General' 
            WHERE categoria IS NULL OR categoria NOT IN (
                'General', 'Eléctrico', 'Mecánico', 'Plomería', 
                'Carpintería', 'Electrónico', 'Herrajes'
            );
        `);

        await queryRunner.query(`
            -- Normalizar valores de insumos.unidad_medida
            UPDATE insumos 
            SET unidad_medida = 'Unidad' 
            WHERE unidad_medida IS NULL OR unidad_medida NOT IN (
                'Unidad', 'Metro', 'Kilogramo', 'Litro', 
                'Caja', 'Paquete', 'Rollo', 'Pulgada'
            );
        `);

        // 1. Crear tipos ENUM en PostgreSQL
        console.log('📝 Creando tipos ENUM...');
        
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE equipment_status_enum AS ENUM (
                    'Disponible', 
                    'En Uso', 
                    'En Mantenimiento', 
                    'Dañado', 
                    'Retirado'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE equipment_type_enum AS ENUM (
                    'Herramienta', 
                    'Instrumento', 
                    'Equipo', 
                    'Maquinaria', 
                    'Electrónico'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE supply_status_enum AS ENUM (
                    'Disponible', 
                    'Agotado', 
                    'Stock Bajo', 
                    'Inactivo'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE supply_category_enum AS ENUM (
                    'General', 
                    'Eléctrico', 
                    'Mecánico', 
                    'Plomería', 
                    'Carpintería', 
                    'Electrónico', 
                    'Herrajes'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE unit_of_measure_enum AS ENUM (
                    'Unidad', 
                    'Metro', 
                    'Kilogramo', 
                    'Litro', 
                    'Caja', 
                    'Paquete', 
                    'Rollo', 
                    'Pulgada'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        console.log('🔄 Convirtiendo columnas a ENUMs...');
        
        // 2. Convertir columnas de equipos a ENUM (versión segura)
        await queryRunner.query(`
            ALTER TABLE equipos 
            ALTER COLUMN tipo TYPE equipment_type_enum 
            USING (
                CASE 
                    WHEN tipo IN ('Herramienta', 'Instrumento', 'Equipo', 'Maquinaria', 'Electrónico')
                    THEN tipo::equipment_type_enum
                    ELSE 'Herramienta'::equipment_type_enum
                END
            );
        `);

        await queryRunner.query(`
            ALTER TABLE equipos 
            ALTER COLUMN estado TYPE equipment_status_enum 
            USING (
                CASE 
                    WHEN estado IN ('Disponible', 'En Uso', 'En Mantenimiento', 'Dañado', 'Retirado')
                    THEN estado::equipment_status_enum
                    ELSE 'Disponible'::equipment_status_enum
                END
            );
        `);

        // 3. Convertir columnas de insumos a ENUM (versión segura)
        await queryRunner.query(`
            ALTER TABLE insumos 
            ALTER COLUMN categoria TYPE supply_category_enum 
            USING (
                CASE 
                    WHEN categoria IN ('General', 'Eléctrico', 'Mecánico', 'Plomería', 'Carpintería', 'Electrónico', 'Herrajes')
                    THEN categoria::supply_category_enum
                    ELSE 'General'::supply_category_enum
                END
            );
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            ALTER COLUMN unidad_medida TYPE unit_of_measure_enum 
            USING (
                CASE 
                    WHEN unidad_medida IN ('Unidad', 'Metro', 'Kilogramo', 'Litro', 'Caja', 'Paquete', 'Rollo', 'Pulgada')
                    THEN unidad_medida::unit_of_measure_enum
                    ELSE 'Unidad'::unit_of_measure_enum
                END
            );
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            ALTER COLUMN estado TYPE supply_status_enum 
            USING (
                CASE 
                    WHEN estado IN ('Disponible', 'Agotado', 'Stock Bajo', 'Inactivo')
                    THEN estado::supply_status_enum
                    ELSE 'Disponible'::supply_status_enum
                END
            );
        `);

        console.log('✅ Configurando valores por defecto...');
        
        // 4. Agregar constraints de valor por defecto
        await queryRunner.query(`
            ALTER TABLE equipos 
            ALTER COLUMN tipo SET DEFAULT 'Herramienta';
        `);

        await queryRunner.query(`
            ALTER TABLE equipos 
            ALTER COLUMN estado SET DEFAULT 'Disponible';
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            ALTER COLUMN categoria SET DEFAULT 'General';
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            ALTER COLUMN unidad_medida SET DEFAULT 'Unidad';
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            ALTER COLUMN estado SET DEFAULT 'Disponible';
        `);

        console.log('🎉 Migración completada exitosamente!');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Revertiendo migración de ENUMs...');
        
        // 1. Quitar defaults
        await queryRunner.query(`ALTER TABLE equipos ALTER COLUMN tipo DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE equipos ALTER COLUMN estado DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE insumos ALTER COLumna categoria DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE insumos ALTER COLumna unidad_medida DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE insumos ALTER COLumna estado DROP DEFAULT`);

        // 2. Convertir de vuelta a varchar
        await queryRunner.query(`
            ALTER TABLE equipos 
            ALTER COLUMN tipo TYPE varchar(50) 
            USING tipo::varchar;
        `);

        await queryRunner.query(`
            ALTER TABLE equipos 
            ALTER COLUMN estado TYPE varchar(50) 
            USING estado::varchar;
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            ALTER COLUMN categoria TYPE varchar(50) 
            USING categoria::varchar;
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            ALTER COLUMN unidad_medida TYPE varchar(50) 
            USING unidad_medida::varchar;
        `);

        await queryRunner.query(`
            ALTER TABLE insumos 
            ALTER COLUMN estado TYPE varchar(50) 
            USING estado::varchar;
        `);

        // 3. Eliminar tipos ENUM
        await queryRunner.query(`DROP TYPE IF EXISTS equipment_status_enum`);
        await queryRunner.query(`DROP TYPE IF EXISTS equipment_type_enum`);
        await queryRunner.query(`DROP TYPE IF EXISTS supply_status_enum`);
        await queryRunner.query(`DROP TYPE IF EXISTS supply_category_enum`);
        await queryRunner.query(`DROP TYPE IF EXISTS unit_of_measure_enum`);

        console.log('✅ Reversión completada!');
    }
}