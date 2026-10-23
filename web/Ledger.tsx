import { useCallback, useEffect, useState } from 'react';
import { api, onEvents, rupees, type Ledger as LedgerData } from './api.ts';
import { Nav } from './ui.tsx';

const TOOL_LABEL: Record<string, string> = { send_udhaar_reminder: 'Udhaar reminder' };
const when = (ts: string) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export function Ledger() {
  const [data, setData] = useState<LedgerData | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => api.ledger().then(d => { setData(d); setFailed(false); }).catch(() => setFailed(true)), []);

  useEffect(() => {
    void load();
    return onEvents(e => { if (e.type === 'ledger') void load(); });
  }, [load]);

  return (
    <div className="paper">
      <Nav current="ledger" />
      <div className="masthead" data-tone="money">
        <div className="wrap">
          <h1>Is hafte Munshi ne aapko dilaye</h1>
          <span className="big-amt num">{data ? rupees(data.total) : '₹—'}</span>
          <p>Har rupaya us kaam se juda hai jisse woh aaya.</p>
        </div>
      </div>
      <div className="wrap">
        <h2 className="section-title">Hisaab</h2>
        {failed && <p className="empty">Hisaab load nahi hua. Server chal raha hai? Page dobara kholiye.</p>}
        {data && data.items.length === 0 && <p className="empty">Abhi tak kuch nahi. Soundbox par pehla “Haan” boliye.</p>}
        {data && data.items.length > 0 && (
          <ul className="ledger-list">
            {data.items.map((item, k) => (
              <li key={`${item.ts}-${k}`}>
                <span className="label">{item.label}</span>
                <span className="amt num">+{rupees(item.amount)}</span>
                <span className="meta"><span className="num">{when(item.ts)}</span>{item.tool && <span className="tag">{TOOL_LABEL[item.tool] ?? item.tool}</span>}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
