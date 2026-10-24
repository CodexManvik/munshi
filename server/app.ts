import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './db.ts';
import type { Deps } from './actions.ts';
import { now, advance, resetClock } from './clock.ts';
import { seed, HERO_ID, hashPayer } from './seed.ts';
import { nextOpportunity, confirmOpportunity, declineOpportunity, shouldInterrupt, NotProposedError } from './opportunities.ts';
import { phrase } from './phrase.ts';
import { converse, DECLINED } from './agent.ts';
import { getPayLink, payLink, recordWalkin, recordCustomerPayment } from './payments.ts';
import { getLedger } from './ledger.ts';
import { getImpact } from './impact.ts';
import { publish, subscribe } from './events.ts';
import { shelfFlow, analyzeShelf, NoVisionError, type Reading } from './shelf.ts';
import type { FetchMedia } from './whatsapp.ts';

export type AppDeps = Deps & { demoKey?: string; demoPhone?: string; fetchMedia?: FetchMedia; waVerifyToken?: string };
type Handler = (ctx: { db: DB; deps: AppDeps; params: string[]; query: URLSearchParams; body: any; res: ServerResponse }) => Promise<unknown> | unknown;

const CANNED_SHELF: Reading[] = [{ sku: 'surf_1kg', level: 'empty' }, { sku: 'parle_g', level: 'low' }];
const NO_VISION = 'Photo dekhne ke liye AI chalu nahi hai.';

function publishShelf(db: DB, readings: Reading[]) {
  const r = shelfFlow(db, HERO_ID, readings, now());
  publish({ type: 'shelf', ...r });
  return r;
}

// A WhatsApp image from the shop: read the shelf and tell the Soundbox. Everything else is ignored.
async function handleWhatsApp(db: DB, deps: AppDeps, body: any) {
  const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (msg?.type !== 'image' || !deps.fetchMedia) return;
  const image = msg.image?.id ? await deps.fetchMedia(msg.image.id) : null;
  if (!image) return;
  try {
    publishShelf(db, await analyzeShelf(db, HERO_ID, image, deps.anthropic));
  } catch (e) {
    if (e instanceof NoVisionError) publish({ type: 'announce', text: NO_VISION });
    else console.error(e);
  }
}

const DIST = fileURLToPath(new URL('../web/dist/', import.meta.url));
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const routes: Array<[string, RegExp, Handler]> = [
  ['GET', /^\/healthz$/, () => ({ ok: true })],
  ['GET', /^\/api\/events$/, ({ res }) => { subscribe(res); return undefined; }],
  ['POST', /^\/api\/next$/, async ({ db, deps, body }) => {
    const at = now();
    if (body.interrupt && !shouldInterrupt(db, HERO_ID, at)) return { id: null };
    const opp = nextOpportunity(db, HERO_ID, at, body.scope === 'all' ? 'all' : 'brief');
    return opp ? { id: opp.id, type: opp.type, line: await phrase(opp, deps.anthropic) } : { id: null };
  }],
  ['POST', /^\/api\/opportunities\/(\d+)\/confirm$/, async ({ db, deps, params }) => {
    const r = await confirmOpportunity(db, Number(params[0]), deps, now());
    publish({ type: 'ledger' });
    return r;
  }],
  ['POST', /^\/api\/opportunities\/(\d+)\/decline$/, ({ db, params }) => { declineOpportunity(db, Number(params[0])); return { line: DECLINED }; }],
  ['POST', /^\/api\/converse$/, ({ db, deps, body }) => {
    if (typeof body.text !== 'string' || !body.text.trim()) throw new HttpError(400, 'text required');
    return converse(db, HERO_ID, body.text, now(), deps);
  }],
  ['GET', /^\/api\/pay\/([\w-]+)$/, ({ db, params }) => getPayLink(db, params[0]) ?? Promise.reject(new HttpError(404, 'unknown link'))],
  ['POST', /^\/api\/pay\/([\w-]+)$/, ({ db, params }) => {
    const r = payLink(db, params[0], now());
    if (!r) throw new HttpError(404, 'unknown link');
    if (!r.alreadyPaid) { publish({ type: 'announce', text: r.announcement }); publish({ type: 'paid', ref: params[0] }); publish({ type: 'ledger' }); }
    return { alreadyPaid: r.alreadyPaid };
  }],
  ['GET', /^\/api\/ledger$/, ({ db }) => getLedger(db, HERO_ID, now())],
  ['GET', /^\/api\/impact$/, ({ db, query }) => {
    const n = Math.round(Number(query.get('merchants') ?? 100000));
    if (!(n >= 1 && n <= 10_000_000)) throw new HttpError(400, 'merchants must be 1 to 1,00,00,000');
    return getImpact(db, HERO_ID, now(), n);
  }],
  ['POST', /^\/api\/control\/reset$/, ({ db, deps }) => {
    resetClock();
    seed(db, now(), { demoPhone: deps.demoPhone });
    publish({ type: 'ledger' });
    return { ok: true };
  }],
  ['POST', /^\/api\/control\/advance$/, ({ body }) => { advance(Number(body.minutes) || 0); return { now: now().toISOString() }; }],
  ['POST', /^\/api\/control\/brief$/, () => { publish({ type: 'brief' }); return { ok: true }; }],
  ['POST', /^\/api\/shelf$/, async ({ db, deps, body }) => {
    if (typeof body.image !== 'string' || !body.image) throw new HttpError(400, 'image required');
    try {
      const readings = await analyzeShelf(db, HERO_ID, { data: body.image, mediaType: body.mediaType || 'image/jpeg' }, deps.anthropic);
      return shelfFlow(db, HERO_ID, readings, now());
    } catch (e) {
      if (e instanceof NoVisionError) throw new HttpError(503, NO_VISION);
      throw e;
    }
  }],
  ['POST', /^\/api\/control\/shelf$/, ({ db }) => publishShelf(db, CANNED_SHELF)],
  ['POST', /^\/api\/control\/nudge$/, () => { publish({ type: 'nudge' }); return { ok: true }; }],
  ['GET', /^\/webhook\/whatsapp$/, ({ deps, query, res }) => {
    const ok = query.get('hub.mode') === 'subscribe' && !!deps.waVerifyToken && query.get('hub.verify_token') === deps.waVerifyToken;
    if (!ok) throw new HttpError(403, 'verify token mismatch');
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(query.get('hub.challenge') ?? '');
    return undefined;
  }],
  ['POST', /^\/webhook\/whatsapp$/, ({ db, deps, body }) => {
    handleWhatsApp(db, deps, body).catch(e => console.error(e)); // Meta wants a fast 200; the work continues after.
    return { ok: true };
  }],
  ['POST', /^\/api\/control\/regular$/, ({ db }) => {
    for (const text of recordCustomerPayment(db, HERO_ID, 180, hashPayer(`${HERO_ID}:loyal`), now())) publish({ type: 'announce', text });
    publish({ type: 'ledger' });
    return { ok: true };
  }],
  ['POST', /^\/api\/control\/returning$/, ({ db }) => {
    const t = db.prepare(
      `SELECT t.payer_hash FROM winback_targets t JOIN winback_campaigns c ON c.id = t.campaign_id
       WHERE c.merchant_id=? AND t.returned_at IS NULL ORDER BY c.id DESC LIMIT 1`,
    ).get(HERO_ID) as any;
    if (!t) throw new HttpError(409, 'Pehle win-back offer bhejiye');
    for (const text of recordCustomerPayment(db, HERO_ID, 340, t.payer_hash, now())) publish({ type: 'announce', text });
    publish({ type: 'ledger' });
    return { ok: true };
  }],
  ['POST', /^\/api\/control\/walkin$/, ({ db, body }) => {
    const amount = Math.round(Number(body.amount));
    if (!(amount > 0)) throw new HttpError(400, 'amount required');
    publish({ type: 'announce', text: recordWalkin(db, HERO_ID, amount, now()) });
    return { ok: true };
  }],
];

async function readJson(req: IncomingMessage): Promise<any> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 12_000_000) throw new HttpError(413, 'body too large');
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new HttpError(400, 'invalid json'); }
}

async function serveStatic(path: string, res: ServerResponse) {
  const file = normalize(join(DIST, decodeURIComponent(path)));
  if (!file.startsWith(DIST)) throw new HttpError(404, 'not found');
  for (const candidate of [file, join(DIST, 'index.html')]) {
    try {
      const data = await readFile(candidate);
      res.writeHead(200, { 'content-type': TYPES[extname(candidate)] ?? 'application/octet-stream' });
      res.end(data);
      return;
    } catch { /* try next */ }
  }
  throw new HttpError(404, 'not found');
}

const send = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

export function createApp(db: DB, deps: AppDeps): http.Server {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const path = url.pathname;
    // Public tunnel: merchant and control APIs need the demo key; the customer pay API does not.
    const guarded = deps.demoKey && path.startsWith('/api/') && !path.startsWith('/api/pay/');
    if (guarded && (req.headers['x-demo-key'] ?? url.searchParams.get('key')) !== deps.demoKey) return send(res, 401, { error: 'demo key required' });
    try {
      for (const [method, re, handler] of routes) {
        const m = path.match(re);
        if (!m || method !== req.method) continue;
        const body = req.method === 'POST' ? await readJson(req) : {};
        const out = await handler({ db, deps, params: m.slice(1), query: url.searchParams, body, res });
        if (out !== undefined) send(res, 200, out);
        return;
      }
      if (req.method === 'GET' && !path.startsWith('/api/')) return await serveStatic(path, res);
      throw new HttpError(404, 'not found');
    } catch (e) {
      if (res.headersSent) return res.end();
      if (e instanceof NotProposedError) return send(res, 409, { error: 'not_proposed' });
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      console.error(e);
      send(res, 500, { error: 'internal' });
    }
  });
}
