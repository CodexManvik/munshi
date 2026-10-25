import type { ServerResponse } from 'node:http';

export type Display = { who: string; amount: number; rest: string };
export type Offer = { id: number; line: string; spoken?: string; display?: Display };

export type SoundboxEvent =
  | { type: 'announce'; text: string; spoken?: string }
  | { type: 'brief' }
  | { type: 'nudge' }
  | { type: 'ledger' }
  | { type: 'paid'; ref: string; name?: string; amount?: number }
  | { type: 'reset' }
  | { type: 'shelf'; line: string; spoken?: string; next: Offer | null };

const listeners = new Set<(e: SoundboxEvent) => void>();

export function onEvent(fn: (e: SoundboxEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function publish(e: SoundboxEvent): void {
  for (const fn of listeners) fn(e);
}

export function subscribe(res: ServerResponse): void {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  res.write(': connected\n\n');
  const off = onEvent(e => res.write(`data: ${JSON.stringify(e)}\n\n`));
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000); // keeps tunnels from closing idle streams
  res.on('close', () => { off(); clearInterval(ping); });
}
