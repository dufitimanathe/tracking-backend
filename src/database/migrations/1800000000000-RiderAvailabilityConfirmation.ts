import { MigrationInterface, QueryRunner } from 'typeorm';

export class RiderAvailabilityConfirmation1800000000000 implements MigrationInterface {
  name = 'RiderAvailabilityConfirmation1800000000000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "riders_availabilitystatus_enum" ADD VALUE IF NOT EXISTS 'AWAITING_AVAILABILITY'`,
    );
    await queryRunner.query(
      `ALTER TYPE "riders_availabilitystatus_enum" ADD VALUE IF NOT EXISTS 'BUSY'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Keep riders unavailable when rolling back. PostgreSQL enum values are additive;
    // retaining the unused labels avoids rebuilding the type and locking the table.
    await queryRunner.query(`UPDATE "riders" SET "availabilityStatus" = 'OFFLINE'
      WHERE "availabilityStatus" IN ('AWAITING_AVAILABILITY', 'BUSY')`);
  }
}
