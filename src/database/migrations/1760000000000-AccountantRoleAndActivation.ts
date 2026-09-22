import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountantRoleAndActivation1760000000000 implements MigrationInterface {
  name = 'AccountantRoleAndActivation1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "company_members_role_enum" ADD VALUE IF NOT EXISTS 'ACCOUNTANT'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_activation_tokens" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "companyId" uuid,
        "membershipId" uuid,
        "tokenHash" varchar(255) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "usedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_email_activation_tokens_user"
      ON "email_activation_tokens" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "email_activation_tokens"`);
    // Postgres cannot easily remove enum values; leave ACCOUNTANT in place.
  }
}
