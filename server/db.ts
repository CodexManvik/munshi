import { DatabaseSync } from 'node:sqlite';

export type DB = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, locality TEXT,
  lat REAL NOT NULL, lng REAL NOT NULL, language TEXT NOT NULL DEFAULT 'hi'
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY, merchant_id TEXT NOT NULL, amount INTEGER NOT NULL, ts TEXT NOT NULL,
  payer_hash TEXT NOT NULL, counterparty TEXT NOT NULL CHECK (counterparty IN ('customer','distributor'))
);
CREATE INDEX IF NOT EXISTS payments_merchant_ts ON payments(merchant_id, ts);
CREATE TABLE IF NOT EXISTS settlements (merchant_id TEXT NOT NULL, date TEXT NOT NULL, amount INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS khata (
  id INTEGER PRIMARY KEY, merchant_id TEXT NOT NULL, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
  amount INTEGER NOT NULL, given_on TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('open','paid'))
);
CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY, merchant_id TEXT NOT NULL, type TEXT NOT NULL, key TEXT NOT NULL,
  payload TEXT NOT NULL, est_value INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new','proposed','accepted','declined','done')),
  created_at TEXT NOT NULL, UNIQUE (merchant_id, type, key)
);
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY, opportunity_id INTEGER NOT NULL, tool TEXT NOT NULL, args TEXT NOT NULL,
  result TEXT, ts TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pay_links (
  ref TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, khata_id INTEGER NOT NULL, action_id INTEGER NOT NULL,
  amount INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending','paid')), paid_at TEXT
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY, merchant_id TEXT NOT NULL, action_id INTEGER, kind TEXT NOT NULL,
  amount INTEGER NOT NULL, label TEXT NOT NULL, ts TEXT NOT NULL
);
`;

export const TABLES = ['merchants', 'payments', 'settlements', 'khata', 'opportunities', 'actions', 'pay_links', 'ledger'];

export function openDb(path: string): DB {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}
