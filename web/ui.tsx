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
export const InfoIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6v.4" /></>);
export const CoinIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M9 8h6M9 11h6M9 8c4 0 4 6 0 6l5 3" /></>);

export function Wordmark() {
  return (
    <span className="wordmark">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="15" width="20" height="5" rx="1.5" fill="var(--saffron)" />
        <path d="M6 5v7M10 3v9M14 6v6M18 4v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      Munshi
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

export function Nav({ current }: { current: 'soundbox' | 'ledger' | 'control' }) {
  const links = [['soundbox', 'Soundbox'], ['ledger', 'Hisaab'], ['control', 'Control']] as const;
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
export function Caption({ text, tone, run, step = 300 }: { text: string; tone: Tone; run: boolean; step?: number }) {
  const words = text.split(/(\s+)/).filter(Boolean);
  let i = 0;
  return (
    <div className="caption" data-tone={tone} data-run={run} style={{ ['--step' as any]: `${step}ms` }} aria-live="polite">
      <div className="caption-rule" />
      <p className="caption-strip" style={{ margin: 0 }}>
        {words.map((w, k) => /^\s+$/.test(w)
          ? <span key={k}>{w}</span>
          : <span key={k} className={`word${/₹[\d,]+/.test(w) ? ' amt num' : ''}`} style={{ ['--i' as any]: i++ }}>{w}</span>)}
      </p>
    </div>
  );
}
