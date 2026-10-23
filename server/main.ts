import Anthropic from '@anthropic-ai/sdk';
import { openDb } from './db.ts';
import { seed, HERO_ID } from './seed.ts';
import { now } from './clock.ts';
import { refreshOpportunities } from './detectors.ts';
import { getOpportunity } from './opportunities.ts';
import { phrase } from './phrase.ts';
import { makeSendWhatsApp, makeFetchWhatsAppMedia } from './whatsapp.ts';
import { createApp, type AppDeps } from './app.ts';
import type { AnthropicLike } from './actions.ts';

try { process.loadEnvFile(); } catch { /* .env is optional */ }
const env = process.env;

// Server-side refusal fallback on; the rest of the app only sees messages.create.
function makeAnthropic(): AnthropicLike | undefined {
  if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN) return undefined;
  const client = new Anthropic();
  return {
    messages: {
      create: (params: any) => client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as any),
    },
  };
}

const deps: AppDeps = {
  sendWhatsApp: makeSendWhatsApp(env),
  publicUrl: (env.PUBLIC_URL ?? `http://localhost:${env.PORT ?? 3000}`).replace(/\/$/, ''),
  anthropic: makeAnthropic(),
  demoPhone: env.DEMO_CUSTOMER_PHONE,
  fetchMedia: makeFetchWhatsAppMedia(env),
  waVerifyToken: env.WA_VERIFY_TOKEN,
};

const db = openDb(env.MUNSHI_DB ?? 'munshi.db');
seed(db, now(), { demoPhone: deps.demoPhone });

const port = Number(env.PORT ?? 3000);
createApp(db, deps).listen(port, () => {
  console.log(`Munshi on http://localhost:${port}  (public: ${deps.publicUrl}, claude: ${deps.anthropic ? 'on' : 'off'}, whatsapp: ${env.WA_TOKEN ? 'on' : 'off'})`);
});

// Pre-generate spoken lines so the first brief on stage never waits on Claude.
refreshOpportunities(db, HERO_ID, now());
for (const { id } of db.prepare("SELECT id FROM opportunities WHERE status='new'").all() as any[]) {
  void phrase(getOpportunity(db, id)!, deps.anthropic);
}
