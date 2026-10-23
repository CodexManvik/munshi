export type ActionResult = { line: string; payUrl?: string; opportunityId?: number };
export type Next = { id: number | null; type?: string; line?: string };
export type PayLink = { ref: string; merchantName: string; customerName: string; amount: number; status: 'pending' | 'paid' };
export type Ledger = { total: number; items: Array<{ kind: string; amount: number; label: string; ts: string; tool: string }> };
export type SoundboxEvent = { type: 'announce'; text: string } | { type: 'brief' } | { type: 'ledger' };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText);
  return data as T;
}

export const api = {
  next: (interrupt = false) => call<Next>('POST', '/api/next', { interrupt }),
  confirm: (id: number) => call<ActionResult>('POST', `/api/opportunities/${id}/confirm`, {}),
  decline: (id: number) => call<ActionResult>('POST', `/api/opportunities/${id}/decline`, {}),
  converse: (text: string) => call<ActionResult>('POST', '/api/converse', { text }),
  getPay: (ref: string) => call<PayLink>('GET', `/api/pay/${ref}`),
  pay: (ref: string) => call<{ alreadyPaid: boolean }>('POST', `/api/pay/${ref}`, {}),
  ledger: () => call<Ledger>('GET', '/api/ledger'),
  control: (action: string, body: unknown = {}) => call<unknown>('POST', `/api/control/${action}`, body),
};

// EventSource reconnects on its own; onStatus reports whether the stream is live.
export function onEvents(fn: (e: SoundboxEvent) => void, onStatus?: (live: boolean) => void): () => void {
  const es = new EventSource('/api/events');
  es.onmessage = m => fn(JSON.parse(m.data));
  es.onopen = () => onStatus?.(true);
  es.onerror = () => onStatus?.(false);
  return () => es.close();
}

export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
