// Original soundtrack + sound design, synthesised from scratch (no samples, no third-party music).
// Every cue is placed from the same timeline the picture uses.   node audio.js <drawDir> <out.wav>
const fs = require('fs'), path = require('path');
const buildTimeline = require('../film/timeline.js');
const [drawDir, outWav] = process.argv.slice(2);
const T = buildTimeline(JSON.parse(fs.readFileSync(path.join(drawDir, 'draw.json'), 'utf8')));
const SR = 48000, N = Math.ceil(T.end * SR), TAU = Math.PI * 2;
const L = new Float32Array(N), R = new Float32Array(N), RV = new Float32Array(N); // dry L/R + reverb send
let seed = 1234567; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
// add(t0, dur, fn): fn(tt, i) -> sample; pan -1..1; rev = reverb send amount
function add(t0, dur, gain, pan, rev, fn) {
  const a = Math.max(0, Math.round(t0 * SR)), b = Math.min(N, Math.round((t0 + dur) * SR));
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = a; i < b; i++) { const v = fn((i - a) / SR, i - a); L[i] += v * gl * 1.414; R[i] += v * gr * 1.414; RV[i] += v * gain * rev; }
}
function svf() { let lo = 0, bd = 0; return (x, fc, q) => { const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6.5) / SR); lo += f * bd; const hi = x - lo - q * bd; bd += f * hi; return { lo, bd, hi }; }; }
const sweepSine = (f0, f1, k) => { let ph = 0; return (tt) => { const f = f1 + (f0 - f1) * Math.exp(-tt * k); ph += TAU * f / SR; return Math.sin(ph); }; };

const SFX = {
  impactBig(t, g = 1) {
    const s = sweepSine(105, 36, 7), f = svf(), f2 = svf();
    add(t, 2.6, 0.95 * g, 0, 0.25, (tt) => s(tt) * Math.exp(-tt * 2.1) * clamp(tt * 400) + f(rnd(), 240, 0.9).lo * Math.exp(-tt * 9) * 0.9);
    add(t, 0.2, 0.3 * g, 0, 0.5, (tt) => f2(rnd(), 2600, 0.7).bd * Math.exp(-tt * 45));
  },
  slam(t, g = 1) { const s = sweepSine(130, 46, 12), f = svf(); add(t, 1.0, 0.7 * g, 0, 0.2, (tt) => s(tt) * Math.exp(-tt * 5) * clamp(tt * 500) + f(rnd(), 900, 0.8).bd * Math.exp(-tt * 30) * 0.5); },
  hit(t) { const s = sweepSine(150, 62, 10); add(t, 0.8, 0.5, 0, 0.3, (tt) => s(tt) * Math.exp(-tt * 6) * clamp(tt * 500)); },
  metal(t, g = 1, base = 587.33) {
    [[1, 1, 2.2], [2.01, 0.6, 3], [2.76, 0.45, 4], [4.07, 0.3, 5.5], [5.43, 0.22, 7], [6.8, 0.12, 9]].forEach(([m, a, d], i) =>
      add(t, 2.4, 0.11 * g * a, i % 2 ? 0.35 : -0.35, 0.6, (tt) => Math.sin(TAU * base * m * tt) * Math.exp(-tt * d) * clamp(tt * 900)));
  },
  tick(t, e) { const f = svf(), p = 1900 + 500 * rnd(); add(t, 0.06, 0.2, 0.15 * rnd(), 0.12, (tt) => (Math.sin(TAU * p * tt) * 0.7 + f(rnd(), 5200, 0.6).bd) * Math.exp(-tt * 95)); },
  reelTick(t) { add(t, 0.07, 0.13, 0, 0.1, (tt) => (Math.sin(TAU * 1175 * tt) + 0.5 * Math.sin(TAU * 2350 * tt)) * Math.exp(-tt * 70)); },
  spinStart(t, e) { const f = svf(); add(t, e.dur, 0.34, 0, 0.1, (tt) => { const u = tt / e.dur, v = (T.spinEase(u + 0.01) - T.spinEase(u)) * 40; return f(rnd(), 260 + 1500 * v, 0.35).bd * clamp(v * 1.3) * clamp(tt * 30); }); },
  reelStart(t, e) { const f = svf(); add(t, e.dur, 0.2, 0, 0.1, (tt) => { const u = tt / e.dur, v = (T.reelEase(u + 0.01) - T.reelEase(u)) * 40; return f(rnd(), 700 + 2200 * v, 0.3).bd * clamp(v) * clamp(tt * 40); }); },
  land(t) { SFX.slam(t, 0.85); [[820, 1, 9], [1733, 0.7, 12], [2917, 0.5, 16], [4380, 0.3, 22]].forEach(([fq, a, d]) => add(t, 0.6, 0.12 * a, 0, 0.4, (tt) => Math.sin(TAU * fq * tt) * Math.exp(-tt * d))); },
  plate(t) { [587.33, 880, 1174.66].forEach((fq, i) => add(t, 1.1, 0.06, (i - 1) * 0.5, 0.7, (tt) => Math.sin(TAU * fq * tt) * Math.exp(-tt * 4) * clamp(tt * 200))); SFX.whooshFast(t + 0.1, null, 0.5); },
  group(t) { const s = sweepSine(95, 44, 9); add(t, 1.4, 0.75, 0, 0.25, (tt) => s(tt) * Math.exp(-tt * 3.4) * clamp(tt * 500)); SFX.metal(t, 1.5, 880); },
  groupAuto(t) { const s = sweepSine(110, 55, 12); add(t, 0.6, 0.45, 0, 0.2, (tt) => s(tt) * Math.exp(-tt * 7) * clamp(tt * 500)); SFX.metal(t, 0.7, 880); },
  fly(t, e) { const f = svf(); add(t, e.dur, 0.2, 0, 0.3, (tt) => { const u = tt / e.dur; return f(rnd(), 500 + 3200 * u * u, 0.5).bd * Math.sin(Math.PI * u); }); },
  rowLand(t, e) { const g = e && e.soft ? 0.55 : 1; const s = sweepSine(260, 140, 40), f = svf(); add(t, 0.25, 0.42 * g, 0, 0.25, (tt) => s(tt) * Math.exp(-tt * 28) + f(rnd(), 3500, 0.6).bd * Math.exp(-tt * 80) * 0.6); add(t, 0.5, 0.05 * g, 0, 0.6, (tt) => Math.sin(TAU * 1760 * tt) * Math.exp(-tt * 9)); },
  shuttleWhoosh(t, e) { const f = svf(); add(t, e.dur, 0.3, 0, 0.35, (tt) => { const u = tt / e.dur; return f(rnd(), 350 + 1500 * u * u * u + 200 * Math.sin(u * 9), 0.45).bd * (0.25 + 0.75 * u * u) * Math.sin(Math.PI * Math.pow(u, 0.7)) * (0.8 + 0.2 * Math.sin(TAU * 17 * tt)); }); },
  whooshFast(t, e, g = 1) { const f = svf(), d = 0.7; add(t - 0.45, d, 0.36 * g, 0, 0.3, (tt) => { const u = tt / d; return f(rnd(), 300 + 4200 * u * u, 0.5).bd * Math.pow(Math.sin(Math.PI * Math.pow(u, 1.6)), 2); }); },
  riser(t, e) { const f = svf(); let ph = 0; add(t, e.dur, 0.26, 0, 0.3, (tt) => { const u = tt / e.dur; ph += TAU * (180 * Math.pow(6, u)) / SR; return (f(rnd(), 800 + 6000 * u, 0.5).hi * 0.35 + Math.sin(ph) * 0.35) * u * u * clamp((e.dur - tt) * 60); }); },
  finalBoom(t) { SFX.impactBig(t, 1.25); SFX.metal(t, 1.6, 293.66); SFX.metal(t, 0.9, 587.33); const s = sweepSine(60, 30, 1.2); add(t, 3.4, 0.5, 0, 0.3, (tt) => s(tt) * Math.exp(-tt * 1.3) * clamp(tt * 100)); },
};
const WANTS_EVENT = new Set(['tick', 'spinStart', 'reelStart', 'fly', 'rowLand', 'shuttleWhoosh', 'whooshFast', 'riser']);
for (const e of T.events) { if (!SFX[e.type]) throw new Error('no sound for ' + e.type); WANTS_EVENT.has(e.type) ? SFX[e.type](e.t, e) : SFX[e.type](e.t); }

// ---------------- music: original cue in D minor, 120 bpm ----------------
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CH = [[38, 50, 53, 57, 62], [34, 46, 53, 58, 62], [41, 48, 53, 57, 60], [36, 48, 52, 55, 60]]; // Dm  Bb  F  C  (bass + voicing)
const chordAt = (t) => CH[(((Math.floor((t - T.s3) / 4)) % 4) + 4) % 4];
const env = (t, pts) => { for (let i = 1; i < pts.length; i++) if (t < pts[i][0]) { const u = (t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * clamp(u); } return pts[pts.length - 1][1]; };
// drone
{ const lv = (t) => env(t, [[0, 0], [0.4, 0], [3, 0.8], [7.5, 0.6], [T.s3, 0.75], [T.s4, 0.8], [T.s4 + 1, 1], [T.s5 + 4.8, 1], [T.end - 1.2, 0.35], [T.end - 0.3, 0]]);
  const f = svf(); let p1 = 0, p2 = 0, p3 = 0;
  add(0, T.end, 0.17, 0, 0.1, (tt) => { p1 += TAU * 36.71 / SR; p2 += TAU * 73.6 / SR; p3 += TAU * 110.2 / SR;
    let s = Math.sin(p1) * 0.9; for (let h = 1; h <= 6; h++) s += Math.sin(p2 * h) / h * 0.5 + Math.sin(p3 * h + 1) / h * 0.18;
    return f(s, 190 + 120 * Math.sin(tt * 0.5), 0.9).lo * lv(tt) * (0.85 + 0.15 * Math.sin(tt * 1.9)); }); }
// pad (chord changes every 4 s, cross-faded)
{ const lv = (t) => env(t, [[0, 0], [3.2, 0], [4.5, 0.55], [7.5, 0.4], [T.s3, 0.6], [T.s4, 0.75], [T.s4 + 1.2, 1.25], [T.s5, 1.0], [T.s5 + 4.8, 1.2], [T.end - 1.4, 0.3], [T.end - 0.3, 0]]);
  for (let c0 = T.s3 - 16; c0 < T.end; c0 += 4) {
    const fixed = c0 >= T.s5 ? CH[0] : chordAt(c0 + 0.01);
    fixed.slice(1).forEach((m, i) => [-1, 1].forEach((side) => {
      const fq = hz(m) * (1 + side * 0.003), fl = svf(); let ph = rnd() * 3;
      add(c0 - 0.4, 4.8, 0.03, side * 0.7, 0.5, (tt) => { ph += TAU * fq / SR; let s = 0; for (let h = 1; h <= 7; h++) s += Math.sin(ph * h) / h;
        const t = c0 - 0.4 + tt; return fl(s, 600 + 900 * lv(t), 0.8).lo * lv(t) * clamp(tt / 0.6) * clamp((4.8 - tt) / 0.6); });
    }));
  } }
// heartbeat in the opening
for (let t = 1.0; t < 3.0; t += 1.0) { SFX.hit(t); }
// rhythm section through the draw
for (let b = 0, t = T.s2; t < T.s4 - 0.01; b++, t = T.s2 + b * 0.25) {
  const inDraw = t >= T.s3, beat = b % 2 === 0, lvl = inDraw ? 1 : (t >= T.wheelIn ? 0.6 : 0.35);
  const ch = chordAt(t + 0.01);
  if (b % 2 === 0) { // 8th-note ostinato
    const m = ch[0] + ((b / 2) % 4 === 3 ? 12 : 0), fq = hz(m), fl = svf(); let ph = 0; const acc = (b / 2) % 4 === 0 ? 1 : 0.7;
    add(t, 0.24, 0.2 * lvl * acc, 0, 0.15, (tt) => { ph += TAU * fq / SR; let s = 0; for (let h = 1; h <= 9; h++) s += Math.sin(ph * h) / h; return fl(s, 250 + 1500 * Math.exp(-tt * 18), 0.6).lo * Math.exp(-tt * 11) * clamp(tt * 600); });
  }
  if (inDraw && b % 2 === 0) { const s = sweepSine(120, 44, 30); add(t, 0.3, (b % 4 === 0 ? 0.42 : 0.24), 0, 0.05, (tt) => s(tt) * Math.exp(-tt * 13) * clamp(tt * 800)); }
  if (inDraw || t >= T.wheelIn) { const fl = svf(); add(t, 0.05, (b % 2 ? 0.05 : 0.028) * lvl, b % 2 ? 0.4 : -0.4, 0.1, (tt) => fl(rnd(), 7500, 0.7).hi * Math.exp(-tt * 110)); }
}
// final-reveal melody: slow rising line over the pad
[[0, 62], [1, 65], [2, 69], [3, 74], [4.3, 77], [6, 76], [7, 74]].forEach(([dt, m]) => {
  const fq = hz(m); add(T.s4 + 1.0 + dt, 2.2, 0.07, 0, 0.8, (tt) => (Math.sin(TAU * fq * tt) + 0.3 * Math.sin(TAU * fq * 2 * tt) + 0.12 * Math.sin(TAU * fq * 3 * tt)) * Math.exp(-tt * 1.6) * clamp(tt * 60));
});
for (let t = T.s4 + 1.0; t < T.s4 + 8.6; t += 1.0) { const s = sweepSine(110, 42, 22); add(t, 0.5, 0.3, 0, 0.15, (tt) => s(tt) * Math.exp(-tt * 9) * clamp(tt * 800)); }

// ---------------- reverb (Schroeder) + master ----------------
function reverb(inp, combs, aps) {
  const out = new Float32Array(N);
  for (const [d, fb] of combs) { const buf = new Float32Array(d); let p = 0, lp = 0; for (let i = 0; i < N; i++) { const y = buf[p]; lp = y * 0.72 + lp * 0.28; buf[p] = inp[i] + lp * fb; p = (p + 1) % d; out[i] += y; } }
  for (const d of aps) { const buf = new Float32Array(d); let p = 0; for (let i = 0; i < N; i++) { const b = buf[p], x = out[i]; const y = -0.5 * x + b; buf[p] = x + 0.5 * y; p = (p + 1) % d; out[i] = y; } }
  return out;
}
const rl = reverb(RV, [[1687, 0.86], [1801, 0.85], [2053, 0.84], [2251, 0.83], [2423, 0.82]], [347, 113, 37]);
const rr = reverb(RV, [[1733, 0.86], [1867, 0.85], [2099, 0.84], [2311, 0.83], [2477, 0.82]], [359, 127, 41]);
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh((L[i] + rl[i] * 0.09) * 1.0); R[i] = Math.tanh((R[i] + rr[i] * 0.09) * 1.0);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const g = 0.89 / peak, tail = 0.25 * SR;
const wav = Buffer.alloc(44 + N * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { const fd = clamp((N - i) / tail); wav.writeInt16LE(Math.round(L[i] * g * fd * 32767), 44 + i * 4); wav.writeInt16LE(Math.round(R[i] * g * fd * 32767), 46 + i * 4); }
fs.writeFileSync(outWav, wav);
console.log(`audio: ${(N / SR).toFixed(2)}s, ${T.events.length} cues, pre-master peak ${peak.toFixed(2)}`);
