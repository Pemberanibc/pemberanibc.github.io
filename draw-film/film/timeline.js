// Shared, deterministic timeline. Built ONLY from the committed draw file.
// Used by the renderer (browser) and by the audio synth / verifier (Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.buildTimeline = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TAU = Math.PI * 2;
  const POINTER = -Math.PI / 2;

  // Visual-only PRNG (spin lengths, landing offset inside the winning segment). Never affects the result.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const spinEase = (u) => { u = Math.min(1, Math.max(0, u)); return 1 - Math.pow(1 - Math.pow(u, 1.35), 3.4); };
  const reelEase = (u) => { u = Math.min(1, Math.max(0, u)); return 1 - Math.pow(1 - u, 2.6); };

  function buildTimeline(draw) {
    const FPS = 30;
    const vr = mulberry32(0x3E0D1530);
    const T = { fps: FPS, s1: 0, s2: 7.5, wheelIn: 10.25, s3: 13.0, spinEase, reelEase, POINTER };
    const events = [];
    const ev = (t, type, extra) => events.push(Object.assign({ t, type }, extra || {}));

    let pool = draw.pairs.map((name, id) => ({ id, name }));
    T.initialPool = pool.slice();
    T.phiStart = -0.35;
    let phi = T.phiStart, t = T.s3, reelPos = 0;
    const count = { A: 0, B: 0 };
    const sels = [];

    draw.selections.forEach((d, k) => {
      const n = pool.length;
      const j = pool.findIndex((p) => p.id === d.pairId);
      if (j < 0) throw new Error('draw file inconsistent: pair not in pool');
      const auto = d.allocation === 'auto';
      const seg = TAU / n;
      const off = n === 1 ? 0 : (vr() - 0.5) * seg * 0.62;
      const thetaC = (j + 0.5) * seg + off;
      const base = phi + TAU * (1.9 + vr() * 0.5);
      let phi1 = POINTER - thetaC;
      phi1 += Math.ceil((base - phi1) / TAU) * TAU;
      const s = {
        k, n, j, name: d.pair, id: d.pairId, group: d.group, auto, slot: count[d.group],
        countBefore: { A: count.A, B: count.B },
        pool: pool.slice(), t0: t, phi0: phi, phi1,
        spinStart: t + 0.08, spinEnd: t + 1.5,
        plateAt: t + 1.62, reflow0: t + 1.8, reflow1: t + 2.4,
      };
      if (auto) {
        s.reelStart = t + 2.0; s.reelEnd = t + 2.12; s.flyStart = t + 2.3; s.flyEnd = t + 2.78; s.end = t + 3.0;
        s.reel0 = reelPos; s.reel1 = reelPos + ((Math.round(reelPos) % 2 === (d.group === 'A' ? 0 : 1)) ? 0 : 1);
      } else {
        s.reelStart = t + 1.9; s.reelEnd = t + 2.75; s.flyStart = t + 2.88; s.flyEnd = t + 3.36; s.end = t + 3.5;
        // reel letters alternate A,B,A,B...; even index = A, odd = B
        let target = Math.round(reelPos) + 9 + Math.floor(vr() * 2) * 2;
        if ((target % 2 === 0) !== (d.group === 'A')) target += 1;
        s.reel0 = reelPos; s.reel1 = target;
      }
      reelPos = s.reel1;
      count[d.group]++;

      // --- sound events ---
      ev(s.spinStart, 'spinStart', { dur: s.spinEnd - s.spinStart });
      // wheel ticks: segment boundaries passing the pointer
      if (n > 1) {
        let prev = null, last = -1;
        for (let i = 0; i <= 900; i++) {
          const u = i / 900;
          const a = s.phi0 + (s.phi1 - s.phi0) * spinEase(u);
          const idx = Math.floor((POINTER - a) / seg);
          const tt = s.spinStart + u * (s.spinEnd - s.spinStart);
          if (prev !== null && idx !== prev && tt - last > 0.03) { ev(tt, 'tick', { n }); last = tt; }
          prev = idx;
        }
      }
      ev(s.spinEnd, 'land', { k });
      ev(s.plateAt, 'plate', { k });
      if (!auto) {
        ev(s.reelStart, 'reelStart', { dur: s.reelEnd - s.reelStart });
        let prev = null;
        for (let i = 0; i <= 400; i++) {
          const u = i / 400, p = s.reel0 + (s.reel1 - s.reel0) * reelEase(u);
          const idx = Math.floor(p + 0.5);
          if (prev !== null && idx !== prev) ev(s.reelStart + u * (s.reelEnd - s.reelStart), 'reelTick');
          prev = idx;
        }
        ev(s.reelEnd, 'group', { k });
      } else {
        ev(s.reelEnd, 'groupAuto', { k });
      }
      ev(s.flyStart, 'fly', { dur: s.flyEnd - s.flyStart });
      ev(s.flyEnd, 'rowLand', { k });

      sels.push(s);
      pool = pool.filter((p) => p.id !== d.pairId);
      phi = phi1; t = s.end;
    });

    T.selections = sels;
    T.s4 = t;                 // final group reveal
    T.s5 = T.s4 + 9.5;        // closing
    T.end = T.s5 + 9.0;
    T.frames = Math.round(T.end * FPS);
    T.groups = { A: sels.filter((s) => s.group === 'A').map((s) => s.name), B: sels.filter((s) => s.group === 'B').map((s) => s.name) };

    // scene-level sound events
    ev(0.35, 'impactBig'); ev(0.5, 'shuttleWhoosh', { dur: 2.9 }); ev(3.05, 'whooshFast');
    ev(3.3, 'impactBig'); ev(4.3, 'hit'); ev(5.0, 'hit'); ev(5.9, 'metal'); ev(6.9, 'whooshFast');
    ev(7.5, 'slam'); ev(8.25, 'slam'); ev(9.0, 'impactBig'); ev(10.05, 'whooshFast');
    for (let i = 0; i < 12; i++) ev(10.45 + i * 0.09, 'tick', { n: 12 });
    ev(11.7, 'metal'); ev(11.0, 'riser', { dur: 2.0 });
    ev(T.s4 - 0.1, 'whooshFast'); ev(T.s4 + 0.25, 'impactBig'); ev(T.s4 + 1.0, 'slam');
    for (let i = 0; i < 12; i++) ev(T.s4 + 1.5 + i * 0.2 + 0.3, 'rowLand', { k: i, soft: true });
    ev(T.s4 + 4.3, 'metal'); ev(T.s4 + 8.9, 'whooshFast');
    ev(T.s5 + 0.3, 'impactBig'); ev(T.s5 + 1.2, 'slam'); ev(T.s5 + 1.8, 'slam'); ev(T.s5 + 2.4, 'impactBig');
    ev(T.s5 + 4.0, 'riser', { dur: 0.8 }); ev(T.s5 + 4.8, 'finalBoom');
    events.sort((a, b) => a.t - b.t);
    T.events = events;
    return T;
  }
  return buildTimeline;
});
