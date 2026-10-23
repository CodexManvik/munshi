import { createHash } from 'node:crypto';
import { TABLES, type DB } from './db.ts';

export const HERO_ID = 'm_ramesh';
const DAY = 86_400_000;
const HOUR = 3_600_000;
const IST = 5.5 * HOUR;
const HERO = { lat: 26.8467, lng: 80.9462 };
const CATEGORIES = ['kirana', 'sweets', 'pooja', 'general'];
const SHOP_NAMES = [
  'Gupta General Store', 'Mishra Mithai Bhandar', 'Shri Ram Pooja Samagri', 'Agarwal Provisions',
  'Yadav Kirana', 'Annapurna Sweets', 'Shiv Shakti Pooja Bhandar', 'Verma Departmental',
  'Bajrang Kirana', 'Chhappan Bhog', 'Maa Durga Pooja Store', 'Jain Super Store',
  'Tiwari Kirana', 'Raj Sweets', 'Om Pooja Kendra', 'Saxena General Store',
  'Pandey Kirana', 'Haldiram Corner', 'Ganesh Pooja Samagri', 'Srivastava Stores',
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hashPayer = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);

export function seed(db: DB, at: Date, opts: { demoPhone?: string } = {}): void {
  const rand = mulberry32(42);
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const todayStart = Math.floor((at.getTime() + IST) / DAY) * DAY - IST; // 00:00 IST of `at`
  const iso = (ms: number) => new Date(ms).toISOString();

  db.exec('BEGIN');
  try {
    for (const t of TABLES) db.exec(`DELETE FROM ${t}`);

    const merchants: Array<{ id: string; category: string }> = [{ id: HERO_ID, category: 'kirana' }];
    const insMerchant = db.prepare('INSERT INTO merchants (id,name,category,locality,lat,lng,language) VALUES (?,?,?,?,?,?,?)');
    insMerchant.run(HERO_ID, 'Ramesh Kirana', 'kirana', 'Aliganj, Lucknow', HERO.lat, HERO.lng, 'hi');
    SHOP_NAMES.forEach((name, i) => {
      const id = `m_n${String(i + 1).padStart(2, '0')}`;
      const category = CATEGORIES[i % CATEGORIES.length];
      const km = 0.2 + rand() * 1.7;
      const angle = rand() * 2 * Math.PI;
      const lat = HERO.lat + (km * Math.sin(angle)) / 111;
      const lng = HERO.lng + (km * Math.cos(angle)) / (111 * Math.cos((HERO.lat * Math.PI) / 180));
      insMerchant.run(id, name, category, 'Aliganj, Lucknow', lat, lng, 'hi');
      merchants.push({ id, category });
    });

    const insPay = db.prepare('INSERT INTO payments (merchant_id,amount,ts,payer_hash,counterparty) VALUES (?,?,?,?,?)');
    const insSettle = db.prepare('INSERT INTO settlements (merchant_id,date,amount) VALUES (?,?,?)');
    for (const m of merchants) {
      const payers = Array.from({ length: 150 }, (_, i) => hashPayer(`${m.id}:${i}`));
      const festive = m.category === 'sweets' || m.category === 'pooja';
      for (let d = 89; d >= 1; d--) {
        const dayStart = todayStart - d * DAY;
        const count = Math.round(between(15, 40) * (festive && d <= 7 ? 1.4 : 1));
        let total = 0;
        for (let p = 0; p < count; p++) {
          // 30 regulars make up half of all visits.
          const idx = rand() < 0.5 ? Math.floor(rand() * 30) : 30 + Math.floor(rand() * 120);
          const amount = between(20, 600);
          total += amount;
          insPay.run(m.id, amount, iso(dayStart + 8 * HOUR + rand() * 13 * HOUR), payers[idx], 'customer');
        }
        insSettle.run(m.id, iso(dayStart).slice(0, 10), total);
        if (m.id === HERO_ID && d % 7 === 3) {
          insPay.run(m.id, between(8000, 15000), iso(dayStart + 11 * HOUR), hashPayer('distributor:1'), 'distributor');
        }
      }
    }

    const insKhata = db.prepare('INSERT INTO khata (merchant_id,customer_name,phone,amount,given_on,status) VALUES (?,?,?,?,?,?)');
    const ago = (days: number) => iso(at.getTime() - days * DAY);
    insKhata.run(HERO_ID, 'Sharma ji', opts.demoPhone ?? '+919999900001', 450, ago(12), 'open');
    insKhata.run(HERO_ID, 'Pinky didi', '+919999900002', 230, ago(9), 'open');
    insKhata.run(HERO_ID, 'Verma ji', '+919999900003', 120, ago(3), 'open');
    insKhata.run(HERO_ID, 'Gupta ji', '+919999900004', 800, ago(20), 'paid');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
