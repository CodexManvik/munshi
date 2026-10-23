export type SendWhatsApp = (to: string, text: string) => Promise<{ sent: boolean; error?: string }>;

export type FetchMedia = (mediaId: string) => Promise<{ data: string; mediaType: string } | null>;

// Inbound photos arrive as media ids: resolve the id to a URL, then download with the same token.
export function makeFetchWhatsAppMedia(env: { WA_TOKEN?: string; WA_GRAPH_VERSION?: string }): FetchMedia {
  const { WA_TOKEN, WA_GRAPH_VERSION = 'v23.0' } = env;
  return async mediaId => {
    if (!WA_TOKEN) return null;
    const auth = { authorization: `Bearer ${WA_TOKEN}` };
    try {
      const meta = await fetch(`https://graph.facebook.com/${WA_GRAPH_VERSION}/${mediaId}`, { headers: auth, signal: AbortSignal.timeout(8000) });
      if (!meta.ok) return null;
      const { url, mime_type } = await meta.json() as any;
      const file = await fetch(url, { headers: auth, signal: AbortSignal.timeout(15000) });
      if (!file.ok) return null;
      return { data: Buffer.from(await file.arrayBuffer()).toString('base64'), mediaType: mime_type ?? 'image/jpeg' };
    } catch {
      return null;
    }
  };
}

// Meta WhatsApp Cloud API. Free-form text only reaches numbers inside a 24h window
// (recipient messaged the business number first). Never throws: callers fall back to QR.
export function makeSendWhatsApp(env: { WA_TOKEN?: string; WA_PHONE_ID?: string; WA_GRAPH_VERSION?: string }): SendWhatsApp {
  const { WA_TOKEN, WA_PHONE_ID, WA_GRAPH_VERSION = 'v23.0' } = env;
  return async (to, text) => {
    if (!WA_TOKEN || !WA_PHONE_ID) return { sent: false, error: 'not_configured' };
    try {
      const res = await fetch(`https://graph.facebook.com/${WA_GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${WA_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/\D/g, ''), type: 'text', text: { body: text, preview_url: true } }),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok ? { sent: true } : { sent: false, error: `http_${res.status}: ${(await res.text()).slice(0, 200)}` };
    } catch (e) {
      return { sent: false, error: String(e) };
    }
  };
}
