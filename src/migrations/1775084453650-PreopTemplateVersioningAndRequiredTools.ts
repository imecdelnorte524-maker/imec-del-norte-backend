import { MigrationInterface, QueryRunner } from "typeorm";

export class PreopTemplateVersioningAndRequiredTools1775084453650 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SET statement_timeout TO 0;`);

        // version columns
        await queryRunner.query(`
      ALTER TABLE preoperational_checklist_templates
        ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS replaced_by_template_id int NULL;
    `);

        // required tools table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS preoperational_template_required_tools (
        id serial PRIMARY KEY,
        template_id int NOT NULL REFERENCES preoperational_checklist_templates(id) ON DELETE CASCADE,
        name varchar NOT NULL,
        display_order int NOT NULL DEFAULT 0,
        UNIQUE(template_id, name)
      );
    `);

        // migrate jsonb requiresTools -> rows
        await queryRunner.query(`
      INSERT INTO preoperational_template_required_tools(template_id, name, display_order)
      SELECT t.id, tool_name, ord - 1
      FROM preoperational_checklist_templates t
      CROSS JOIN LATERAL (
        SELECT value::text as tool_name, ord
        FROM jsonb_array_elements_text(t."requiresTools") WITH ORDINALITY AS x(value, ord)
      ) q
      WHERE t."requiresTools" IS NOT NULL
      ON CONFLICT (template_id, name) DO NOTHING;
    `);

        // drop jsonb requiresTools
        await queryRunner.query(`
      ALTER TABLE preoperational_checklist_templates
        DROP COLUMN IF EXISTS "requiresTools";
    `);

        // unique toolType+version (si no existe aún)
        await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE indexname = 'uq_preop_template_tooltype_version'
        ) THEN
          CREATE UNIQUE INDEX uq_preop_template_tooltype_version
          ON preoperational_checklist_templates(tool_type, version);
        END IF;
      END $$;
    `);
    }

    public async down(): Promise<void> {
        // no-op
    }
}
