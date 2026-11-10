/**
 * Applies supabase/migrations/*.sql in order, then seeds launch content.
 *   npm run db:migrate            # schema + seed
 *   npm run db:migrate -- --no-seed
 * Each migration is recorded in schema_migrations, so running this again is safe.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../src/env';
import { createPgDb } from '../src/db';
import { seed } from './seed-lib';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../../../supabase/migrations');

const env = loadEnv();
const db = createPgDb(env.DATABASE_URL, env.DATABASE_SSL);

try {
  await db.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await db.query('select 1 from schema_migrations where name = $1', [f]);
    if (done.rows[0]) continue;
    const sql = await readFile(path.join(dir, f), 'utf8');
    await db.tx(async (q) => {
      await q.query(sql);
      await q.query('insert into schema_migrations (name) values ($1)', [f]);
    });
    console.log(`applied ${f}`);
  }
  if (!process.argv.includes('--no-seed')) {
    await seed(db);
    console.log('seeded launch content');
  }
} finally {
  await db.close();
}
