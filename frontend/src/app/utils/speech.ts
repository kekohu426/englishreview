let voices: SpeechSynthesisVoice[] = [];
let unlocked = false;

export function initSpeech() {
  if (!("speechSynthesis" in window)) return;
  const load = () => { voices = speechSynthesis.getVoices(); };
  load();
  speechSynthesis.onvoiceschanged = load;
  setTimeout(load, 150);
  setTimeout(load, 900);
  ["pointerdown", "touchstart", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, unlockAudio, { once: true, passive: true });
  });
}

function pickVoice(lang: string) {
  const target = lang.toLowerCase();
  const prefix = target.split("-")[0];
  return (
    voices.find((v) => v.lang?.toLowerCase() === target) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(`${prefix}-`)) ||
    null
  );
}

export function speak(text: string, lang = "en-US"): Promise<void> {
  return new Promise((resolve) => {
    const content = String(text || "").trim();
    if (!content) { resolve(); return; }
    if (!("speechSynthesis" in window)) { resolve(); return; }
    unlockAudio();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(content);
    u.lang = lang;
    u.rate = lang === "zh-CN" ? 0.92 : 0.78;
    u.pitch = 1.05;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, Math.max(3500, content.length * 140));
    u.onend = finish;
    u.onerror = finish;
    // iOS/Chrome resume workaround
    [0, 100, 350].forEach((d) => setTimeout(() => { try { speechSynthesis.resume(); } catch {} }, d));
    speechSynthesis.speak(u);
  });
}

export function detectLang(text: string) {
  return /[一-鿿]/.test(text) ? "zh-CN" : "en-US";
}

let audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!audioCtx) {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctor) audioCtx = new Ctor();
  }
  return audioCtx;
}

function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try { speechSynthesis.resume(); } catch {}
  const ctx = getAudioCtx();
  if (ctx?.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}
function tone(freq: number, dur: number, delay = 0, gain = 0.08) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
export function playSuccess() {
  tone(523, 0.13, 0, 0.08);
  tone(659, 0.13, 0.1, 0.08);
  tone(784, 0.18, 0.2, 0.08);
}
export function playWrong() {
  try {
    window.dispatchEvent(new CustomEvent("kids-english-wrong-answer"));
  } catch {}
  tone(392, 0.14, 0, 0.07);
  tone(330, 0.22, 0.13, 0.06);
}
