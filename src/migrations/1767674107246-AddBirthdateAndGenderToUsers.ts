import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBirthdateAndGenderToUsers1767674107246 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE usuarios 
            ADD COLUMN fecha_nacimiento DATE NULL,
            ADD COLUMN genero VARCHAR(20) NULL
        `);
        
        await queryRunner.query(`
            ALTER TABLE usuarios 
            ADD CONSTRAINT check_genero 
            CHECK (genero IN ('MASCULINO', 'FEMENINO', 'NO_BINARIO'))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE usuarios 
            DROP COLUMN fecha_nacimiento,
            DROP COLUMN genero
        `);
        
        await queryRunner.query(`
            ALTER TABLE usuarios 
            DROP CONSTRAINT IF EXISTS check_genero
        `);
    }

}
