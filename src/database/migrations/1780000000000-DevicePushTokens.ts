import { MigrationInterface, QueryRunner } from 'typeorm';

export class DevicePushTokens1780000000000 implements MigrationInterface {
  name = 'DevicePushTokens1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "device_push_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "token" varchar(512) NOT NULL,
        "platform" varchar(32) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_device_push_tokens_token"
        ON "device_push_tokens" ("token")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_device_push_tokens_user"
        ON "device_push_tokens" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "device_push_tokens"`);
  }
}
