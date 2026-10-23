import { useEffect, useState } from 'react';
import { api, rupees, type PayLink } from './api.ts';
import { CheckIcon, CrossIcon, InfoIcon } from './ui.tsx';

type State = 'loading' | 'ready' | 'paying' | 'paid' | 'already' | 'unknown' | 'error';

export function Pay({ refId }: { refId: string }) {
  const [link, setLink] = useState<PayLink | null>(null);
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    api.getPay(refId)
      .then(l => { setLink(l); setState(l.status === 'paid' ? 'already' : 'ready'); })
      .catch(e => setState(e.status === 404 ? 'unknown' : 'error'));
  }, [refId]);

  const pay = async () => {
    setState('paying');
    try {
      const r = await api.pay(refId);
      setState(r.alreadyPaid ? 'already' : 'paid');
    } catch {
      setState('error');
    }
  };

  if (state === 'unknown') {
    return (
      <main className="paper">
        <div className="masthead"><div className="wrap"><h1>Bhugtaan link</h1></div></div>
        <div className="wrap pay-body">
          <div className="status" data-tone="decline"><CrossIcon /><div><h2>Link galat hai.</h2><p>Yeh link kisi bhugtaan se nahi juda. Dukaandaar se naya link maangiye.</p></div></div>
        </div>
      </main>
    );
  }

  const done = state === 'paid' || state === 'already';
  return (
    <main className="paper">
      <div className="masthead" data-tone={done ? 'money' : undefined}>
        <div className="wrap">
          <h1>{link?.merchantName ?? 'Load ho raha hai…'}</h1>
          <p>{link ? (done ? `${link.customerName}, aapka udhaar chuk gaya` : `${link.customerName}, aapka baaki udhaar`) : ' '}</p>
          <span className="big-amt num" aria-label={link ? rupees(link.amount) : undefined}>{link ? rupees(link.amount) : '₹—'}</span>
        </div>
      </div>

      <div className="wrap pay-body">
        {state === 'paid' && (
          <div className="status" data-tone="money"><CheckIcon /><div><h2>Payment safal!</h2><p>{link && `${rupees(link.amount)} ${link.merchantName} ko pahunch gaye. Dhanyavaad!`}</p></div></div>
        )}
        {state === 'already' && (
          <div className="status" data-tone="info"><InfoIcon /><div><h2>Yeh bhugtaan pehle hi ho chuka hai.</h2><p>Aapko dobara kuch nahi dena.</p></div></div>
        )}
        {state === 'error' && (
          <div className="status" data-tone="decline"><CrossIcon /><div><h2>Bhugtaan nahi hua.</h2><p>Network check karke dobara koshish kijiye. Paise nahi kate.</p></div></div>
        )}
        {!done && (
          <>
            <dl className="facts">
              <dt>Kisko</dt><dd>{link?.merchantName ?? '—'}</dd>
              <dt>Kiske liye</dt><dd>Udhaar wapas</dd>
            </dl>
            <button className="btn btn-ask btn-wide" disabled={!link || state === 'paying'} onClick={pay}>
              {state === 'paying' ? 'Ho raha hai…' : link ? `Pay ${rupees(link.amount)}` : 'Pay'}
            </button>
          </>
        )}
        <p className="fine">Demo payment — koi asli paisa nahi katega.</p>
      </div>
    </main>
  );
}
