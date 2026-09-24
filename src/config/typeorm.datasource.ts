import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { entities } from '../database/entities';

loadEnv();

/**
 * Paths must resolve under both:
 * - ts-node (src/config → src/database/migrations/*.ts)
 * - compiled Docker/prod (dist/config → dist/database/migrations/*.js)
 */
const migrationsGlob = join(__dirname, '../database/migrations', '*{.ts,.js}');

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: (process.env.DATABASE_SSL ?? 'false') === 'true' ? { rejectUnauthorized: false } : false,
  entities,
  migrations: [migrationsGlob],
  migrationsTransactionMode: 'each',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
