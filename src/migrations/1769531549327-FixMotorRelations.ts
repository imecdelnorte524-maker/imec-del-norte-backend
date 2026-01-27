import { MigrationInterface, QueryRunner } from "typeorm";

export class FixMotorRelations1769531549327 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Agregar columnas de clave foránea si no existen
        await queryRunner.query(`
            DO $$ 
            BEGIN
                -- Verificar y agregar evaporator_id
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'equipment_motors' 
                    AND column_name = 'evaporator_id'
                ) THEN
                    ALTER TABLE equipment_motors 
                    ADD COLUMN evaporator_id INTEGER NULL;
                END IF;

                -- Verificar y agregar condenser_id
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'equipment_motors' 
                    AND column_name = 'condenser_id'
                ) THEN
                    ALTER TABLE equipment_motors 
                    ADD COLUMN condenser_id INTEGER NULL;
                END IF;
            END $$;
        `);

        // 2. Agregar constraints FOREIGN KEY
        await queryRunner.query(`
            DO $$ 
            BEGIN
                -- Constraint para evaporator
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE table_name = 'equipment_motors' 
                    AND constraint_name = 'fk_motor_evaporator'
                ) THEN
                    ALTER TABLE equipment_motors 
                    ADD CONSTRAINT fk_motor_evaporator 
                    FOREIGN KEY (evaporator_id) 
                    REFERENCES equipment_evaporators(id) 
                    ON DELETE CASCADE;
                END IF;

                -- Constraint para condenser
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE table_name = 'equipment_motors' 
                    AND constraint_name = 'fk_motor_condenser'
                ) THEN
                    ALTER TABLE equipment_motors 
                    ADD CONSTRAINT fk_motor_condenser 
                    FOREIGN KEY (condenser_id) 
                    REFERENCES equipment_condensers(id) 
                    ON DELETE CASCADE;
                END IF;
            END $$;
        `);

        // 3. Agregar índices para performance
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_motors_evaporator_id 
            ON equipment_motors(evaporator_id) 
            WHERE evaporator_id IS NOT NULL;
            
            CREATE INDEX IF NOT EXISTS idx_motors_condenser_id 
            ON equipment_motors(condenser_id) 
            WHERE condenser_id IS NOT NULL;
        `);

        console.log('✅ Migración completada: Relaciones de motores corregidas');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar constraints
        await queryRunner.query(`
            ALTER TABLE equipment_motors 
            DROP CONSTRAINT IF EXISTS fk_motor_evaporator;
            
            ALTER TABLE equipment_motors 
            DROP CONSTRAINT IF EXISTS fk_motor_condenser;
        `);

        // Eliminar índices
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_motors_evaporator_id;
            DROP INDEX IF EXISTS idx_motors_condenser_id;
        `);

        // Eliminar columnas (opcional - comentado por seguridad)
        /*
        await queryRunner.query(`
            ALTER TABLE equipment_motors 
            DROP COLUMN IF EXISTS evaporator_id;
            
            ALTER TABLE equipment_motors 
            DROP COLUMN IF EXISTS condenser_id;
        `);
        */
    }
}
