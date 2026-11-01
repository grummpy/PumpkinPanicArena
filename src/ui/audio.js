const MELODY = [523.25, 622.25, 587.33, 523.25, 392, 440, 523.25, 349.23, 392, 440, 523.25, 587.33, 493.88, 440, 392, 349.23];
const STEP = 0.21;

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let volume = 0.7;
  let started = false;
  let nextNote = 0;
  let noteIndex = 0;

  function ensure() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : volume;
        master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
    } catch {
      ctx = null;
      master = null;
      return null;
    }
    return ctx;
  }

  function setMuted(value) {
    muted = !!value;
    if (master) master.gain.value = muted ? 0 : volume;
  }

  function setVolume(value) {
    volume = Math.max(0, Math.min(1, value));
    if (master && !muted) master.gain.value = volume;
  }

  function gesture() {
    started = true;
    ensure();
  }

  function envGain(when, peak, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    return g;
  }

  function tone(freq, dur, type, peak, when) {
    if (!ctx || muted || volume <= 0) return;
    const t = when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const g = envGain(t, peak, dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, peak, when) {
    if (!ctx || muted || volume <= 0) return;
    const t = when ?? ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    const g = envGain(t, peak, dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function pump() {
    if (!started || !ensure() || muted || volume <= 0) {
      if (ctx) nextNote = ctx.currentTime + 0.05;
      return;
    }
    const horizon = ctx.currentTime + 0.45;
    while (nextNote < horizon) {
      const f = MELODY[noteIndex % MELODY.length];
      tone(f, 0.16, "square", noteIndex % 4 === 0 ? 0.055 : 0.038, nextNote);
      if (noteIndex % 2 === 0) {
        tone(f / 2, 0.18, "triangle", 0.04, nextNote);
      }
      noteIndex += 1;
      nextNote += STEP;
    }
  }

  function handle(events) {
    if (!started || !ensure()) return;
    for (const e of events) {
      if (e.type === "bash") {
        noise(0.09, 0.2);
        tone(e.mega ? 180 : 240, 0.08, "square", 0.08);
      } else if (e.type === "charge") {
        tone(180, 0.12, "sawtooth", 0.06);
        tone(360, 0.1, "square", 0.04);
      } else if (e.type === "hit") {
        noise(0.07, 0.16);
        tone(320, 0.07, "square", 0.06);
      } else if (e.type === "armor") {
        tone(520, 0.08, "triangle", 0.07);
        tone(780, 0.1, "sine", 0.04);
      } else if (e.type === "ko") {
        tone(392, 0.12, "square", 0.09);
        tone(262, 0.18, "square", 0.08);
        tone(165, 0.28, "triangle", 0.08);
        noise(0.16, 0.18);
      } else if (e.type === "crate") {
        noise(0.12, 0.22);
        tone(150, 0.1, "square", 0.07);
      } else if (e.type === "pickup") {
        tone(660, 0.06, "square", 0.06);
        tone(880, 0.08, "square", 0.05);
      } else if (e.type === "power") {
        tone(523, 0.08, "square", 0.06);
        tone(659, 0.08, "square", 0.06);
        tone(784, 0.12, "triangle", 0.06);
      } else if (e.type === "countdown") {
        if (e.n === 0) {
          tone(880, 0.16, "square", 0.08);
        } else {
          tone(440 + (3 - e.n) * 40, 0.09, "square", 0.07);
        }
      } else if (e.type === "round" || e.type === "draw") {
        tone(523, 0.12, "square", 0.07);
        tone(659, 0.12, "square", 0.07);
        tone(784, 0.2, "triangle", 0.07);
      } else if (e.type === "match") {
        [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, "square", 0.07));
      } else if (e.type === "ui") {
        tone(700, 0.04, "square", 0.04);
      }
    }
  }

  return { gesture, setMuted, setVolume, pump, handle };
}
