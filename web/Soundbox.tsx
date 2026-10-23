import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api, onEvents, type ActionResult } from './api.ts';
import { speak, listen, canListen } from './speech.ts';
import { Caption, Clock, Meter, Wordmark, MicIcon, CheckIcon, CrossIcon, CoinIcon, type Tone } from './ui.tsx';

type Answer = { kind: 'yes' } | { kind: 'no' } | { kind: 'text'; text: string };
const OOPS = 'Kuch gadbad hui. Dobara koshish kijiye.';

export function Soundbox() {
  const [started, setStarted] = useState(false);
  const [caption, setCaption] = useState({ text: 'Namaste! Munshi taiyaar hai.', tone: 'info' as Tone, n: 0 });
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [talking, setTalking] = useState(false);
  const [listening, setListening] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [band, setBand] = useState<{ text: string; n: number } | null>(null);
  const [live, setLive] = useState(false);
  const [heard, setHeard] = useState('');
  const answerRef = useRef<((a: Answer) => void) | null>(null);
  const runningRef = useRef(false);

  const say = useCallback(async (text: string, tone: Tone) => {
    setCaption(c => ({ text, tone, n: c.n + 1 }));
    setTalking(true);
    await speak(text);
    setTalking(false);
  }, []);

  // Ask one proposal (speaking it unless already spoken), wait for the merchant, act on the answer.
  const resolveProposal = useCallback(async (id: number, line: string | null) => {
    setPayUrl(null);
    // Accept an answer while the question is still being spoken: shopkeepers answer early.
    const answered = new Promise<Answer>(res => { answerRef.current = res; });
    setPending(id);
    if (line) void say(line, 'ask');
    const answer = await answered;
    answerRef.current = null;
    setPending(null);
    setBusy(true);
    let r: ActionResult;
    let tone: Tone = answer.kind === 'no' ? 'decline' : 'info';
    try {
      r = answer.kind === 'yes' ? await api.confirm(id) : answer.kind === 'no' ? await api.decline(id) : await api.converse(answer.text);
    } catch {
      r = { line: OOPS };
      tone = 'decline';
    }
    setBusy(false);
    if (r.payUrl) setPayUrl(r.payUrl);
    await say(r.line, tone);
    if (answer.kind === 'text' && r.opportunityId && r.opportunityId !== id && !r.payUrl) await resolveProposal(r.opportunityId, null);
  }, [say]);

  const runSession = useCallback(async (greet: boolean) => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      if (greet) await say('Suprabhat Ramesh ji! Aaj ke kaam sunaata hoon.', 'info');
      let handled = 0;
      while (handled < 3) {
        const next = await api.next();
        if (!next.id) break;
        await resolveProposal(next.id, next.line ?? '');
        handled++;
      }
      if (greet) await say(handled ? 'Bas itna hi. Aapka din shubh ho!' : 'Aaj koi naya kaam nahi. Aapka din shubh ho!', 'info');
    } catch {
      await say(OOPS, 'decline');
    } finally {
      runningRef.current = false;
    }
  }, [say, resolveProposal]);

  const answer = (a: Answer) => answerRef.current?.(a);

  const onMic = async () => {
    if (listening) return;
    setListening(true);
    setHeard('');
    const text = (await listen()).trim();
    setListening(false);
    if (!text) { setHeard('Sunaai nahi diya. Haan ya Nahi dabaiye.'); return; }
    setHeard(text);
    if (answerRef.current) return answer({ kind: 'text', text });
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      setBusy(true);
      const r = await api.converse(text).catch(() => ({ line: OOPS }) as ActionResult);
      setBusy(false);
      if (r.payUrl) setPayUrl(r.payUrl);
      await say(r.line, 'info');
      if (r.opportunityId && !r.payUrl) await resolveProposal(r.opportunityId, null);
    } finally {
      runningRef.current = false;
    }
  };

  useEffect(() => {
    if (!payUrl) { setQr(null); return; }
    QRCode.toDataURL(payUrl, { margin: 1, width: 360, color: { dark: '#141d5c', light: '#ffffff' } }).then(setQr);
  }, [payUrl]);

  useEffect(() => {
    if (!started) return;
    const off = onEvents(e => {
      if (e.type === 'announce') {
        setBand(b => ({ text: e.text, n: (b?.n ?? 0) + 1 }));
        void speak(e.text);
      }
      if (e.type === 'brief') void runSession(true);
    }, setLive);
    // Speak up on its own only when the shop is quiet; the server decides what quiet means.
    const idle = setInterval(async () => {
      if (runningRef.current) return;
      const next = await api.next(true).catch(() => null);
      if (!next?.id || runningRef.current) return;
      runningRef.current = true;
      try { await resolveProposal(next.id, next.line ?? ''); } finally { runningRef.current = false; }
    }, 60_000);
    return () => { off(); clearInterval(idle); };
  }, [started, runSession, resolveProposal]);

  useEffect(() => {
    if (!band) return;
    const t = setTimeout(() => setBand(null), 6500);
    return () => clearTimeout(t);
  }, [band]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!answerRef.current || e.target instanceof HTMLInputElement) return;
      if (e.key === 'h' || e.key === 'H') answer({ kind: 'yes' });
      if (e.key === 'n' || e.key === 'N') answer({ kind: 'no' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!started) {
    return (
      <main className="gate">
        <div className="gate-mark">
          <h1>Munshi<span aria-hidden="true" /></h1>
          <p>Ramesh Kirana ka AI business partner. Paise ka kaam bataata hai, aapki haan par karta hai.</p>
        </div>
        <div className="gate-cta">
          <button className="btn btn-ask btn-wide" autoFocus onClick={() => { setStarted(true); void runSession(true); }}>
            Dukaan kholo
          </button>
          <small>Tap karte hi Munshi bolna shuru karega.</small>
        </div>
      </main>
    );
  }

  const status = listening ? 'Sun raha hoon…' : busy ? 'Kaam ho raha hai…' : talking ? 'Munshi bol raha hai' : pending ? 'Aapke jawaab ka intezaar' : 'Taiyaar';

  return (
    <div className="soundbox">
      <header className="bar">
        <Wordmark />
        <span className="spacer" />
        <span className="live" data-on={live}><i />{live ? 'Live' : 'Offline'}</span>
        <Clock />
      </header>

      <main className="stage">
        <div className="stage-head"><Meter on={talking} /><span>{status}</span></div>

        <div className="stage-body">
          <Caption key={caption.n} text={caption.text} tone={caption.tone} run step={talking ? 300 : 70} />
          <div className="heard" aria-live="polite">{heard && (heard.startsWith('Sunaai') ? heard : <>Aapne kaha: <q>{heard}</q></>)}</div>
        </div>

        <div>
          {qr && !pending ? (
            <div className="qr">
              <img src={qr} alt="Bhugtaan ka QR code" />
              <div>
                <strong>Scan karke chukayein</strong>
                <a href={payUrl!} target="_blank" rel="noreferrer">{payUrl}</a>
              </div>
            </div>
          ) : (
            <div className="answers">
              <button className="btn btn-ask" disabled={!pending} onClick={() => answer({ kind: 'yes' })}><CheckIcon />Haan</button>
              <button className="btn btn-ghost" disabled={!pending} onClick={() => answer({ kind: 'no' })}><CrossIcon />Nahi</button>
            </div>
          )}
          <div className="mic-row">
            <button className="mic" data-on={listening} disabled={!canListen() || busy} onClick={onMic} aria-label="Bolkar jawaab dijiye">
              <MicIcon />
            </button>
            <span>{canListen() ? 'Bolkar poochhiye' : 'Is browser mein mic nahi'}</span>
          </div>
        </div>
      </main>

      {band && (
        <div className="band" key={band.n} role="status"><CoinIcon />{band.text}</div>
      )}
    </div>
  );
}
