import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyApprovalAndDocuments1790000000000 implements MigrationInterface {
  name = 'CompanyApprovalAndDocuments1790000000000';
  /** Enum ADD VALUE cannot run inside a transaction on older Postgres. */
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "companies_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW'
    `);
    await queryRunner.query(`
      ALTER TYPE "companies_status_enum" ADD VALUE IF NOT EXISTS 'REJECTED'
    `);

    await queryRunner.query(`
      ALTER TABLE "companies"
        ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS "approvedByUserId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS "rejectionReason" text NULL,
        ADD COLUMN IF NOT EXISTS "reviewNotes" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "companies" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW'
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "company_documents_type_enum" AS ENUM (
          'BUSINESS_REGISTRATION',
          'TAX_CLEARANCE',
          'DIRECTOR_ID',
          'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "company_documents_status_enum" AS ENUM (
          'SUBMITTED',
          'APPROVED',
          'REJECTED'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "companyId" uuid NOT NULL,
        "type" "company_documents_type_enum" NOT NULL,
        "title" varchar(255) NOT NULL,
        "fileUrl" varchar(1000) NOT NULL,
        "notes" text NULL,
        "status" "company_documents_status_enum" NOT NULL DEFAULT 'SUBMITTED',
        "reviewNotes" text NULL,
        "reviewedByUserId" uuid NULL,
        "reviewedAt" TIMESTAMPTZ NULL,
        "uploadedByUserId" uuid NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_documents_company"
        ON "company_documents" ("companyId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_documents_type"
        ON "company_documents" ("type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "company_documents"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "company_documents_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "company_documents_type_enum"`);
    await queryRunner.query(`
      ALTER TABLE "companies"
        DROP COLUMN IF EXISTS "approvedAt",
        DROP COLUMN IF EXISTS "approvedByUserId",
        DROP COLUMN IF EXISTS "rejectedAt",
        DROP COLUMN IF EXISTS "rejectionReason",
        DROP COLUMN IF EXISTS "reviewNotes"
    `);
  }
}
