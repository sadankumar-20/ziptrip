import { loadEnv } from './env';
import { createPgDb } from './db';
import { createStorage } from './storage';
import { createApp } from './app';

const env = loadEnv();
const db = createPgDb(env.DATABASE_URL, env.DATABASE_SSL);
const app = createApp({ db, env, storage: createStorage(env) });

const server = app.listen(env.PORT, () => {
  console.log(`JoinZipTrip API listening on :${env.PORT} (${env.NODE_ENV}, storage=${env.STORAGE_DRIVER}, payments=${env.PAYMENTS_ENABLED ? 'on' : 'off'})`);
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    server.close(() => db.close().finally(() => process.exit(0)));
  });
}
