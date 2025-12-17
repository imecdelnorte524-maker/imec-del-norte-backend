import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateSgSstTables1764105416227 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ========== TABLA PRINCIPAL FORMULARIOS ==========
        await queryRunner.createTable(new Table({
            name: 'forms',
            columns: [
                {
                    name: 'id',
                    type: 'serial',
                    isPrimary: true,
                },
                {
                    name: 'formType',
                    type: 'enum',
                    enum: ['ATS', 'HEIGHT_WORK', 'PREOPERATIONAL'],
                    default: "'PREOPERATIONAL'"
                },
                {
                    name: 'status',
                    type: 'enum',
                    enum: ['DRAFT', 'PENDING_SST', 'COMPLETED'],
                    default: "'DRAFT'"
                },
                {
                    name: 'equipmentTool',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'technicianSignatureDate',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'sstSignatureDate',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'userId',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'createdBy',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'updatedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }));

        // ========== TABLA ATS REPORTS ==========
        await queryRunner.createTable(new Table({
            name: 'ats_reports',
            columns: [
                {
                    name: 'id',
                    type: 'serial',
                    isPrimary: true,
                },
                {
                    name: 'formId',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'workerName',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'position',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'area',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'workToPerform',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'location',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'startTime',
                    type: 'time',
                    isNullable: true,
                },
                {
                    name: 'endTime',
                    type: 'time',
                    isNullable: true,
                },
                {
                    name: 'date',
                    type: 'date',
                    isNullable: true,
                },
                {
                    name: 'observations',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'selectedRisks',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'requiredPpe',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }));

        // ========== TABLA HEIGHT WORKS ==========
        await queryRunner.createTable(new Table({
            name: 'height_works',
            columns: [
                {
                    name: 'id',
                    type: 'serial',
                    isPrimary: true,
                },
                {
                    name: 'formId',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'workerName',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'identification',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                },
                {
                    name: 'position',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'workDescription',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'location',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'estimatedTime',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'protectionElements',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'physicalCondition',
                    type: 'boolean',
                    isNullable: true,
                },
                {
                    name: 'instructionsReceived',
                    type: 'boolean',
                    isNullable: true,
                },
                {
                    name: 'fitForHeightWork',
                    type: 'boolean',
                    isNullable: true,
                },
                {
                    name: 'authorizerName',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'authorizerIdentification',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }));

        // ========== TABLA PREOPERATIONAL CHECKS ==========
        await queryRunner.createTable(new Table({
            name: 'preoperational_checks',
            columns: [
                {
                    name: 'id',
                    type: 'serial',
                    isPrimary: true,
                },
                {
                    name: 'formId',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'parameter',
                    type: 'varchar',
                    length: '500',
                    isNullable: false,
                },
                {
                    name: 'value',
                    type: 'enum',
                    enum: ['GOOD', 'BAD', 'YES', 'NO'],
                    isNullable: true,
                },
                {
                    name: 'observations',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }));

        // ========== TABLA SIGNATURES ==========
        await queryRunner.createTable(new Table({
            name: 'signatures',
            columns: [
                {
                    name: 'id',
                    type: 'serial',
                    isPrimary: true,
                },
                {
                    name: 'formId',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'signatureType',
                    type: 'enum',
                    enum: ['TECHNICIAN', 'SST'],
                    isNullable: false,
                },
                {
                    name: 'userId',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'userName',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'signatureData',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'signedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }));

        // ========== TABLA GENERATED PDFS ==========
        await queryRunner.createTable(new Table({
            name: 'generated_pdfs',
            columns: [
                {
                    name: 'id',
                    type: 'serial',
                    isPrimary: true,
                },
                {
                    name: 'formId',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'pdfData',
                    type: 'bytea',
                    isNullable: true,
                },
                {
                    name: 'fileName',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'filePath',
                    type: 'varchar',
                    length: '500',
                    isNullable: true,
                },
                {
                    name: 'fileSize',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'generatedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }));

        // ========== FOREIGN KEYS ==========

        // ATS Reports -> Forms
        await queryRunner.createForeignKey('ats_reports', new TableForeignKey({
            columnNames: ['formId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'forms',
            onDelete: 'CASCADE',
        }));

        // Height Works -> Forms
        await queryRunner.createForeignKey('height_works', new TableForeignKey({
            columnNames: ['formId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'forms',
            onDelete: 'CASCADE',
        }));

        // Preoperational Checks -> Forms
        await queryRunner.createForeignKey('preoperational_checks', new TableForeignKey({
            columnNames: ['formId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'forms',
            onDelete: 'CASCADE',
        }));

        // Signatures -> Forms
        await queryRunner.createForeignKey('signatures', new TableForeignKey({
            columnNames: ['formId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'forms',
            onDelete: 'CASCADE',
        }));

        // Generated PDFs -> Forms
        await queryRunner.createForeignKey('generated_pdfs', new TableForeignKey({
            columnNames: ['formId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'forms',
            onDelete: 'CASCADE',
        }));

        // ========== ÍNDICES ==========
        await queryRunner.createIndex('forms', new TableIndex({
            name: 'IDX_FORMS_STATUS',
            columnNames: ['status']
        }));

        await queryRunner.createIndex('forms', new TableIndex({
            name: 'IDX_FORMS_TYPE',
            columnNames: ['formType']
        }));

        await queryRunner.createIndex('forms', new TableIndex({
            name: 'IDX_FORMS_USER',
            columnNames: ['userId']
        }));

        await queryRunner.createIndex('signatures', new TableIndex({
            name: 'IDX_SIGNATURES_FORM_USER',
            columnNames: ['formId', 'userId']
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar en orden inverso por las foreign keys
        await queryRunner.dropTable('generated_pdfs');
        await queryRunner.dropTable('signatures');
        await queryRunner.dropTable('preoperational_checks');
        await queryRunner.dropTable('height_works');
        await queryRunner.dropTable('ats_reports');
        await queryRunner.dropTable('forms');
    }

}
