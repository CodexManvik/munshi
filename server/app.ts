import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './db.ts';
import type { Deps } from './actions.ts';
import { now, advance, resetClock } from './clock.ts';
import { seed, HERO_ID } from './seed.ts';
import { nextOpportunity, confirmOpportunity, declineOpportunity, shouldInterrupt, NotProposedError } from './opportunities.ts';
import { phrase } from './phrase.ts';
import { converse, DECLINED } from './agent.ts';
import { getPayLink, payLink, recordWalkin } from './payments.ts';
import { getLedger } from './ledger.ts';
import { publish, subscribe } from './events.ts';

export type AppDeps = Deps & { demoPhone?: string };
type Handler = (ctx: { db: DB; deps: AppDeps; params: string[]; body: any; res: ServerResponse }) => Promise<unknown> | unknown;

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
  ['GET', /^\/api\/events$/, ({ res }) => { subscribe(res); return undefined; }],
  ['POST', /^\/api\/next$/, async ({ db, deps, body }) => {
    const at = now();
    if (body.interrupt && !shouldInterrupt(db, HERO_ID, at)) return { id: null };
    const opp = nextOpportunity(db, HERO_ID, at);
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
    if (!r.alreadyPaid) { publish({ type: 'announce', text: r.announcement }); publish({ type: 'ledger' }); }
    return { alreadyPaid: r.alreadyPaid };
  }],
  ['GET', /^\/api\/ledger$/, ({ db }) => getLedger(db, HERO_ID, now())],
  ['POST', /^\/api\/control\/reset$/, ({ db, deps }) => {
    resetClock();
    seed(db, now(), { demoPhone: deps.demoPhone });
    publish({ type: 'ledger' });
    return { ok: true };
  }],
  ['POST', /^\/api\/control\/advance$/, ({ body }) => { advance(Number(body.minutes) || 0); return { now: now().toISOString() }; }],
  ['POST', /^\/api\/control\/brief$/, () => { publish({ type: 'brief' }); return { ok: true }; }],
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
    if (raw.length > 1_000_000) throw new HttpError(413, 'body too large');
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
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    try {
      for (const [method, re, handler] of routes) {
        const m = path.match(re);
        if (!m || method !== req.method) continue;
        const body = req.method === 'POST' ? await readJson(req) : {};
        const out = await handler({ db, deps, params: m.slice(1), body, res });
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
