import type { DB } from './db.ts';
import { refreshOpportunities } from './detectors.ts';
import { getOpportunity, proposeOpportunity } from './opportunities.ts';
import { getLedger } from './ledger.ts';
import { template } from './phrase.ts';

const DAY = 86_400_000;

export const toolDefs = [
  { name: 'get_opportunities', description: 'Dukaan ke liye abhi ke kamaai/bachat ke mauke (udhaar wapas, waghaira), ₹ anumaan ke saath.', input_schema: { type: 'object', properties: {} } },
  { name: 'explain_opportunity', description: 'Ek mauke ki poori jaankari aur kyun suggest kiya gaya.', input_schema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } },
  { name: 'get_khata', description: 'Saare khule udhaar (khata) ki list: khata_id, naam, raashi, kitne din se.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_ledger', description: 'Munshi ne pichhle kuch dinon mein kitne ₹ dilaye, har line ke saath.', input_schema: { type: 'object', properties: { days: { type: 'integer' } } } },
  { name: 'send_udhaar_reminder', description: 'Kisi grahak ko udhaar ka WhatsApp reminder bhejne ka PRASTAAV banata hai. Yeh khud nahi bhejta; dukaandaar ke haan kehne par hi bheja jaata hai.', input_schema: { type: 'object', properties: { khata_id: { type: 'integer' } }, required: ['khata_id'] } },
];

const openKhata = (db: DB, merchantId: string, at: Date) =>
  (db.prepare("SELECT id, customer_name, amount, given_on FROM khata WHERE merchant_id=? AND status='open' ORDER BY amount DESC").all(merchantId) as any[])
    .map(k => ({ khataId: k.id, customerName: k.customer_name, amount: k.amount, days: Math.floor((at.getTime() - new Date(k.given_on).getTime()) / DAY) }));

// Every output here is merchant-facing: never select payments.payer_hash.
export function runTool(db: DB, merchantId: string, at: Date, name: string, input: any): unknown {
  switch (name) {
    case 'get_opportunities':
      refreshOpportunities(db, merchantId, at);
      return (db.prepare("SELECT id FROM opportunities WHERE merchant_id=? AND status IN ('new','proposed') ORDER BY est_value DESC").all(merchantId) as any[])
        .map(r => getOpportunity(db, r.id)!)
        .map(o => ({ id: o.id, type: o.type, estValue: o.estValue, status: o.status, payload: o.payload }));
    case 'explain_opportunity': {
      const o = getOpportunity(db, Number(input?.id));
      if (!o || o.merchantId !== merchantId) return { error: 'not_found' };
      return { id: o.id, type: o.type, estValue: o.estValue, status: o.status, payload: o.payload, suggestion: template(o) };
    }
    case 'get_khata':
      return openKhata(db, merchantId, at);
    case 'get_ledger':
      return getLedger(db, merchantId, at, Number(input?.days) || 7);
    case 'send_udhaar_reminder': {
      const k = openKhata(db, merchantId, at).find(k => k.khataId === Number(input?.khata_id));
      if (!k) return { error: 'khata_not_found' };
      db.prepare("INSERT OR IGNORE INTO opportunities (merchant_id,type,key,payload,est_value,status,created_at) VALUES (?,'udhaar_overdue',?,?,?,'new',?)")
        .run(merchantId, `khata:${k.khataId}`, JSON.stringify(k), k.amount, at.toISOString());
      const row = db.prepare("SELECT id, status FROM opportunities WHERE merchant_id=? AND type='udhaar_overdue' AND key=?").get(merchantId, `khata:${k.khataId}`) as any;
      if (row.status === 'done' || row.status === 'accepted') return { error: 'already_sent' };
      const opp = proposeOpportunity(db, merchantId, row.id);
      return { status: 'needs_confirmation', opportunityId: opp.id, line: template(opp) };
    }
    default:
      return { error: 'unknown_tool' };
  }
}
