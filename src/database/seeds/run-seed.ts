import { config as loadEnv } from 'dotenv';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { MembershipStatus, UserRole, UserStatus } from '../../common/enums';
import { entities } from '../entities';

loadEnv();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'theodufi.rw@gmail.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Password123!';
const COMPANY_NAME = 'Kampere Motari Ltd';
const COMPANY_PHONE = '+250782027429';
// Keep the existing tenant identifier so reseeding updates the same company.
const COMPANY_SLUG = 'virunga-transport-ltd';

async function ensureAdmin(
  manager: {
    query: (sql: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>;
  },
  passwordHash: string,
  companyId: string,
): Promise<string> {
  const existing = await manager.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [
    ADMIN_EMAIL,
  ]);

  let adminUserId: string;
  if (existing.length > 0) {
    adminUserId = existing[0].id as string;
    await manager.query(
      `UPDATE users
       SET "firstName" = $1, "lastName" = $2, phone = $3, "passwordHash" = $4, status = $5, "updatedAt" = now()
       WHERE id = $6`,
      ['Theo', 'Dufit', '+250788100001', passwordHash, UserStatus.ACTIVE, adminUserId],
    );
  } else {
    const inserted = await manager.query(
      `INSERT INTO users ("firstName", "lastName", email, phone, "passwordHash", status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      ['Theo', 'Dufit', ADMIN_EMAIL, '+250788100001', passwordHash, UserStatus.ACTIVE],
    );
    adminUserId = inserted[0].id as string;
  }

  const membership = await manager.query(
    `SELECT id FROM company_members WHERE "userId" = $1 AND "companyId" = $2 LIMIT 1`,
    [adminUserId, companyId],
  );

  if (membership.length === 0) {
    await manager.query(
      `INSERT INTO company_members ("userId", "companyId", role, status, "joinedAt")
       VALUES ($1, $2, $3, $4, now())`,
      [adminUserId, companyId, UserRole.COMPANY_ADMIN, MembershipStatus.ACTIVE],
    );
  } else {
    await manager.query(
      `UPDATE company_members
       SET role = $1, status = $2, "updatedAt" = now()
       WHERE id = $3`,
      [UserRole.COMPANY_ADMIN, MembershipStatus.ACTIVE, membership[0].id],
    );
  }

  return adminUserId;
}

async function runSeed(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: (process.env.DATABASE_SSL ?? 'false') === 'true' ? { rejectUnauthorized: false } : false,
    entities,
    synchronize: false,
  });

  await dataSource.initialize();
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);

  try {
    const tables = await dataSource.query(
      `SELECT to_regclass('public.users') AS users, to_regclass('public.companies') AS companies`,
    );
    if (!tables[0]?.users || !tables[0]?.companies) {
      throw new Error('Schema missing (users/companies). Run migrations before seeding.');
    }

    await dataSource.transaction(async (manager) => {
      let companyId: string;
      const existingCompany = await manager.query(
        `SELECT id FROM companies WHERE slug = $1 LIMIT 1`,
        [COMPANY_SLUG],
      );

      if (existingCompany.length > 0) {
        companyId = existingCompany[0].id as string;
        await manager.query(
          `UPDATE companies SET name = $1, phone = $2, "updatedAt" = now()
           WHERE id = $3 AND (name IS DISTINCT FROM $1 OR phone IS DISTINCT FROM $2)`,
          [COMPANY_NAME, COMPANY_PHONE, companyId],
        );
      } else {
        const company = await manager.query(
          `INSERT INTO companies (name, slug, email, phone, address, timezone, currency)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [
            COMPANY_NAME,
            COMPANY_SLUG,
            'info@kamotari.rw',
            COMPANY_PHONE,
            'KG 9 Ave, Kacyiru, Kigali',
            'Africa/Kigali',
            'RWF',
          ],
        );
        companyId = company[0].id as string;
      }

      await ensureAdmin(manager, passwordHash, companyId);

      const onboarding = await manager.query(
        `SELECT id FROM company_onboarding WHERE "companyId" = $1 LIMIT 1`,
        [companyId],
      );
      if (onboarding.length === 0) {
        await manager.query(
          `INSERT INTO company_onboarding ("companyId", "companyProfileCompleted", "operationalSettingsCompleted", "fleetAdded", "teamAdded", "completedAt")
           VALUES ($1, true, true, false, false, now())`,
          [companyId],
        );
      }

      const pricing = await manager.query(
        `SELECT id FROM pricing_rules WHERE "companyId" = $1 AND active = true LIMIT 1`,
        [companyId],
      );
      if (pricing.length === 0) {
        await manager.query(
          `INSERT INTO pricing_rules ("companyId", "firstKilometerPrice", "additionalKilometerPrice", currency, "effectiveFrom", active)
           VALUES ($1, '500', '400', 'RWF', now(), true)`,
          [companyId],
        );
      }
    });

    console.log('Seed completed: company + admin only (no fleet/riders/employees).');
    console.log(`Admin: ${ADMIN_EMAIL}`);
  } finally {
    await dataSource.destroy();
  }
}

runSeed().catch((error) => {
  console.error(error);
  process.exit(1);
});
