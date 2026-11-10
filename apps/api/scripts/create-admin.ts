/**
 * Creates (or resets) an admin account.
 *   npm run admin:create -- --email you@example.com --name "Your Name" --role owner
 * The password is read from ADMIN_PASSWORD so it never lands in shell history.
 */
import { parseArgs } from 'node:util';
import { adminUserInputSchema } from '@jzt/shared';
import { loadEnv } from '../src/env';
import { createPgDb } from '../src/db';
import { hashPassword } from '../src/auth';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'owner' } } });
const password = process.env.ADMIN_PASSWORD;
const input = adminUserInputSchema.parse({ email: values.email, name: values.name, role: values.role, password });
if (!input.password) throw new Error('Set ADMIN_PASSWORD (at least 12 characters) before running this script');

const env = loadEnv();
const db = createPgDb(env.DATABASE_URL, env.DATABASE_SSL);
try {
  const hash = await hashPassword(input.password);
  await db.query(
    `insert into admin_users (email, name, role, password_hash) values ($1, $2, $3, $4)
     on conflict (email) do update set name = excluded.name, role = excluded.role, password_hash = excluded.password_hash,
       is_active = true, failed_logins = 0, locked_until = null, token_version = admin_users.token_version + 1`,
    [input.email, input.name, input.role, hash],
  );
  console.log(`Admin ready: ${input.email} (${input.role})`);
} finally {
  await db.close();
}
