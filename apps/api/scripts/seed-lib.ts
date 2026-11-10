import { SEED_TRIPS, SEED_LEADERS, DEFAULT_SETTINGS } from '@jzt/shared';
import type { Db } from '../src/db';
import * as repo from '../src/repo';

/**
 * Production seed: the real Thadiyandamol trip (published), placeholder leader profiles to fill in,
 * and the sample trips as unpublished drafts. No reviews or albums, because none exist yet.
 */
export async function seed(db: Db, opts: { includeDemoTripsPublished?: boolean } = {}) {
  for (const l of SEED_LEADERS) {
    const exists = await db.query('select 1 from leaders where id = $1', [l.id]);
    if (!exists.rows[0]) await repo.saveLeader(db, l, undefined, l.id);
  }
  for (const t of SEED_TRIPS) {
    const exists = await db.query('select 1 from trips where id = $1', [t.id]);
    if (exists.rows[0]) continue;
    const isPublished = t.isDemo ? !!opts.includeDemoTripsPublished : t.isPublished;
    await repo.saveTrip(db, { ...t, isPublished }, undefined, t.id);
  }
  await db.query(`insert into settings (key, value) values ('site', $1) on conflict (key) do nothing`, [JSON.stringify(DEFAULT_SETTINGS)]);
}
