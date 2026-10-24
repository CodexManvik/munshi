import { useState, type ReactNode } from 'react';
import { api } from './api.ts';
import { Nav } from './ui.tsx';

type Entry = { at: string; action: string; text: string; fail: boolean };

export function Control() {
  const [log, setLog] = useState<Entry[]>([]);
  const [walkin, setWalkin] = useState(120);
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (action: string, body: unknown = {}) => {
    if (action === 'reset' && !confirm('Demo reset karein? Saara data dobara seed hoga aur Soundbox wapas shuru se khulega.')) return;
    setBusy(action);
    const at = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    try {
      const r: any = await api.control(action, body);
      setLog(l => [{ at, action, text: r?.line ?? JSON.stringify(r), fail: false }, ...l].slice(0, 8));
    } catch (e: any) {
      setLog(l => [{ at, action, text: e.message, fail: true }, ...l].slice(0, 8));
    } finally {
      setBusy(null);
    }
  };

  const row = (title: string, desc: string, action: string, label: string, body?: () => unknown, extra?: ReactNode) => (
    <div className="control">
      <div><h2>{title}</h2><p>{desc}</p></div>
      <div className="inline">
        {extra}
        <button className="btn btn-plain" disabled={busy !== null} onClick={() => run(action, body?.())}>{busy === action ? '…' : label}</button>
      </div>
    </div>
  );

  return (
    <div className="shell">
      <Nav current="control" />
      <div className="wrap">
        <h2 className="section-title">Finale ke beats</h2>
        {row('Dukaan khuli', 'Soundbox subah ka brief bolega (udhaar, mohalle ki demand).', 'brief', 'Brief')}
        {row('Shelf photo', 'Demo photo: Surf khatam, Parle-G kam. Group order ka prastaav aayega.', 'shelf', 'Bhejo')}
        {row('Munshi, aur kuch?', 'Agla bada kaam: pehle loan, phir win-back offer.', 'nudge', 'Poochho')}
        {row('Pakka grahak aaya', 'Ek regular ki 10vi khareed: loyalty inaam bajega.', 'regular', 'Bhejo')}
        {row('Purana grahak lauta', 'Win-back offer ke baad ek grahak lautta hai.', 'returning', 'Bhejo')}

        <h2 className="section-title">Demo</h2>
        {row('Walk-in grahak', 'Counter par ek UPI payment aata hai.', 'walkin', 'Bhejo', () => ({ amount: walkin }),
          <label><span className="sr-only">Raashi (₹)</span><input type="number" min={1} value={walkin} onChange={e => setWalkin(Number(e.target.value))} /></label>)}
        {row('Ghadi aage', 'Demo ki ghadi aage badhao.', 'advance', 'Aage', () => ({ minutes }),
          <label><span className="sr-only">Minute</span><select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
            {[10, 60, 1440].map(m => <option key={m} value={m}>{m === 1440 ? '1 din' : `${m} min`}</option>)}
          </select></label>)}
        {row('Demo reset', 'Saara data dobara seed, ghadi wapas abhi par.', 'reset', 'Reset')}

        <h2 className="section-title">Log</h2>
        <ul className="log" aria-live="polite">
          {log.length === 0 && <li><span className="num">—</span><span>Abhi kuch nahi chalaya.</span></li>}
          {log.map((e, k) => (
            <li key={k} data-fail={e.fail}><span className="num">{e.at}</span><span><b>{e.action}</b> · {e.text}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
