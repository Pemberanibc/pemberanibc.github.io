// Broadcast sound design, synthesised live with the Web Audio API (no audio files, nothing to license).
export function createSound() {
  let ctx = null, master = null, enabled = true, whir = null, noiseBuf = null;
  const ensure = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createDynamicsCompressor(); master.threshold.value = -14; master.ratio.value = 6;
    const out = ctx.createGain(); out.gain.value = 0.9; master.connect(out); out.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  };
  const ok = () => enabled && ctx && ctx.state === 'running';
  const env = (g, t, a, peak, dec) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  function tone(f0, f1, dur, peak, type = 'sine', when = 0) {
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
    env(g, t, 0.006, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.1);
  }
  function noise(freq, q, dur, peak, type = 'bandpass', when = 0, f1) {
    const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.004, peak, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }
  const bell = (base, peak, dur, when = 0) => [[1, 1], [2.01, 0.5], [2.76, 0.35], [4.07, 0.2], [5.4, 0.12]].forEach(([m, a]) => tone(base * m, base * m, dur / Math.sqrt(m), peak * a, 'sine', when));
  const impact = (peak = 0.9, when = 0) => { tone(110, 34, 1.6, peak, 'sine', when); noise(220, 0.7, 0.35, peak * 0.5, 'lowpass', when); noise(2600, 0.8, 0.06, peak * 0.25, 'bandpass', when); };

  const fx = {
    opening() { impact(1); noise(300, 0.8, 0.9, 0.18, 'bandpass', 0, 4000); bell(293.66, 0.12, 2.6, 0.05); },
    tick() { tone(1800 + Math.random() * 500, 1500, 0.045, 0.16, 'triangle'); noise(5200, 1.2, 0.03, 0.1); },
    reveal() { impact(1); bell(587.33, 0.14, 2.2); noise(500, 0.7, 0.5, 0.14, 'bandpass', 0, 5000); },
    flip() { tone(1175, 1175, 0.06, 0.12, 'sine'); },
    group() { impact(0.8); bell(880, 0.16, 2.4); tone(440, 440, 0.9, 0.08, 'triangle'); },
    confirm() { tone(880, 880, 0.18, 0.12, 'sine', 0); tone(1318.5, 1318.5, 0.35, 0.12, 'sine', 0.11); },
    undo() { tone(520, 300, 0.25, 0.12, 'triangle'); },
    finale() {
      impact(1.1); noise(400, 0.6, 1.4, 0.2, 'bandpass', 0, 6000);
      [[146.83, 0], [220, 0], [293.66, 0.02], [369.99, 0.25], [440, 0.45], [587.33, 0.65], [739.99, 0.9], [880, 1.15]].forEach(([f, w]) => { tone(f, f, 4.2, 0.09, 'sawtooth', w); tone(f * 2, f * 2, 3.2, 0.03, 'sine', w); });
      bell(1174.66, 0.1, 3.5, 1.2); impact(0.9, 1.25);
    },
  };

  return {
    get locked() { return !ctx || ctx.state !== 'running'; },
    async unlock() { const c = ensure(); if (!c) return false; if (c.state !== 'running') { try { await c.resume(); } catch {} } return c.state === 'running'; },
    setEnabled(on) { enabled = !!on; if (ctx && !enabled) this.spin(0); },
    play(name) { if (ok() && fx[name]) fx[name](); },
    // continuous wheel whir; speed 0..1
    spin(speed) {
      if (!ctx) return;
      if (speed > 0.02 && ok()) {
        if (!whir) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = 1.6; g.gain.value = 0.0001; s.connect(f); f.connect(g); g.connect(master); s.start(); whir = { s, f, g }; }
        whir.f.frequency.setTargetAtTime(250 + 1500 * speed, ctx.currentTime, 0.05); whir.g.gain.setTargetAtTime(0.16 * Math.min(1, speed * 1.4), ctx.currentTime, 0.05);
      } else if (whir) { const w = whir; whir = null; w.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); setTimeout(() => { try { w.s.stop(); } catch {} }, 400); }
    },
  };
}
