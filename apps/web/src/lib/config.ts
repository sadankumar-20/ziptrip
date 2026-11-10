/**
 * demo   = sample data in the browser, admin opens without a password. For previews only.
 * static = live website without a backend: only real trips, WhatsApp booking works, no admin portal.
 * api    = full platform with the Express API and database; admin needs a real login.
 */
const raw = import.meta.env.VITE_DATA_MODE;
export const DATA_MODE: 'demo' | 'static' | 'api' = raw === 'api' ? 'api' : raw === 'static' ? 'static' : 'demo';
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const ROUTER_MODE: 'memory' | 'browser' = import.meta.env.VITE_ROUTER === 'memory' ? 'memory' : 'browser';
export const SITE_URL: string = import.meta.env.VITE_SITE_URL ?? 'https://joinziptrip.com';
export const IS_DEMO = DATA_MODE === 'demo';
/** The admin portal only exists where it is protected (api) or harmless (local demo). */
export const ADMIN_ENABLED = DATA_MODE !== 'static';
