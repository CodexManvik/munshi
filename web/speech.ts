// Browser speech in Hindi. Utterances queue so an announcement never cuts off a question.
let chain: Promise<void> = Promise.resolve();

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  // Roman-script Hinglish: an Indian English voice reads it better than a foreign default.
  return voices.find(v => v.lang === 'hi-IN') ?? voices.find(v => v.lang.startsWith('hi')) ?? voices.find(v => v.lang === 'en-IN');
}

function speakNow(text: string): Promise<void> {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    u.lang = voice?.lang ?? 'hi-IN';
    if (voice) u.voice = voice;
    u.rate = 0.95;
    const done = () => { clearTimeout(cap); resolve(); };
    // Some engines never fire onend; cap by roughly how long the line takes to say.
    const cap = setTimeout(done, Math.min(15_000, 2500 + text.length * 80));
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
  });
}

export function speak(text: string): Promise<void> {
  chain = chain.then(() => speakNow(text));
  return chain;
}

export const canListen = () => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

export function listen(): Promise<string> {
  return new Promise(resolve => {
    const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) return resolve('');
    const r = new Ctor();
    r.lang = 'hi-IN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    let heard = '';
    r.onresult = (e: any) => { heard = e.results[0][0].transcript; };
    r.onerror = () => resolve('');
    r.onend = () => resolve(heard);
    r.start();
  });
}
