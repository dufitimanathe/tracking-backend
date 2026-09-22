import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrackingPolicyOnCompanies1770000000000 implements MigrationInterface {
  name = 'TrackingPolicyOnCompanies1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
        ADD COLUMN IF NOT EXISTS "trackingShareIntervalMinutes" integer NOT NULL DEFAULT 10,
        ADD COLUMN IF NOT EXISTS "trackingHistoryRetentionDays" integer NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS "trackingKeepDailyLastPingOnly" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
        DROP COLUMN IF EXISTS "trackingShareIntervalMinutes",
        DROP COLUMN IF EXISTS "trackingHistoryRetentionDays",
        DROP COLUMN IF EXISTS "trackingKeepDailyLastPingOnly"
    `);
  }
}
