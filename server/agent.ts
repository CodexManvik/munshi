import type { DB } from './db.ts';
import type { ActionResult, Deps } from './actions.ts';
import { confirmOpportunity, declineOpportunity, getProposed } from './opportunities.ts';
import { MODEL, withTimeout } from './phrase.ts';
import { toolDefs, runTool } from './tools.ts';

const YES = /^(haan|haa|han|ha|hanji|haanji|ji haan|yes|ok|okay|theek hai|thik hai|kar do|bhej do|हाँ|हां|हा|जी हाँ|जी हां|ठीक है|भेज दो|कर दो)(\s+ji|\s+जी)?[.!।]*$/i;
const NO = /^(nahi|nahin|na|no|mat|rehne do|नहीं|नही|ना|मत|रहने दो)(\s+ji|\s+जी)?[.!।]*$/i;

export const DECLINED = 'Theek hai, rehne dete hain.';
export const NOT_UNDERSTOOD = 'Maaf kijiye, samajh nahi aaya. Haan ya Nahi dabaiye.';
const SYSTEM = 'Aap Munshi hain, Ramesh Kirana ke AI business partner. Hamesha Hinglish (Roman script) mein 1-2 chhote vaakya bolein. Tools se hi data lein, kabhi andaaza na lagayein. Aap koi kaam khud nahi karte: kaam ke liye tool sirf prastaav banata hai, aur dukaandaar ke "haan" kehne par hi kaam hota hai. Kabhi mat kahiye ki kaam ho gaya.';

export function classifyReply(text: string): 'yes' | 'no' | 'other' {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  return YES.test(t) ? 'yes' : NO.test(t) ? 'no' : 'other';
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
