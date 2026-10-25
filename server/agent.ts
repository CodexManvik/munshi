import type { DB } from './db.ts';
import type { ActionResult, Deps } from './actions.ts';
import { confirmOpportunity, declineOpportunity, getProposed } from './opportunities.ts';
import { MODEL, withTimeout } from './phrase.ts';
import { toolDefs, runTool } from './tools.ts';
import { DECLINED, NOT_UNDERSTOOD } from './lines.ts';

// A reply is yes (or no) when every word is a yes-word or a polite filler and at least one
// is a real yes. "हाँ भेज दो", "ok ji", "mat bhejo" all count; "haan par kal" goes to Claude.
const words = (s: string) => new Set(s.split(' '));
const YES_CORE = words('haan haa han ha hanji haanji yes ok okay theek thik zaroor bhej bhejo kar karo हाँ हां हा ओके ठीक ज़रूर जरूर भेज भेजो कर करो');
const YES_FILLER = words('ji जी do दो de दे dijiye दीजिए hai है please');
const NO_CORE = words('nahi nahin na no mat nako rehne नहीं नही ना मत रहने');
const NO_FILLER = words('ji जी chahiye चाहिए abhi अभी do दो bhej bhejo kar karo भेज भेजो कर करो hai है');

const allOf = (tokens: string[], core: Set<string>, filler: Set<string>) =>
  tokens.some(t => core.has(t)) && tokens.every(t => core.has(t) || filler.has(t));

export { DECLINED, NOT_UNDERSTOOD };
const SYSTEM = 'Aap Munshi hain, Ramesh Kirana ke AI business partner. Hamesha Hinglish (Roman script) mein 1-2 chhote vaakya bolein. Tools se hi data lein, kabhi andaaza na lagayein. Aap koi kaam khud nahi karte: kaam ke liye tool sirf prastaav banata hai, aur dukaandaar ke "haan" kehne par hi kaam hota hai. Kabhi mat kahiye ki kaam ho gaya.';

export function classifyReply(text: string): 'yes' | 'no' | 'other' {
  const tokens = text.normalize('NFC').toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean);
  // A trailing "na" after other words is a softener ("bhej do na" = please send), not a no.
  if (tokens.length > 1 && ['na', 'ना'].includes(tokens[tokens.length - 1])) tokens.pop();
  if (!tokens.length) return 'other';
  if (allOf(tokens, NO_CORE, NO_FILLER)) return 'no';
  return allOf(tokens, YES_CORE, YES_FILLER) ? 'yes' : 'other';
}

type Reply = ActionResult & { opportunityId?: number };

export async function converse(db: DB, merchantId: string, text: string, at: Date, deps: Deps): Promise<Reply> {
  const intent = classifyReply(text);
  const proposed = getProposed(db, merchantId);
  if (proposed && intent === 'yes') return { ...(await confirmOpportunity(db, proposed.id, deps, at)), opportunityId: proposed.id };
  if (proposed && intent === 'no') { declineOpportunity(db, proposed.id); return { line: DECLINED, opportunityId: proposed.id }; }
  if (!deps.anthropic) return { line: NOT_UNDERSTOOD };
  try {
    return await withTimeout(runAgent(db, merchantId, text, at, deps), 12_000);
  } catch {
    return { line: NOT_UNDERSTOOD };
  }
}

// Manual tool loop. Tools can only read or propose; execution needs a later "haan".
async function runAgent(db: DB, merchantId: string, text: string, at: Date, deps: Deps): Promise<Reply> {
  const messages: any[] = [{ role: 'user', content: text }];
  let opportunityId: number | undefined;
  for (let round = 0; round < 4; round++) {
    const res = await deps.anthropic!.messages.create({
      model: MODEL, max_tokens: 2000, output_config: { effort: 'low' },
      system: SYSTEM, tools: toolDefs, messages,
    });
    if (res.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: res.content });
      const results = res.content.filter((b: any) => b.type === 'tool_use').map((b: any) => {
        const out: any = runTool(db, merchantId, at, b.name, b.input);
        if (out?.status === 'needs_confirmation') opportunityId = out.opportunityId;
        return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) };
      });
      messages.push({ role: 'user', content: results });
      continue;
    }
    const line = (res.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ').trim();
    if (res.stop_reason === 'refusal' || !line) return { line: NOT_UNDERSTOOD };
    return { line, opportunityId };
  }
  return { line: NOT_UNDERSTOOD };
}
