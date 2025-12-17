import { MigrationInterface, QueryRunner, TableForeignKey, TableIndex } from "typeorm";

export class AddReltionsforusers1764679551894 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Verificar que la columna id_usuario_contacto existe
        const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clientes' 
      AND column_name = 'id_usuario_contacto'
    `);

        if (columnExists.length === 0) {
            throw new Error('La columna id_usuario_contacto no existe en la tabla clientes');
        }

        // 2. Verificar que la tabla usuarios existe
        const tableExists = await queryRunner.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'usuarios'
    `);

        if (tableExists.length === 0) {
            throw new Error('La tabla usuarios no existe');
        }

        // 3. Verificar que la columna usuario_id existe en usuarios
        const usuarioIdExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'usuarios' 
      AND column_name = 'usuario_id'
    `);

        if (usuarioIdExists.length === 0) {
            throw new Error('La columna usuario_id no existe en la tabla usuarios');
        }

        // 4. Crear índice primero (si no existe)
        const indexExists = await queryRunner.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'clientes' 
      AND indexname = 'idx_clientes_usuario_contacto'
    `);

        if (indexExists.length === 0) {
            await queryRunner.createIndex('clientes', new TableIndex({
                name: 'idx_clientes_usuario_contacto',
                columnNames: ['id_usuario_contacto'],
            }));
        } else {
            console.log('ℹ️  Índice ya existe: idx_clientes_usuario_contacto');
        }

        // 5. Verificar si ya existe la foreign key
        const fkExists = await queryRunner.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'clientes' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_clientes_usuarios'
    `);

        if (fkExists.length > 0) {
            console.log('ℹ️  Foreign key ya existe: fk_clientes_usuarios');
            return;
        }

        // 6. Verificar que los datos existentes sean válidos
        // Buscar usuarios que no existan en la tabla usuarios
        const invalidReferences = await queryRunner.query(`
      SELECT c.id_usuario_contacto 
      FROM clientes c 
      LEFT JOIN usuarios u ON c.id_usuario_contacto = u.usuario_id 
      WHERE u.usuario_id IS NULL 
      AND c.id_usuario_contacto IS NOT NULL
    `);

        if (invalidReferences.length > 0) {

            // Opcional: Si quieres establecer valores por defecto o NULL
            // await queryRunner.query(`
            //   UPDATE clientes 
            //   SET id_usuario_contacto = NULL 
            //   WHERE id_usuario_contacto IN ($1)
            // `, [invalidReferences.map(r => r.id_usuario_contacto)]);
        }

        // 7. Crear la foreign key
        await queryRunner.createForeignKey('clientes', new TableForeignKey({
            name: 'fk_clientes_usuarios',
            columnNames: ['id_usuario_contacto'],
            referencedColumnNames: ['usuario_id'],
            referencedTableName: 'usuarios',
            onDelete: 'RESTRICT', // Previene eliminar usuarios que son contactos
            onUpdate: 'CASCADE', // Si se actualiza usuario_id, se actualiza aquí también
        }));

        // 8. Agregar comentario a la columna
        await queryRunner.query(`
      COMMENT ON COLUMN clientes.id_usuario_contacto IS 'ID del usuario que es contacto principal (FK a usuarios.usuario_id)'
    `);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Eliminar foreign key si existe
        const table = await queryRunner.getTable('clientes');
        if (table) {
            const foreignKey = table.foreignKeys.find(fk => fk.name === 'fk_clientes_usuarios');
            if (foreignKey) {
                await queryRunner.dropForeignKey('clientes', foreignKey);
            }
        }

        // 2. Eliminar índice si existe
        const indexExists = await queryRunner.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'clientes' 
      AND indexname = 'idx_clientes_usuario_contacto'
    `);

        if (indexExists.length > 0) {
            await queryRunner.dropIndex('clientes', 'idx_clientes_usuario_contacto');
        }

        // 3. Remover comentario
        await queryRunner.query(`
      COMMENT ON COLUMN clientes.id_usuario_contacto IS ''
    `);
    }

}
