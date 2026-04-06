import { MigrationInterface, QueryRunner } from "typeorm";

export class NormalizeAtsHeightsPreopChecksAndTerms1775084413334 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SET statement_timeout TO 0;`);

        // forms.version + signatures.form_version
        await queryRunner.query(`ALTER TABLE forms ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;`);
        await queryRunner.query(`ALTER TABLE signatures ADD COLUMN IF NOT EXISTS form_version int NOT NULL DEFAULT 1;`);

        // ATS catalogs + pivots
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ats_risk_categories (
        id serial PRIMARY KEY,
        code varchar NOT NULL UNIQUE,
        name varchar NOT NULL,
        display_order int NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS ats_risks (
        id serial PRIMARY KEY,
        category_id int NOT NULL REFERENCES ats_risk_categories(id) ON DELETE RESTRICT,
        name varchar NOT NULL,
        description text NULL,
        display_order int NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        UNIQUE(category_id, name)
      );

      CREATE TABLE IF NOT EXISTS ats_ppe_items (
        id serial PRIMARY KEY,
        name varchar NOT NULL UNIQUE,
        type varchar NOT NULL DEFAULT 'PPE',
        display_order int NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS ats_report_risks (
        id serial PRIMARY KEY,
        ats_report_id int NOT NULL REFERENCES ats_reports(id) ON DELETE CASCADE,
        risk_id int NOT NULL REFERENCES ats_risks(id) ON DELETE RESTRICT,
        UNIQUE(ats_report_id, risk_id)
      );

      CREATE TABLE IF NOT EXISTS ats_report_ppe_items (
        id serial PRIMARY KEY,
        ats_report_id int NOT NULL REFERENCES ats_reports(id) ON DELETE CASCADE,
        ppe_item_id int NOT NULL REFERENCES ats_ppe_items(id) ON DELETE RESTRICT,
        UNIQUE(ats_report_id, ppe_item_id)
      );
    `);

        // Heights catalogs + pivots
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS height_protection_elements (
        id serial PRIMARY KEY,
        name varchar NOT NULL UNIQUE,
        display_order int NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS height_work_protection_elements (
        id serial PRIMARY KEY,
        height_work_id int NOT NULL REFERENCES height_works(id) ON DELETE CASCADE,
        protection_element_id int NOT NULL REFERENCES height_protection_elements(id) ON DELETE RESTRICT,
        UNIQUE(height_work_id, protection_element_id)
      );
    `);

        // Terms acceptance
        await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'form_terms_acceptances_termstype_enum') THEN
          CREATE TYPE form_terms_acceptances_termstype_enum AS ENUM ('DATA_PRIVACY', 'ATS', 'HEIGHT_WORK', 'PREOPERATIONAL');
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS form_terms_acceptances (
        id serial PRIMARY KEY,
        form_id int NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        form_version int NOT NULL DEFAULT 1,
        "termsType" form_terms_acceptances_termstype_enum NOT NULL,
        terms_version int NOT NULL,
        accepted_by_user_id int NOT NULL,
        ip varchar NULL,
        "userAgent" varchar NULL,
        accepted_at timestamp NOT NULL DEFAULT now(),
        UNIQUE(form_id, form_version, "termsType")
      );
    `);

        // PREOP checks: rename parameter -> snapshot and add new cols
        await queryRunner.query(`
      ALTER TABLE preoperational_checks
        RENAME COLUMN "parameter" TO parameter_snapshot;

      ALTER TABLE preoperational_checks
        ADD COLUMN IF NOT EXISTS template_id int NULL,
        ADD COLUMN IF NOT EXISTS parameter_id int NULL,
        ADD COLUMN IF NOT EXISTS parameter_code_snapshot varchar NULL,
        ADD COLUMN IF NOT EXISTS category_snapshot varchar NULL,
        ADD COLUMN IF NOT EXISTS required_snapshot boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS critical_snapshot boolean NOT NULL DEFAULT false;

      ALTER TABLE preoperational_checks
        ADD CONSTRAINT fk_preop_checks_template
          FOREIGN KEY (template_id) REFERENCES preoperational_checklist_templates(id) ON DELETE SET NULL;

      ALTER TABLE preoperational_checks
        ADD CONSTRAINT fk_preop_checks_parameter
          FOREIGN KEY (parameter_id) REFERENCES preoperational_checklist_parameters(id) ON DELETE SET NULL;
    `);

        // ===== Migración ATS jsonb -> normalizado =====

        // categories
        await queryRunner.query(`
      INSERT INTO ats_risk_categories(code, name)
      SELECT DISTINCT key as code, initcap(replace(key, '_', ' ')) as name
      FROM ats_reports r
      CROSS JOIN LATERAL jsonb_object_keys(r."selectedRisks") key
      WHERE r."selectedRisks" IS NOT NULL
      ON CONFLICT (code) DO NOTHING;
    `);

        // risks
        await queryRunner.query(`
      INSERT INTO ats_risks(category_id, name)
      SELECT DISTINCT c.id, risk_name
      FROM ats_reports r
      CROSS JOIN LATERAL jsonb_each(r."selectedRisks") e(category, risks)
      CROSS JOIN LATERAL jsonb_array_elements_text(e.risks) risk_name
      JOIN ats_risk_categories c ON c.code = e.category
      WHERE r."selectedRisks" IS NOT NULL
      ON CONFLICT (category_id, name) DO NOTHING;
    `);

        // pivot risks
        await queryRunner.query(`
      INSERT INTO ats_report_risks(ats_report_id, risk_id)
      SELECT r.id, ar.id
      FROM ats_reports r
      CROSS JOIN LATERAL jsonb_each(r."selectedRisks") e(category, risks)
      CROSS JOIN LATERAL jsonb_array_elements_text(e.risks) risk_name
      JOIN ats_risk_categories c ON c.code = e.category
      JOIN ats_risks ar ON ar.category_id = c.id AND ar.name = risk_name
      WHERE r."selectedRisks" IS NOT NULL
      ON CONFLICT (ats_report_id, risk_id) DO NOTHING;
    `);

        // PPE catalog
        await queryRunner.query(`
      INSERT INTO ats_ppe_items(name)
      SELECT DISTINCT key
      FROM ats_reports r
      CROSS JOIN LATERAL jsonb_object_keys(r."requiredPpe") key
      WHERE r."requiredPpe" IS NOT NULL
      ON CONFLICT (name) DO NOTHING;
    `);

        // pivot PPE only true
        await queryRunner.query(`
      INSERT INTO ats_report_ppe_items(ats_report_id, ppe_item_id)
      SELECT r.id, p.id
      FROM ats_reports r
      CROSS JOIN LATERAL jsonb_each(r."requiredPpe") e(key, value)
      JOIN ats_ppe_items p ON p.name = e.key
      WHERE r."requiredPpe" IS NOT NULL AND e.value = 'true'::jsonb
      ON CONFLICT (ats_report_id, ppe_item_id) DO NOTHING;
    `);

        // ===== Migración Alturas jsonb -> normalizado =====
        await queryRunner.query(`
      INSERT INTO height_protection_elements(name)
      SELECT DISTINCT key
      FROM height_works hw
      CROSS JOIN LATERAL jsonb_object_keys(hw."protectionElements") key
      WHERE hw."protectionElements" IS NOT NULL
      ON CONFLICT (name) DO NOTHING;
    `);

        await queryRunner.query(`
      INSERT INTO height_work_protection_elements(height_work_id, protection_element_id)
      SELECT hw.id, pe.id
      FROM height_works hw
      CROSS JOIN LATERAL jsonb_each(hw."protectionElements") e(key, value)
      JOIN height_protection_elements pe ON pe.name = e.key
      WHERE hw."protectionElements" IS NOT NULL AND e.value = 'true'::jsonb
      ON CONFLICT (height_work_id, protection_element_id) DO NOTHING;
    `);

        // drop jsonb columns ATS/Heights
        await queryRunner.query(`ALTER TABLE ats_reports DROP COLUMN IF EXISTS "selectedRisks";`);
        await queryRunner.query(`ALTER TABLE ats_reports DROP COLUMN IF EXISTS "requiredPpe";`);
        await queryRunner.query(`ALTER TABLE height_works DROP COLUMN IF EXISTS "protectionElements";`);
    }

    public async down(): Promise<void> {
        // no-op
    }

}
