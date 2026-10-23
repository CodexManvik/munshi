import type { AnthropicLike } from './actions.ts';
import type { OppRow } from './opportunities.ts';
import { stockTemplate, groupTemplate } from './inventory.ts';

export const MODEL = process.env.MUNSHI_MODEL ?? 'claude-opus-5-5';

const templates: Record<string, (p: any) => string> = {
  udhaar_overdue: p => `${p.customerName} ka ₹${p.amount} udhaar ${p.days} din se baaki hai. Reminder bhej doon?`,
  stock_low: stockTemplate,
  group_buy_open: groupTemplate,
};

export const template = (opp: OppRow): string => templates[opp.type](opp.payload);

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); }),
  ]).finally(() => clearTimeout(timer));
}

const REWRITE = 'Aap ek kirana dukaan ke Soundbox ki awaaz hain. Diye gaye vaakya ko garamjoshi bhare 1-2 chhote Hinglish (Roman script) vaakyon mein dobara likhiye. Har naam, sankhya aur ₹ raashi bilkul wahi rakhiye, aur aakhri sawaal bhi. Sirf vaakya likhiye, aur kuch nahi.';
const cache = new Map<string, string>();

// Claude rewording with a hard 4s ceiling; the template is always a safe answer.
export async function phrase(opp: OppRow, anthropic?: AnthropicLike): Promise<string> {
  const base = template(opp);
  if (cache.has(base)) return cache.get(base)!;
  if (!anthropic) return base;
  try {
    const res = await withTimeout(anthropic.messages.create({
      model: MODEL, max_tokens: 1000, output_config: { effort: 'low' },
      system: REWRITE, messages: [{ role: 'user', content: base }],
    }), 4000);
    const line = (res.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ').trim();
    const keepsNumbers = (base.match(/\d+/g) ?? []).every(n => line.includes(n));
    if (res.stop_reason === 'refusal' || !line || !keepsNumbers) return base;
    cache.set(base, line);
    return line;
  } catch {
    return base;
  }
}
