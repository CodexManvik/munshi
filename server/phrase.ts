import type { AnthropicLike } from './actions.ts';
import type { OppRow } from './opportunities.ts';
import { stockTemplate, groupTemplate, spikeTemplate } from './inventory.ts';
import { lapsedTemplate } from './customers.ts';
import { creditTemplate } from './credit.ts';
import { spokenFor } from './spoken.ts';

export const MODEL = process.env.MUNSHI_MODEL ?? 'claude-opus-5-5';

const templates: Record<string, (p: any) => string> = {
  udhaar_overdue: p => `${p.customerName} ka ₹${p.amount} udhaar ${p.days} din se baaki hai. Reminder bhej doon?`,
  stock_low: stockTemplate,
  group_buy_open: groupTemplate,
  local_demand_spike: spikeTemplate,
  lapsed_regulars: lapsedTemplate,
  cash_gap: creditTemplate,
};

export const template = (opp: OppRow): string => templates[opp.type](opp.payload);

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); }),
  ]).finally(() => clearTimeout(timer));
}

const REWRITE = 'Aap ek kirana dukaan ke Soundbox ki awaaz hain. Diye gaye vaakya ko garamjoshi bhare 1-2 chhote Hinglish (Roman script) vaakyon mein dobara likhiye. Har naam, sankhya aur ₹ raashi bilkul wahi rakhiye, aur aakhri sawaal bhi. Pehli line mein Roman script waala vaakya likhiye. Doosri line mein wahi vaakya Devanagari lipi mein likhiye: sankhyayein aur ₹ ankon mein hi rahein, aur naam Roman mein. Sirf ye do lines, aur kuch nahi.';

export type Phrased = { line: string; spoken: string };
const cache = new Map<string, Phrased>();
const numbers = (s: string) => s.match(/\d+/g) ?? [];
const DEVANAGARI = /[ऀ-ॿ]/;

// Claude rewording with a hard 4s ceiling; the templates are always a safe answer.
export async function phraseFull(opp: OppRow, anthropic?: AnthropicLike): Promise<Phrased> {
  const base = template(opp);
  const fallback = { line: base, spoken: spokenFor(opp) };
  if (cache.has(base)) return cache.get(base)!;
  if (!anthropic) return fallback;
  try {
    const res = await withTimeout(anthropic.messages.create({
      model: MODEL, max_tokens: 1000, output_config: { effort: 'low' },
      system: REWRITE, messages: [{ role: 'user', content: base }],
    }), 4000);
    const text = (res.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    const [line = '', dev = ''] = text.split('\n').map((s: string) => s.trim()).filter(Boolean);
    const keeps = (s: string) => numbers(base).every(n => s.includes(n));
    if (res.stop_reason === 'refusal' || !line || DEVANAGARI.test(line) || !keeps(line)) return fallback;
    const out = { line, spoken: DEVANAGARI.test(dev) && keeps(dev) ? dev : fallback.spoken };
    cache.set(base, out);
    return out;
  } catch {
    return fallback;
  }
}

export async function phrase(opp: OppRow, anthropic?: AnthropicLike): Promise<string> {
  return (await phraseFull(opp, anthropic)).line;
}
