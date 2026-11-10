import type { Request, Response, NextFunction, CookieOptions } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { can, type Permission, type AdminUser, type AdminRole } from '@jzt/shared';
import type { Queryable } from './db';
import type { Env } from './env';
import { rowToAdmin } from './repo';

export const COOKIE = 'jzt_admin';
const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { admin?: AdminUser }
  }
}

interface TokenClaims { sub: string; role: AdminRole; tv: number }

export function cookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
    maxAge: SESSION_HOURS * 3600 * 1000,
  };
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);

// Compared against when the email doesn't exist, so response timing doesn't reveal which accounts exist.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('no-such-account-placeholder', 12));

export async function login(db: Queryable, env: Env, email: string, password: string): Promise<{ user: AdminUser; token: string } | { error: string; status: number }> {
  const { rows } = await db.query('select * from admin_users where email = $1', [email]);
  const row = rows[0];
  if (!row) {
    await bcrypt.compare(password, getDummyHash());
    return { error: 'Email or password is incorrect', status: 401 };
  }
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return { error: `Too many attempts. Try again after ${LOCK_MINUTES} minutes.`, status: 429 };
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok || !row.is_active) {
    const failed = (row.failed_logins ?? 0) + 1;
    await db.query(
      `update admin_users set failed_logins = $2, locked_until = case when $2 >= ${MAX_FAILED} then now() + interval '${LOCK_MINUTES} minutes' else locked_until end where id = $1`,
      [row.id, failed >= MAX_FAILED ? 0 : failed],
    );
    return { error: row.is_active ? 'Email or password is incorrect' : 'This account is disabled', status: 401 };
  }
  await db.query('update admin_users set failed_logins = 0, locked_until = null, last_login_at = now() where id = $1', [row.id]);
  const claims: TokenClaims = { sub: row.id, role: row.role, tv: row.token_version };
  const token = jwt.sign(claims, env.JWT_SECRET, { expiresIn: `${SESSION_HOURS}h`, issuer: 'joinziptrip-api', audience: 'joinziptrip-admin' });
  return { user: rowToAdmin(row), token };
}

/** Verifies the session cookie and re-reads the user, so disabled accounts and role changes apply immediately. */
export function requireAuth(db: Queryable, env: Env) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ error: 'Sign in to continue' });
    let claims: TokenClaims;
    try {
      claims = jwt.verify(token, env.JWT_SECRET, { issuer: 'joinziptrip-api', audience: 'joinziptrip-admin' }) as unknown as TokenClaims;
    } catch {
      return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    }
    const { rows } = await db.query('select * from admin_users where id = $1', [claims.sub]);
    const row = rows[0];
    if (!row || !row.is_active || row.token_version !== claims.tv) return res.status(401).json({ error: 'Your session has ended. Sign in again.' });
    req.admin = rowToAdmin(row);
    next();
  };
}

export function requirePermission(p: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!can(req.admin?.role, p)) return res.status(403).json({ error: "Your role doesn't allow this action" });
    next();
  };
}

/**
 * Admin requests that change data must carry this header. Browsers can't add custom headers to
 * cross-site requests without a CORS preflight, which our CORS policy only allows from WEB_ORIGIN.
 */
export function requireCsrfHeader(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-jzt-csrf') !== '1') return res.status(403).json({ error: 'Missing request header' });
  next();
}
