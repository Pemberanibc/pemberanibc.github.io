// PEMBERANI TOURNAMENT EDISI 3.0 — live draw engine.
// Pure state machine: no DOM, no timers, no animation. Every result is decided here and only here;
// the screens merely animate what this module has already put into the state.
//
// phase:  idle -> ready -> spinning -> picked -> allocating -> allocated -> ready ... -> complete
export const PAIRS = [
  'Herman & Poknik', 'Charlie & Azlan', 'Aizat & Abg Mie', 'Syahir & Samad',
  'Daus & Abg Fizan', 'Fauzie Gigi & Jai', 'Soul & Syaqir', 'Rosli & Nataman',
  'Nizam & Satbeer', 'Muizz & Fareez', 'Adian & Pok', 'Rasheed & Abdel',
];
export const CAP = 6;
export const DUR = { spin: 7200, alloc: 4400, allocAuto: 2400, finalDelay: 4500 };
export const TAU = Math.PI * 2;
export const POINTER = -Math.PI / 2;           // fixed pointer at 12 o'clock

export const spinEase = (u) => { u = Math.min(1, Math.max(0, u)); return 1 - Math.pow(1 - Math.pow(u, 1.5), 3.6); };
export const flipEase = (u) => { u = Math.min(1, Math.max(0, u)); return 1 - Math.pow(1 - u, 2.4); };

// Unbiased integers from the browser's cryptographic generator (rejection sampling, no modulo bias).
export function cryptoRng(cryptoObj = globalThis.crypto) {
  return {
    int(n) {
      if (!Number.isInteger(n) || n < 1) throw new Error('bad range');
      if (n === 1) return 0;
      const limit = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
      do { cryptoObj.getRandomValues(buf); } while (buf[0] >= limit);
      return buf[0] % n;
    },
  };
}

export function initialState(now, prev) {
  return {
    v: 1, drawId: 'draw-' + now.toString(36), rev: ((prev && prev.rev) || 0) + 1, updatedAt: now,
    phase: 'idle', paused: false, pausedAt: 0,
    pairs: PAIRS.slice(), remaining: PAIRS.map((_, i) => i), groups: { A: [], B: [] },
    current: null, history: [], wheelAngle: -0.35,
    view: 'arena', startedAt: null, completedAt: null,
  };
}
const clone = (s) => JSON.parse(JSON.stringify(s));
const animating = (s) => s.phase === 'spinning' || s.phase === 'allocating';
export const clock = (s, now) => (s.paused ? s.pausedAt : now);

// What the organiser may do right now. The UI enables / disables buttons from this, and the
// actions below re-check it, so a stray click can never corrupt the draw.
export function can(s, now) {
  const idle = !animating(s) && !s.paused;
  return {
    start: s.phase === 'idle' && !s.paused,
    drawNext: s.phase === 'ready' && s.remaining.length > 0 && !s.paused,
    revealGroup: s.phase === 'picked' && !s.paused,
    next: s.phase === 'allocated' && !s.paused,
    pause: !s.paused && animating(s),
    resume: s.paused,
    undo: idle && (s.phase === 'picked' || s.history.length > 0),
    reset: !animating(s) || s.paused,
    view: s.phase === 'complete',
  };
}
export function primaryAction(s) {
  return { idle: 'start', ready: 'drawNext', picked: 'revealGroup', allocated: 'next' }[s.phase] || null;
}

// Time-driven transitions. Deterministic (no randomness), so every screen can evaluate it and agree.
export function tick(s, now) {
  const t = clock(s, now);
  if (s.phase === 'spinning' && t - s.current.spin.startedAt >= s.current.spin.dur) {
    const n = clone(s), c = n.current;
    n.phase = 'picked'; n.wheelAngle = c.spin.to; c.pickedAt = c.spin.startedAt + c.spin.dur;
    n.remaining = n.remaining.filter((id) => id !== c.pairId);
    return tick(n, now);
  }
  if (s.phase === 'allocating' && t - s.current.alloc.startedAt >= s.current.alloc.dur) {
    const n = clone(s), c = n.current;
    if (n.groups[c.group].length >= CAP) throw new Error('group over capacity');
    c.allocatedAt = c.alloc.startedAt + c.alloc.dur;
    n.groups[c.group].push(c.pairId);
    n.history.push({ order: c.order, pairId: c.pairId, pair: n.pairs[c.pairId], group: c.group, allocation: c.allocation, at: c.allocatedAt });
    n.phase = 'allocated';
    return tick(n, now);
  }
  if (s.phase === 'allocated' && s.remaining.length === 0 && t - s.current.allocatedAt >= DUR.finalDelay) return actions.next(s, now) || s;
  return s;
}

// Each action returns a new state, or null when it is not allowed in the current phase.
export const actions = {
  start(s, now) { if (!can(s).start) return null; const n = clone(s); n.phase = 'ready'; n.startedAt = now; return n; },

  // STAGE 1 — pick one of the remaining pairs, uniformly, without replacement.
  drawNext(s, now, rng, visual = Math.random) {
    if (!can(s).drawNext) return null;
    const n = clone(s), pool = n.remaining.slice(), poolIndex = rng.int(pool.length), pairId = pool[poolIndex];
    const seg = TAU / pool.length, off = pool.length === 1 ? 0 : (visual() - 0.5) * seg * 0.6;
    const base = n.wheelAngle + TAU * (5 + visual() * 1.5);        // visual only: how far the wheel travels
    let to = POINTER - ((poolIndex + 0.5) * seg + off); to += Math.ceil((base - to) / TAU) * TAU;
    n.current = { order: n.history.length + 1, pairId, poolBefore: pool, poolIndex, spin: { startedAt: now, dur: DUR.spin, from: n.wheelAngle, to }, group: null, allocation: null, alloc: null };
    n.phase = 'spinning';
    return n;
  },

  // STAGE 2 — A or B, uniformly, while both groups have room; otherwise the only group left.
  revealGroup(s, now, rng, visual = Math.random) {
    if (!can(s).revealGroup) return null;
    const n = clone(s), c = n.current, a = n.groups.A.length, b = n.groups.B.length;
    if (a < CAP && b < CAP) { c.group = rng.int(2) === 0 ? 'A' : 'B'; c.allocation = 'random'; c.alloc = { startedAt: now, dur: DUR.alloc, flips: 17 + Math.floor(visual() * 6) }; }
    else if (a < CAP || b < CAP) { c.group = a < CAP ? 'A' : 'B'; c.allocation = 'auto'; c.alloc = { startedAt: now, dur: DUR.allocAuto, flips: 0 }; }
    else return null;
    n.phase = 'allocating';
    return n;
  },

  next(s, now) {
    if (!can(s).next) return null;
    const n = clone(s); n.current = null;
    if (n.remaining.length === 0) { n.phase = 'complete'; n.view = 'final'; n.completedAt = now; } else n.phase = 'ready';
    return n;
  },

  pause(s, now) { if (!can(s).pause) return null; const n = clone(s); n.paused = true; n.pausedAt = now; return n; },
  resume(s, now) {
    if (!can(s).resume) return null;
    const n = clone(s), d = now - n.pausedAt, c = n.current;
    if (c) { if (n.phase === 'spinning') c.spin.startedAt += d; if (n.phase === 'allocating') c.alloc.startedAt += d; if (c.allocatedAt) c.allocatedAt += d; }
    n.paused = false; n.pausedAt = 0; return n;
  },

  // Undo the most recent draw: the pair goes back into the pool and leaves its group.
  undo(s) {
    if (!can(s).undo) return null;
    const n = clone(s);
    if (n.phase === 'picked') { n.remaining = n.current.poolBefore.slice(); }
    else {
      const last = n.history.pop();
      n.groups[last.group] = n.groups[last.group].filter((id) => id !== last.pairId);
      n.remaining = [...n.remaining, last.pairId].sort((x, y) => x - y);
    }
    n.current = null; n.phase = 'ready'; n.view = 'arena'; n.completedAt = null;
    return n;
  },

  reset(s, now) { if (!can(s).reset) return null; return initialState(now, s); },
  setView(s, now, view) { if (!can(s).view || !['arena', 'final'].includes(view)) return null; const n = clone(s); n.view = view; return n; },
};

// Structural invariants — checked on every write and on every load from storage.
export function validate(s) {
  const err = (m) => { throw new Error('Invalid draw state: ' + m); };
  if (!s || s.v !== 1) err('version');
  if (JSON.stringify(s.pairs) !== JSON.stringify(PAIRS)) err('pair list');
  if (s.groups.A.length > CAP || s.groups.B.length > CAP) err('group over capacity');
  const inFlight = s.current && ['picked', 'allocating'].includes(s.phase) ? [s.current.pairId] : [];
  const all = [...s.remaining, ...s.groups.A, ...s.groups.B, ...inFlight];
  if (all.length !== 12 || new Set(all).size !== 12 || all.some((id) => !(id >= 0 && id < 12))) err('every pair must exist exactly once');
  if (s.history.length !== s.groups.A.length + s.groups.B.length) err('history length');
  s.history.forEach((h, i) => { if (h.order !== i + 1 || !s.groups[h.group].includes(h.pairId) || h.pair !== PAIRS[h.pairId]) err('history entry ' + (i + 1)); });
  if (s.phase === 'complete' && (s.groups.A.length !== CAP || s.groups.B.length !== CAP)) err('complete without 6 + 6');
  return s;
}

// ---- results ----
export function results(s) {
  return {
    event: 'PEMBERANI TOURNAMENT — EDISI 3.0', title: 'OFFICIAL GROUP DRAW', drawId: s.drawId,
    complete: s.phase === 'complete' || (s.groups.A.length === CAP && s.groups.B.length === CAP),
    startedAt: s.startedAt ? new Date(s.startedAt).toISOString() : null,
    completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
    groups: { A: s.groups.A.map((id) => s.pairs[id]), B: s.groups.B.map((id) => s.pairs[id]) },
    history: s.history.map((h) => ({ order: h.order, pair: h.pair, group: h.group, allocation: h.allocation, drawnAt: new Date(h.at).toISOString() })),
  };
}
export function resultsCsv(s) {
  const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  return ['Order,Pair,Group,Allocation,Drawn at', ...results(s).history.map((h) => [h.order, q(h.pair), 'Group ' + h.group, h.allocation, h.drawnAt].join(','))].join('\r\n') + '\r\n';
}
