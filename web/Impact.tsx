import { useCallback, useEffect, useState } from 'react';
import { api, onEvents, rupees, type Impact as ImpactData } from './api.ts';
import { Nav } from './ui.tsx';

const SCALES = [1, 1_000, 1_00_000, 10_00_000];
const count = (n: number) => n.toLocaleString('en-IN');

export function Impact() {
  const [n, setN] = useState(1_00_000);
  const [data, setData] = useState<ImpactData | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => api.impact(n).then(d => { setData(d); setFailed(false); }).catch(() => setFailed(true)), [n]);

  useEffect(() => {
    void load();
    return onEvents(e => { if (e.type === 'ledger') void load(); });
  }, [load]);

  const w = data?.week;
  const rows: Array<[string, number | undefined, 'money' | 'count']> = [
    ['Udhaar recovered', w?.recovered, 'money'],
    ['Group-buy savings', w?.groupSavings, 'money'],
    ['Win-back sales', w?.winbackSales, 'money'],
    ['Merchant loans disbursed', w?.loanGmv, 'money'],
    ['Customers reached in the Paytm app', w?.offersDelivered, 'count'],
    ['Actions approved by the merchant', w?.actions, 'count'],
  ];
  const fmt = (v: number, kind: 'money' | 'count') => (kind === 'money' ? rupees(v) : count(v));

  return (
    <div className="shell">
      <Nav current="paytm" />
      <div className="masthead">
        <div className="wrap">
          <h1>If {count(n)} {n === 1 ? 'merchant' : 'merchants'} had Ramesh Kirana’s week with Munshi</h1>
          <span className="big-amt num">{data ? rupees(data.projected.weeklyIncome) : '₹—'}</span>
          <p>Extra money in merchants’ hands per week: udhaar recovered, group savings and win-back sales.</p>
          <div className="picker" role="group" aria-label="Number of merchants">
            {SCALES.map(s => <button key={s} aria-pressed={s === n} onClick={() => setN(s)}>{count(s)}</button>)}
          </div>
        </div>
      </div>
      <div className="wrap">
        {failed && <p className="empty">Impact could not load. Is the server running?</p>}
        <div className="impact-head"><span>This week</span><span>Ramesh Kirana</span><span>× {count(n)}</span></div>
        <ul className="rows impact">
          {rows.map(([label, v, kind]) => (
            <li key={label}>
              <span className="label">{label}</span>
              <span className="here num">{v === undefined ? '—' : fmt(v, kind)}</span>
              <span className={`amt num${kind === 'count' ? ' plain' : ''}`}>{v === undefined ? '—' : fmt(v * n, kind)}</span>
            </li>
          ))}
        </ul>
        <p className="footnote">A projection of this demo’s synthetic week multiplied by the merchant count. It is not a forecast and uses no real Paytm data.</p>
      </div>
    </div>
  );
}
