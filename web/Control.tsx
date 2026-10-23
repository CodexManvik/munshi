import { useState, type ReactNode } from 'react';
import { api } from './api.ts';
import { Nav } from './ui.tsx';

export function Control() {
  const [log, setLog] = useState('Taiyaar.');
  const [walkin, setWalkin] = useState(120);
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (action: string, body: unknown = {}) => {
    setBusy(action);
    try {
      const r = await api.control(action, body);
      setLog(`${new Date().toLocaleTimeString('en-IN')}  ${action}  ${JSON.stringify(r)}`);
    } catch (e: any) {
      setLog(`${action} fail hua: ${e.message}`);
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
    <div className="paper">
      <Nav current="control" />
      <div className="wrap">
        <div className="controls">
          {row('Demo reset', 'Saara data dobara seed, ghadi wapas abhi par.', 'reset', 'Reset')}
          {row('Dukaan khuli', 'Soundbox subah ka brief bolega.', 'brief', 'Brief')}
          {row('Walk-in grahak', 'Counter par ek UPI payment aata hai.', 'walkin', 'Bhejo', () => ({ amount: walkin }),
            <label><span className="sr-only">Raashi (₹)</span><input type="number" min={1} value={walkin} onChange={e => setWalkin(Number(e.target.value))} /></label>)}
          {row('Ghadi aage', 'Demo ki ghadi aage badhao.', 'advance', 'Aage', () => ({ minutes }),
            <label><span className="sr-only">Minute</span><select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
              {[10, 60, 1440].map(m => <option key={m} value={m}>{m === 1440 ? '1 din' : `${m} min`}</option>)}
            </select></label>)}
        </div>
        <pre className="log" aria-live="polite">{log}</pre>
      </div>
    </div>
  );
}
