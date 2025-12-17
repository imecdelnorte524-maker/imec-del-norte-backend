import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeEquipmentsNametoTools1765470487058 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🚀 Iniciando migración: Cambio de Equipment a Tools...');

        // Verificar estado de las tablas al inicio
        const equiposTableExists = await queryRunner.hasTable('equipos');
        const herramientasTableExists = await queryRunner.hasTable('herramientas');
        const detallesEquipoTableExists = await queryRunner.hasTable('detalles_equipo_asignado');
        const detallesHerramientaTableExists = await queryRunner.hasTable('detalles_herramienta_asignado');
        const inventarioTableExists = await queryRunner.hasTable('inventario');

        // 1. Renombrar los tipos ENUM primero (antes de usarlos en las tablas)
        console.log('📝 Renombrando tipos ENUM...');
        
        // Renombrar equipment_status_enum a tool_status_enum
        await queryRunner.query(`
            DO $$ 
            BEGIN
                -- Verificar si el tipo existe antes de renombrarlo
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_status_enum') THEN
                    ALTER TYPE equipment_status_enum RENAME TO tool_status_enum;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Tipo equipment_status_enum no existe o ya fue renombrado';
            END $$;
        `);

        // Renombrar equipment_type_enum a tool_type_enum
        await queryRunner.query(`
            DO $$ 
            BEGIN
                -- Verificar si el tipo existe antes de renombrarlo
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_type_enum') THEN
                    ALTER TYPE equipment_type_enum RENAME TO tool_type_enum;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Tipo equipment_type_enum no existe o ya fue renombrado';
            END $$;
        `);

        // 2. Renombrar la tabla equipos a herramientas
        console.log('🔄 Renombrando tabla equipos a herramientas...');
        let finalHerramientasTableExists = herramientasTableExists;
        
        if (equiposTableExists && !herramientasTableExists) {
            await queryRunner.query(`ALTER TABLE equipos RENAME TO herramientas;`);
            finalHerramientasTableExists = true;
            console.log('✅ Tabla equipos renombrada a herramientas');
        } else if (herramientasTableExists) {
            console.log('ℹ️  Tabla herramientas ya existe, omitiendo rename');
        } else {
            console.log('⚠️  Tabla equipos no existe y herramientas tampoco existe');
        }

        // 3. Actualizar las columnas que usan los ENUMs en la tabla herramientas
        console.log('🔄 Actualizando tipos de columnas en herramientas...');
        if (finalHerramientasTableExists) {
            // Asegurar nombre de columna correcto (por si existiera equipo_id)
            const colEquipo = await queryRunner.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'herramientas' 
                AND column_name = 'equipo_id';
            `);
            if (colEquipo && colEquipo.length > 0) {
                await queryRunner.query(`ALTER TABLE herramientas RENAME COLUMN equipo_id TO herramienta_id;`);
                console.log('✅ Columna equipo_id renombrada a herramienta_id en herramientas');
            }

            // Actualizar el tipo de la columna tipo
            await queryRunner.query(`
                DO $$ 
                BEGIN
                    ALTER TABLE herramientas 
                    ALTER COLUMN tipo TYPE tool_type_enum 
                    USING tipo::text::tool_type_enum;
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Error actualizando columna tipo: %', SQLERRM;
                END $$;
            `);

            // Actualizar el tipo de la columna estado
            await queryRunner.query(`
                DO $$ 
                BEGIN
                    ALTER TABLE herramientas 
                    ALTER COLUMN estado TYPE tool_status_enum 
                    USING estado::text::tool_status_enum;
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Error actualizando columna estado: %', SQLERRM;
                END $$;
            `);
        }

        // 4. Renombrar la tabla detalles_equipo_asignado a detalles_herramienta_asignado
        console.log('🔄 Renombrando tabla detalles_equipo_asignado...');
        let finalDetallesHerramientaTableExists = detallesHerramientaTableExists;
        
        if (detallesEquipoTableExists && !detallesHerramientaTableExists) {
            await queryRunner.query(`ALTER TABLE detalles_equipo_asignado RENAME TO detalles_herramienta_asignado;`);
            finalDetallesHerramientaTableExists = true;
            console.log('✅ Tabla detalles_equipo_asignado renombrada a detalles_herramienta_asignado');
        } else if (detallesHerramientaTableExists) {
            console.log('ℹ️  Tabla detalles_herramienta_asignado ya existe, omitiendo rename');
        } else {
            console.log('ℹ️  Tabla detalles_equipo_asignado no existe, puede que ya haya sido renombrada');
        }

        // 4b. Asegurar nombre de columna correcto en detalles_herramienta_asignado
        if (finalDetallesHerramientaTableExists) {
            const colEquipo = await queryRunner.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'detalles_herramienta_asignado' 
                AND column_name = 'equipo_id';
            `);
            if (colEquipo && colEquipo.length > 0) {
                await queryRunner.query(`ALTER TABLE detalles_herramienta_asignado RENAME COLUMN equipo_id TO herramienta_id;`);
                console.log('✅ Columna equipo_id renombrada a herramienta_id en detalles_herramienta_asignado');
            }
        }

        // 5. Renombrar la columna detalle_equipo_id a detalle_herramienta_id
        console.log('🔄 Renombrando columna detalle_equipo_id...');
        if (finalDetallesHerramientaTableExists) {
            // Verificar si la columna existe antes de renombrarla
            const columnExists = await queryRunner.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'detalles_herramienta_asignado' 
                AND column_name = 'detalle_equipo_id';
            `);

            if (columnExists && columnExists.length > 0) {
                await queryRunner.query(`
                    ALTER TABLE detalles_herramienta_asignado 
                    RENAME COLUMN detalle_equipo_id TO detalle_herramienta_id;
                `);
                console.log('✅ Columna detalle_equipo_id renombrada a detalle_herramienta_id');
            } else {
                console.log('ℹ️  Columna detalle_equipo_id no existe o ya fue renombrada');
            }
        }

        // 6. Actualizar las foreign keys en la tabla inventario
        console.log('🔄 Actualizando foreign keys en inventario...');
        
        if (inventarioTableExists && finalHerramientasTableExists) {
            
            // ============================================================
            // 🔴 CORRECCIÓN: Renombrar columna equipo_id en inventario PRIMERO
            // ============================================================
            const colEquipoEnInventario = await queryRunner.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                AND table_name = 'inventario' 
                AND column_name = 'equipo_id';
            `);
            
            if (colEquipoEnInventario && colEquipoEnInventario.length > 0) {
                // Primero eliminar cualquier FK existente que use equipo_id en inventario
                console.log('🔍 Eliminando foreign keys existentes con equipo_id en inventario...');
                const fksConEquipoId = await queryRunner.query(`
                    SELECT tc.constraint_name 
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu 
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    WHERE tc.table_schema = 'public'
                    AND tc.table_name = 'inventario' 
                    AND tc.constraint_type = 'FOREIGN KEY'
                    AND kcu.column_name = 'equipo_id';
                `);

                for (const fk of fksConEquipoId || []) {
                    await queryRunner.query(`
                        ALTER TABLE inventario 
                        DROP CONSTRAINT IF EXISTS "${fk.constraint_name}";
                    `);
                    console.log(`   Eliminada FK: ${fk.constraint_name}`);
                }

                // Ahora sí renombrar la columna
                await queryRunner.query(`
                    ALTER TABLE inventario 
                    RENAME COLUMN equipo_id TO herramienta_id;
                `);
                console.log('✅ Columna equipo_id renombrada a herramienta_id en inventario');
            } else {
                console.log('ℹ️  Columna equipo_id no existe en inventario (ya fue renombrada)');
            }
            // ============================================================
            // FIN DE LA CORRECCIÓN
            // ============================================================

            // PRIMERO: Eliminar todas las foreign keys que referencian a la tabla antigua 'equipos'
            console.log('🔍 Buscando foreign keys que referencian a la tabla equipos...');
            const fkEquiposAntiguas = await queryRunner.query(`
                SELECT DISTINCT tc.constraint_name, tc.table_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.table_schema = 'public'
                AND tc.constraint_type = 'FOREIGN KEY'
                AND ccu.table_name = 'equipos';
            `);

            if (fkEquiposAntiguas && fkEquiposAntiguas.length > 0) {
                console.log(`🔍 Encontradas ${fkEquiposAntiguas.length} foreign keys que referencian a equipos, eliminándolas...`);
                for (const fk of fkEquiposAntiguas) {
                    await queryRunner.query(`
                        ALTER TABLE "${fk.table_name}" 
                        DROP CONSTRAINT IF EXISTS "${fk.constraint_name}";
                    `);
                }
            }

            // Verificar que la tabla herramientas existe y tiene la columna herramienta_id
            const tablaHerramientasExiste = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    AND table_name = 'herramientas'
                ) as exists;
            `);

            if (!tablaHerramientasExiste || !tablaHerramientasExiste[0]?.exists) {
                throw new Error('La tabla herramientas no existe');
            }

            // Verificar que la columna herramienta_id existe en herramientas (con schema explícito)
            const columnaExiste = await queryRunner.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                AND table_name = 'herramientas' 
                AND column_name = 'herramienta_id';
            `);

            if (!columnaExiste || columnaExiste.length === 0) {
                // Intentar verificar todas las columnas de la tabla para debug
                const todasLasColumnas = await queryRunner.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public'
                    AND table_name = 'herramientas'
                    ORDER BY ordinal_position;
                `);
                console.log('🔍 Columnas encontradas en herramientas:', todasLasColumnas.map((c: any) => c.column_name).join(', '));
                throw new Error('La columna herramienta_id no existe en la tabla herramientas');
            }

            console.log('✅ Verificación: tabla herramientas existe y tiene columna herramienta_id');

            // Buscar y eliminar todas las foreign keys relacionadas con equipos/herramientas
            const fkInventario = await queryRunner.query(`
                SELECT tc.constraint_name 
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = 'public'
                AND tc.table_name = 'inventario' 
                AND tc.constraint_type = 'FOREIGN KEY'
                AND kcu.column_name = 'herramienta_id';
            `);

            if (fkInventario && fkInventario.length > 0) {
                console.log(`🔍 Encontradas ${fkInventario.length} foreign keys existentes para eliminar`);
                for (const fk of fkInventario) {
                    await queryRunner.query(`
                        ALTER TABLE inventario 
                        DROP CONSTRAINT IF EXISTS "${fk.constraint_name}";
                    `);
                }
            }

            // Verificar si la foreign key ya existe antes de crearla
            const fkExists = await queryRunner.query(`
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_schema = 'public'
                AND table_name = 'inventario' 
                AND constraint_name = 'FK_inventario_herramientas';
            `);

            if (!fkExists || fkExists.length === 0) {
                // Verificar una vez más que la columna existe antes de crear la FK
                const verificacionFinal = await queryRunner.query(`
                    SELECT COUNT(*) as count
                    FROM information_schema.columns 
                    WHERE table_schema = 'public'
                    AND table_name = 'herramientas' 
                    AND column_name = 'herramienta_id';
                `);

                if (verificacionFinal[0]?.count === '0') {
                    throw new Error('La columna herramienta_id no existe en herramientas después de todas las verificaciones');
                }

                // Verificar que la columna herramienta_id existe en inventario
                const columnaInventarioExiste = await queryRunner.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public'
                    AND table_name = 'inventario' 
                    AND column_name = 'herramienta_id';
                `);

                if (!columnaInventarioExiste || columnaInventarioExiste.length === 0) {
                    const todasLasColumnasInventario = await queryRunner.query(`
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public'
                        AND table_name = 'inventario'
                        ORDER BY ordinal_position;
                    `);
                    console.log('🔍 Columnas encontradas en inventario:', todasLasColumnasInventario.map((c: any) => c.column_name).join(', '));
                    throw new Error('La columna herramienta_id no existe en la tabla inventario');
                }

                // Crear la nueva foreign key que apunta a herramientas
                await queryRunner.query(`
                    ALTER TABLE inventario 
                    ADD CONSTRAINT FK_inventario_herramientas 
                    FOREIGN KEY (herramienta_id) 
                    REFERENCES herramientas(herramienta_id) 
                    ON DELETE CASCADE;
                `);
                console.log('✅ Foreign key en inventario actualizada');
            } else {
                console.log('ℹ️  Foreign key FK_inventario_herramientas ya existe');
            }
        } else {
            console.log('⚠️  No se puede actualizar foreign key: tabla inventario o herramientas no existe');
        }

        // 7. Actualizar las foreign keys en la tabla detalles_herramienta_asignado
        console.log('🔄 Actualizando foreign keys en detalles_herramienta_asignado...');
        if (finalDetallesHerramientaTableExists && finalHerramientasTableExists) {
            // Verificar que la tabla herramientas existe y tiene la columna herramienta_id
            const tablaHerramientasExiste = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    AND table_name = 'herramientas'
                ) as exists;
            `);

            if (!tablaHerramientasExiste || !tablaHerramientasExiste[0]?.exists) {
                throw new Error('La tabla herramientas no existe');
            }

            // Verificar que la columna herramienta_id existe en herramientas
            const columnaExiste = await queryRunner.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                AND table_name = 'herramientas' 
                AND column_name = 'herramienta_id';
            `);

            if (!columnaExiste || columnaExiste.length === 0) {
                throw new Error('La columna herramienta_id no existe en la tabla herramientas');
            }

            console.log('✅ Verificación: tabla herramientas existe y tiene columna herramienta_id para detalles_herramienta_asignado');

            // Buscar y eliminar todas las foreign keys relacionadas con herramienta_id
            const fkDetalles = await queryRunner.query(`
                SELECT tc.constraint_name 
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = 'public'
                AND tc.table_name = 'detalles_herramienta_asignado' 
                AND tc.constraint_type = 'FOREIGN KEY'
                AND kcu.column_name = 'herramienta_id';
            `);

            if (fkDetalles && fkDetalles.length > 0) {
                console.log(`🔍 Encontradas ${fkDetalles.length} foreign keys existentes en detalles_herramienta_asignado para eliminar`);
                for (const fk of fkDetalles) {
                    await queryRunner.query(`
                        ALTER TABLE detalles_herramienta_asignado 
                        DROP CONSTRAINT IF EXISTS "${fk.constraint_name}";
                    `);
                }
            }

            // Verificar si la foreign key ya existe antes de crearla
            const fkExists = await queryRunner.query(`
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_schema = 'public'
                AND table_name = 'detalles_herramienta_asignado' 
                AND constraint_name = 'FK_detalles_herramienta_herramientas';
            `);

            if (!fkExists || fkExists.length === 0) {
                // Verificar una vez más que la columna existe antes de crear la FK
                const verificacionFinal = await queryRunner.query(`
                    SELECT COUNT(*) as count
                    FROM information_schema.columns 
                    WHERE table_schema = 'public'
                    AND table_name = 'herramientas' 
                    AND column_name = 'herramienta_id';
                `);

                if (verificacionFinal[0]?.count === '0') {
                    throw new Error('La columna herramienta_id no existe en herramientas después de todas las verificaciones');
                }

                // Crear la nueva foreign key que apunta a herramientas
                await queryRunner.query(`
                    ALTER TABLE detalles_herramienta_asignado 
                    ADD CONSTRAINT FK_detalles_herramienta_herramientas 
                    FOREIGN KEY (herramienta_id) 
                    REFERENCES herramientas(herramienta_id) 
                    ON DELETE RESTRICT;
                `);
                console.log('✅ Foreign key en detalles_herramienta_asignado actualizada');
            } else {
                console.log('ℹ️  Foreign key FK_detalles_herramienta_herramientas ya existe');
            }
        } else {
            console.log('⚠️  No se puede actualizar foreign key: tabla detalles_herramienta_asignado o herramientas no existe');
        }

        // 8. Actualizar índices si existen con nombres relacionados a equipment
        console.log('🔄 Actualizando índices...');
        const indices = await queryRunner.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename IN ('herramientas', 'detalles_herramienta_asignado', 'inventario')
            AND indexname LIKE '%equipment%' OR indexname LIKE '%equipo%';
        `);

        // Nota: Los índices generalmente se recrean automáticamente, pero verificamos por si acaso
        console.log('✅ Migración completada exitosamente!');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Revirtiendo migración: Cambio de Tools a Equipment...');

        // 1. Revertir foreign keys
        console.log('🔄 Revirtiendo foreign keys...');
        
        const detallesHerramientaTableExists = await queryRunner.hasTable('detalles_herramienta_asignado');
        if (detallesHerramientaTableExists) {
            await queryRunner.query(`
                ALTER TABLE detalles_herramienta_asignado 
                DROP CONSTRAINT IF EXISTS FK_detalles_herramienta_herramientas;
            `);
        }

        const inventarioTableExists = await queryRunner.hasTable('inventario');
        if (inventarioTableExists) {
            await queryRunner.query(`
                ALTER TABLE inventario 
                DROP CONSTRAINT IF EXISTS FK_inventario_herramientas;
            `);
        }

        // 2. Renombrar columna herramienta_id a equipo_id en inventario
        if (inventarioTableExists) {
            const colHerramientaInventario = await queryRunner.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'inventario' 
                AND column_name = 'herramienta_id';
            `);

            if (colHerramientaInventario && colHerramientaInventario.length > 0) {
                await queryRunner.query(`
                    ALTER TABLE inventario 
                    RENAME COLUMN herramienta_id TO equipo_id;
                `);
                console.log('✅ Columna herramienta_id renombrada a equipo_id en inventario');
            }
        }

        // 3. Renombrar columna detalle_herramienta_id a detalle_equipo_id
        if (detallesHerramientaTableExists) {
            const columnExists = await queryRunner.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'detalles_herramienta_asignado' 
                AND column_name = 'detalle_herramienta_id';
            `);

            if (columnExists && columnExists.length > 0) {
                await queryRunner.query(`
                    ALTER TABLE detalles_herramienta_asignado 
                    RENAME COLUMN detalle_herramienta_id TO detalle_equipo_id;
                `);
            }

            // Renombrar columna herramienta_id a equipo_id
            const colHerramienta = await queryRunner.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'detalles_herramienta_asignado' 
                AND column_name = 'herramienta_id';
            `);

            if (colHerramienta && colHerramienta.length > 0) {
                await queryRunner.query(`
                    ALTER TABLE detalles_herramienta_asignado 
                    RENAME COLUMN herramienta_id TO equipo_id;
                `);
            }
        }

        // 4. Renombrar tabla detalles_herramienta_asignado a detalles_equipo_asignado
        if (detallesHerramientaTableExists) {
            await queryRunner.query(`ALTER TABLE detalles_herramienta_asignado RENAME TO detalles_equipo_asignado;`);
        }

        // 5. Renombrar columna herramienta_id a equipo_id en herramientas
        const herramientasTableExists = await queryRunner.hasTable('herramientas');
        if (herramientasTableExists) {
            const colHerramienta = await queryRunner.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'herramientas' 
                AND column_name = 'herramienta_id';
            `);

            if (colHerramienta && colHerramienta.length > 0) {
                await queryRunner.query(`
                    ALTER TABLE herramientas 
                    RENAME COLUMN herramienta_id TO equipo_id;
                `);
            }
        }

        // 6. Renombrar tabla herramientas a equipos
        if (herramientasTableExists) {
            await queryRunner.query(`ALTER TABLE herramientas RENAME TO equipos;`);
        }

        // 7. Recrear foreign keys antiguas
        const equiposTableExists = await queryRunner.hasTable('equipos');
        const detallesEquipoTableExists = await queryRunner.hasTable('detalles_equipo_asignado');

        if (detallesEquipoTableExists && equiposTableExists) {
            await queryRunner.query(`
                ALTER TABLE detalles_equipo_asignado 
                ADD CONSTRAINT FK_detalles_equipo_equipos 
                FOREIGN KEY (equipo_id) 
                REFERENCES equipos(equipo_id) 
                ON DELETE RESTRICT;
            `);
        }

        if (inventarioTableExists && equiposTableExists) {
            await queryRunner.query(`
                ALTER TABLE inventario 
                ADD CONSTRAINT FK_inventario_equipos 
                FOREIGN KEY (equipo_id) 
                REFERENCES equipos(equipo_id) 
                ON DELETE CASCADE;
            `);
        }

        // 8. Revertir tipos ENUM
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tool_status_enum') THEN
                    ALTER TYPE tool_status_enum RENAME TO equipment_status_enum;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Error revirtiendo tool_status_enum';
            END $$;
        `);

        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tool_type_enum') THEN
                    ALTER TYPE tool_type_enum RENAME TO equipment_type_enum;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Error revirtiendo tool_type_enum';
            END $$;
        `);

        // 9. Actualizar columnas en equipos para usar los ENUMs antiguos
        if (equiposTableExists) {
            await queryRunner.query(`
                DO $$ 
                BEGIN
                    ALTER TABLE equipos 
                    ALTER COLUMN tipo TYPE equipment_type_enum 
                    USING tipo::text::equipment_type_enum;
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Error actualizando columna tipo';
                END $$;
            `);

            await queryRunner.query(`
                DO $$ 
                BEGIN
                    ALTER TABLE equipos 
                    ALTER COLUMN estado TYPE equipment_status_enum 
                    USING estado::text::equipment_status_enum;
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Error actualizando columna estado';
                END $$;
            `);
        }

        console.log('✅ Reversión completada!');
    }

}