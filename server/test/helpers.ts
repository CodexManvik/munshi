import { openDb } from '../db.ts';
import { seed } from '../seed.ts';

export const AT = new Date('2026-11-01T09:00:00+05:30');
export const DAY = 86_400_000;

export function fresh() {
  const db = openDb(':memory:');
  seed(db, AT);
  return db;
}
