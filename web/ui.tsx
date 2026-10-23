import { useEffect, useState, type ReactNode } from 'react';

const icon = (path: ReactNode) => (props: { title?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden={props.title ? undefined : true} role={props.title ? 'img' : undefined}>
    {props.title && <title>{props.title}</title>}
    {path}
  </svg>
);

export const MicIcon = icon(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>);
export const CheckIcon = icon(<path d="M4.5 12.5l5 5L19.5 7" />);
export const CrossIcon = icon(<path d="M6 6l12 12M18 6L6 18" />);
export const CameraIcon = icon(<><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="13" r="3.5" /></>);
export const InfoIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6v.4" /></>);
export const CoinIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M9 8h6M9 11h6M9 8c4 0 4 6 0 6l5 3" /></>);

export function Wordmark() {
  return (
    <span className="wordmark">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="15" width="20" height="5" rx="1.5" fill="var(--saffron)" />
        <path d="M6 5v7M10 3v9M14 6v6M18 4v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span>Munshi</span>
    </span>
  );
}

export function Meter({ on }: { on: boolean }) {
  return <span className="meter" data-on={on} aria-hidden="true"><b /><b /><b /><b /></span>;
}

export function Clock() {
  const fmt = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const [t, setT] = useState(fmt);
  useEffect(() => { const id = setInterval(() => setT(fmt()), 20_000); return () => clearInterval(id); }, []);
  return <span className="clock num">{t}</span>;
}

export function TestCard() {
  return <span className="bars" aria-hidden="true"><i /><i /><i /><i /></span>;
}

export function Nav({ current }: { current: 'soundbox' | 'ledger' | 'control' | 'paytm' }) {
  const links = [['soundbox', 'Soundbox'], ['ledger', 'Hisaab'], ['paytm', 'Impact'], ['control', 'Control']] as const;
  return (
    <header className="bar">
      <Wordmark />
      <span className="spacer" />
      <nav className="nav" aria-label="Munshi screens">
        {links.map(([id, label]) => <a key={id} href={`/${id}`} aria-current={id === current ? 'page' : undefined}>{label}</a>)}
      </nav>
    </header>
  );
}

export type Tone = 'ask' | 'info' | 'money' | 'decline';

// Signature move: each spoken line enters word by word, like a bulletin caption keeping pace with the voice.
// The first rupee figure in a line is set monumental; later ones stay inline and bold.
export function Caption({ text, tone, run, step = 300 }: { text: string; tone: Tone; run: boolean; step?: number }) {
  const words = text.split(/(\s+)/).filter(Boolean);
  let i = 0;
  let bigUsed = false;
  return (
    <div className="caption" data-tone={tone} data-run={run} style={{ ['--step' as any]: `${step}ms` }} aria-live="polite">
      <p className="caption-strip">
        {words.map((w, k) => {
          if (/^\s+$/.test(w)) return <span key={k}>{w}</span>;
          // "₹924." : the figure is styled, its trailing punctuation rides inside at text size
          // (a separate span would drop onto its own line under a block-level amount).
          const parts = w.split(/(₹[\d,]*\d[.,!?]*)/).filter(Boolean);
          return parts.map((part, j) => {
            const m = part.match(/^(₹[\d,]*\d)([.,!?]*)$/);
            const big = !!m && !bigUsed;
            if (big) bigUsed = true;
            return (
              <span key={`${k}-${j}`} className={`word${m ? ' amt num' : ''}${big ? ' big' : ''}`} style={{ ['--i' as any]: i++ }}>
                {m ? <>{m[1]}{m[2] && <span className="amt-tail">{m[2]}</span>}</> : part}
              </span>
            );
          });
        })}
      </p>
    </div>
  );
}
