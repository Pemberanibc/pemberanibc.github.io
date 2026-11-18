/* PEMBERANI TOURNAMENT EDISI 3.0 — OFFICIAL GROUP DRAW FILM
   Deterministic Canvas-2D renderer: FILM.renderFrame(i) draws frame i (30 fps) and nothing depends on wall-clock time.
   Every name / group shown comes from the committed draw file via buildTimeline(draw). */
(function () {
  'use strict';
  const W = 1080, H = 1920, TAU = Math.PI * 2;
  const GOLD = '#FFC61A', CHAMP = '#C8A24A', HI = '#FFE45C', BG = '#050505', IVORY = '#F3EAD3';
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  let T = null, META = { sha256: '' }, crest = null;

  // ---------- helpers ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const eOut3 = (u) => 1 - Math.pow(1 - u, 3);
  const eIn3 = (u) => u * u * u;
  const eIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const eExpo = (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));
  const eBack = (u) => { const c = 1.4; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  const pad2 = (n) => String(n).padStart(2, '0');
  function rng(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const trace = (type, data) => { if (window.__trace) window.__trace.push(Object.assign({ type }, data)); };
  const anton = (px) => `400 ${px}px Anton`;
  const bc = (w, px) => `${w} ${px}px "Barlow Condensed"`;
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function measure(c, str, font, ls = 0) { c.font = font; c.letterSpacing = ls + 'px'; const w = c.measureText(str).width - ls; c.letterSpacing = '0px'; return w; }
  function fitPx(c, str, fontFn, maxPx, maxW, lsRatio = 0) {
    const w = measure(c, str, fontFn(100), lsRatio * 100);
    return Math.min(maxPx, Math.floor((maxW / w) * 100 * 10) / 10);
  }
  // draws text; letter-spacing aware centring
  function txt(c, str, x, y, o) {
    c.save();
    c.font = o.font; c.letterSpacing = (o.ls || 0) + 'px';
    c.textBaseline = o.base || 'alphabetic';
    const align = o.align || 'center';
    c.textAlign = align;
    let dx = 0; if (o.ls) dx = align === 'center' ? o.ls / 2 : align === 'right' ? o.ls : 0;
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    if (o.shadow) { c.shadowColor = o.shadow; c.shadowBlur = o.blur || 20; c.shadowOffsetY = o.sy || 0; }
    c.fillStyle = o.fill || '#fff';
    c.fillText(str, x + dx, y);
    c.restore();
  }
  function goldGrad(c, y0, y1) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#FFF0A0'); g.addColorStop(0.3, HI); g.addColorStop(0.5, GOLD);
    g.addColorStop(0.56, '#B98A22'); g.addColorStop(0.64, '#E7B531'); g.addColorStop(1, CHAMP);
    return g;
  }
  function silverGrad(c, y0, y1) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.55, '#F1EEE6'); g.addColorStop(1, '#B9B4A6');
    return g;
  }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  // chamfered panel path
  function panelPath(c, x, y, w, h, k) {
    c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h - k); c.lineTo(x + w - k, y + h);
    c.lineTo(x, y + h); c.lineTo(x, y + k); c.closePath();
  }

  // ---------- background & post ----------
  const dR = rng(77);
  const dust = Array.from({ length: 120 }, () => ({ x: dR() * 1200, y: dR() * 2000, z: 0.25 + dR() * 0.75, vx: 4 + dR() * 14, vy: 8 + dR() * 26, tw: 0.6 + dR() * 1.8, ph: dR() * TAU }));
  function background(t, glow, hazeY) {
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    if (glow <= 0) return;
    let g = ctx.createRadialGradient(540, hazeY, 0, 540, hazeY, 1050);
    g.addColorStop(0, `rgba(255,198,26,${0.085 * glow})`); g.addColorStop(0.45, `rgba(200,162,74,${0.03 * glow})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(540, 960); ctx.rotate(-0.52);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 470 + Math.sin(t * 0.11 + i * 2.1) * 160, w = 230 + i * 40;
      g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, 'rgba(255,214,90,0)'); g.addColorStop(0.5, `rgba(255,214,90,${0.03 * glow})`); g.addColorStop(1, 'rgba(255,214,90,0)');
      ctx.fillStyle = g; ctx.fillRect(x - w, -1600, w * 2, 3200);
    }
    ctx.restore();
    for (const p of dust) {
      const x = ((p.x + t * p.vx * p.z) % 1200) - 60, y = ((((p.y - t * p.vy * p.z) % 2000) + 2000) % 2000) - 40;
      const a = 0.55 * p.z * (0.45 + 0.55 * Math.sin(t * p.tw + p.ph)) * glow;
      if (a <= 0.01) continue;
      ctx.fillStyle = `rgba(255,220,130,${a})`;
      ctx.beginPath(); ctx.arc(x, y, 0.8 + p.z * 1.9, 0, TAU); ctx.fill();
    }
  }
  let noiseTiles = [], vignette = null;
  function initPost() {
    const r = rng(9001);
    for (let k = 0; k < 4; k++) {
      const c = mk(256, 256), x = c.getContext('2d'), id = x.createImageData(256, 256);
      for (let i = 0; i < id.data.length; i += 4) { const v = r(); id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = v * v * 5; }
      x.putImageData(id, 0, 0); noiseTiles.push(c);
    }
    vignette = mk(W, H); const v = vignette.getContext('2d');
    const g = v.createRadialGradient(540, 930, 520, 540, 930, 1240);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.82)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
  }
  function post(frame) {
    ctx.drawImage(vignette, 0, 0);
    const tile = noiseTiles[0], ox = 0, oy = 0; void frame; // static dither: hides banding without costing bitrate
    ctx.save(); ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
  }
  function fadeBlack(a) { if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(a)})`; ctx.fillRect(0, 0, W, H); } }
  function goldFlash(a, cx, cy) {
    if (a <= 0.003) return;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1300);
    g.addColorStop(0, `rgba(255,244,190,${a})`); g.addColorStop(0.35, `rgba(255,198,26,${a * 0.55})`); g.addColorStop(1, 'rgba(255,198,26,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  // ---------- crest (the real club crest, only lit — never redrawn) ----------
  const crestOC = mk(459, 640);
  function drawCrest(cx, cy, w, o) {
    const h = w * 640 / 459, light = o.light === undefined ? 1 : o.light, alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    if (o.rays) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.t * 0.05); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        ctx.rotate(TAU / 16);
        const len = w * (1.25 + 0.35 * Math.sin(i * 2.4 + o.t * 0.5));
        const g = ctx.createLinearGradient(0, 0, 0, -len);
        g.addColorStop(0, `rgba(255,198,26,${0.10 * o.rays})`); g.addColorStop(1, 'rgba(255,198,26,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-len * 0.085, -len); ctx.lineTo(len * 0.085, -len); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    const gl = (o.glow === undefined ? 1 : o.glow) * light;
    if (gl > 0) {
      const g = ctx.createRadialGradient(cx, cy, w * 0.15, cx, cy, w * 1.15);
      g.addColorStop(0, `rgba(255,198,26,${0.30 * gl})`); g.addColorStop(0.5, `rgba(200,150,40,${0.10 * gl})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - w * 1.2, cy - w * 1.2, w * 2.4, w * 2.4);
    }
    const c = crestOC.getContext('2d');
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, 459, 640); c.drawImage(crest, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    if (light < 1) { c.fillStyle = `rgba(3,3,3,${1 - light})`; c.fillRect(0, 0, 459, 640); }
    if (o.sweep !== undefined && o.sweep > 0 && o.sweep < 1) {
      const p = lerp(-300, 900, o.sweep), g = c.createLinearGradient(p - 110, 0, p + 110, 220);
      g.addColorStop(0, 'rgba(255,240,180,0)'); g.addColorStop(0.5, 'rgba(255,240,180,0.55)'); g.addColorStop(1, 'rgba(255,240,180,0)');
      c.fillStyle = g; c.fillRect(0, 0, 459, 640);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
    ctx.drawImage(crestOC, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }

  // ---------- text with a travelling metallic light sweep ----------
  const sweepOC = mk(W, 420);
  function sweepText(str, x, y, o, sweep) {
    const c = sweepOC.getContext('2d');
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, 420);
    txt(c, str, x, 300, Object.assign({}, o, { fill: o.gold ? goldGrad(c, 300 - o.px * 0.78, 300 + o.px * 0.04) : silverGrad(c, 300 - o.px * 0.78, 300), alpha: 1 }));
    if (sweep > 0 && sweep < 1) {
      c.globalCompositeOperation = 'source-atop';
      const p = lerp(-200, W + 200, sweep), g = c.createLinearGradient(p - 120, 0, p + 120, 80);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,240,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, 420);
    }
    ctx.save(); ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha;
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.drawImage(sweepOC, 0, y - 300);
    ctx.restore();
  }
  // slam-in line: scales down onto its mark
  function slamLine(str, y, px, t, t0, o) {
    const u = seg(t, t0, t0 + 0.3); if (u <= 0) return;
    const out = o.out ? seg(t, o.out, o.out + 0.3) : 0;
    const s = lerp(1.7, 1, eExpo(u)) * (1 + 0.12 * eIn3(out));
    ctx.save(); ctx.translate(540, y - px * 0.36); ctx.scale(s, s); ctx.translate(-540, -(y - px * 0.36));
    sweepText(str, 540, y, { font: anton(px), px, gold: o.gold, alpha: clamp(u * 3) * (1 - out), ls: o.ls || 0 }, seg(t, t0 + 0.25, t0 + 1.15));
    ctx.restore();
  }

  // ---------- shuttlecock (procedural 3D, painter-sorted) ----------
  const shOC = mk(W, H);
  function shuttlePos(w) { return [-2.2 + 3.0 * w + 0.8 * w * w * w, 0.9 - 1.3 * w - 0.6 * w * w * w, 13 * Math.pow(1 - w, 1.6) + 1.2]; }
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function drawShuttle(t) {
    const p = seg(t, 0.45, 3.3); if (p <= 0 || p >= 1) return;
    const wr = p + 0.105 * Math.sin(TAU * p), w = Math.pow(clamp(wr), 0.78);
    const pos = shuttlePos(w), p2 = shuttlePos(Math.min(1, w + 0.01)), p0 = shuttlePos(Math.max(0, w - 0.01));
    let a = norm([p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]]);
    a = norm([a[0] + 0.05 * Math.sin(t * 2.1), a[1] + 0.04 * Math.cos(t * 1.7), a[2]]);
    const e1 = norm(cross(a, [0.2, 1, 0.1])), e2 = cross(a, e1);
    const f = 2350, CX = 540, CY = 900;
    const P = (d, r, al) => { const c = Math.cos(al), s = Math.sin(al); return [pos[0] - a[0] * d + r * (c * e1[0] + s * e2[0]), pos[1] - a[1] * d + r * (c * e1[1] + s * e2[1]), pos[2] - a[2] * d + r * (c * e1[2] + s * e2[2])]; };
    const S = (v) => [CX + f * v[0] / v[2], CY + f * v[1] / v[2]];
    const rad = (d) => 0.112 + (d - 0.16) * 0.31;
    const L = norm([0.55, -0.7, -0.45]), view = norm(pos);
    const beam = 0.22 + 0.9 * Math.exp(-Math.pow((w - 0.6) / 0.24, 2)) + 0.5 * seg(w, 0.8, 1);
    const spin = t * 2.6 + 0.4;
    const c = shOC.getContext('2d'); c.clearRect(0, 0, W, H); c.lineJoin = 'round'; c.lineCap = 'round';
    const px = f / pos[2];
    const drawCork = () => {
      const cc = [pos[0] - a[0] * 0.05, pos[1] - a[1] * 0.05, pos[2] - a[2] * 0.05], s = S(cc), r = 0.122 * f / cc[2];
      // base collar
      c.fillStyle = `rgba(${Math.round(150 * beam)},${Math.round(112 * beam)},${Math.round(30 * beam)},1)`;
      c.beginPath(); for (let i = 0; i <= 24; i++) { const q = S(P(0.165, 0.118, i / 24 * TAU)); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.fill();
      const g = c.createRadialGradient(s[0] + r * 0.35, s[1] - r * 0.45, r * 0.05, s[0], s[1], r);
      const b = clamp(beam, 0, 1.4);
      g.addColorStop(0, `rgb(${Math.min(255, 255 * b)},${Math.min(255, 250 * b)},${Math.min(255, 228 * b)})`);
      g.addColorStop(0.55, `rgb(${Math.min(255, 236 * b)},${Math.min(255, 208 * b)},${Math.min(255, 140 * b)})`);
      g.addColorStop(1, `rgb(${Math.round(96 * b)},${Math.round(70 * b)},${Math.round(26 * b)})`);
      c.fillStyle = g; c.beginPath(); c.arc(s[0], s[1], r, 0, TAU); c.fill();
    };
    const N = 16, fe = [];
    for (let i = 0; i < N; i++) { const al = spin + i * TAU / N; fe.push({ al, z: P(0.6, rad(0.6), al)[2] }); }
    fe.sort((x, y) => y.z - x.z);
    if (a[2] > 0) drawCork();
    for (const q of fe) {
      const al = q.al, n = [Math.cos(al) * e1[0] + Math.sin(al) * e2[0], Math.cos(al) * e1[1] + Math.sin(al) * e2[1], Math.cos(al) * e1[2] + Math.sin(al) * e2[2]];
      const outer = dot(n, view) < 0, lam = Math.max(0, dot(n, L));
      const I = (outer ? 0.42 + 0.85 * lam : 0.3 + 0.45 * lam) * beam;
      const col = `rgb(${Math.min(255, Math.round(255 * I))},${Math.min(255, Math.round(238 * I))},${Math.min(255, Math.round(196 * I + 30 * I * I))})`;
      const pts = [P(0.40, rad(0.40), al - 0.13), P(0.84, rad(0.84), al - 0.215), P(0.905, rad(0.905), al - 0.1), P(0.92, rad(0.92), al), P(0.905, rad(0.905), al + 0.1), P(0.84, rad(0.84), al + 0.215), P(0.40, rad(0.40), al + 0.13)].map(S);
      c.fillStyle = col; c.beginPath(); pts.forEach((s, i) => (i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]))); c.closePath(); c.fill();
      c.strokeStyle = `rgba(20,14,4,${0.55})`; c.lineWidth = Math.max(0.6, px * 0.004); c.stroke();
      const s0 = S(P(0.15, rad(0.16), al)), s1 = S(P(0.9, rad(0.9), al));
      c.strokeStyle = `rgba(${Math.min(255, Math.round(250 * I + 30))},${Math.min(255, Math.round(215 * I + 20))},${Math.round(120 * I)},1)`;
      c.lineWidth = Math.max(1, px * 0.011); c.beginPath(); c.moveTo(s0[0], s0[1]); c.lineTo(s1[0], s1[1]); c.stroke();
    }
    for (const d of [0.3, 0.4]) {
      c.strokeStyle = `rgba(255,214,110,${0.28 * clamp(beam)})`; c.lineWidth = Math.max(1, px * 0.005);
      c.beginPath(); for (let i = 0; i <= 48; i++) { const s = S(P(d, rad(d) + 0.004, i / 48 * TAU)); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); } c.stroke();
    }
    if (a[2] <= 0) drawCork();
    // light trail behind the shuttle
    const sn = S(pos), sb = S(P(2.6, 0, 0));
    const fadeA = clamp(p * 6) * (1 - seg(p, 0.93, 1));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(sn[0], sn[1], sb[0], sb[1]);
    g.addColorStop(0, `rgba(255,205,70,${0.22 * beam * fadeA})`); g.addColorStop(1, 'rgba(255,198,26,0)');
    ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineWidth = px * 0.5; ctx.filter = `blur(${Math.round(10 + px * 0.06)}px)`;
    ctx.beginPath(); ctx.moveTo(sn[0], sn[1]); ctx.lineTo(sb[0], sb[1]); ctx.stroke();
    ctx.filter = 'none'; ctx.restore();
    ctx.save(); ctx.globalAlpha = fadeA;
    const mb = seg(w, 0.82, 1) * 26;
    if (mb > 1) ctx.filter = `blur(${mb.toFixed(1)}px)`;
    ctx.drawImage(shOC, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * fadeA * clamp(beam); ctx.filter = `blur(${Math.round(14 + px * 0.05)}px)`;
    ctx.drawImage(shOC, 0, 0);
    ctx.restore();
  }

  // ---------- SCENE 1: cinematic opening ----------
  function scene1(t) {
    const glow = seg(t, 0.3, 2.2);
    background(t, glow * 0.9, 760);
    // key light shaft
    const shaft = seg(t, 0.35, 1.2) * (1 - seg(t, 3.0, 3.6));
    if (shaft > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(980, -80); ctx.rotate(0.62);
      const g = ctx.createLinearGradient(-260, 0, 260, 0);
      g.addColorStop(0, 'rgba(255,198,26,0)'); g.addColorStop(0.5, `rgba(255,205,80,${0.13 * shaft})`); g.addColorStop(1, 'rgba(255,198,26,0)');
      ctx.fillStyle = g; ctx.fillRect(-260, -200, 520, 2600); ctx.restore();
    }
    drawShuttle(t);
    goldFlash(0.9 * Math.exp(-Math.pow((t - 0.38) / 0.12, 2)) * 0.25, 540, 800);
    const fl = t < 3.3 ? seg(t, 3.02, 3.3) : Math.exp(-(t - 3.3) * 3.2);
    const out = seg(t, 6.95, 7.4);
    const zoom = 1 + 0.07 * eIn3(out);
    ctx.save(); ctx.translate(540, 900); ctx.scale(zoom, zoom); ctx.translate(-540, -900 + 70);
    if (t > 3.2) {
      const u = seg(t, 3.25, 4.7), sc = lerp(1.16, 1, eExpo(seg(t, 3.25, 4.4))) * (1 + 0.035 * seg(t, 4.4, 7.4));
      drawCrest(540, 520, 500 * sc, { light: lerp(0.05, 1, eOut3(u)), sweep: seg(t, 4.5, 5.6), rays: eOut3(u) * 0.8, t, glow: 1 });
    }
    // title
    const pxP = fitPx(ctx, 'PEMBERANI', anton, 230, 900);
    const u1 = seg(t, 4.3, 4.75);
    if (u1 > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 1100 - pxP * 0.95 * eExpo(u1) - 4, W, pxP * 0.95 * eExpo(u1) + 30); ctx.clip();
      sweepText('PEMBERANI', 540, 1100 + 40 * (1 - eExpo(u1)), { font: anton(pxP), px: pxP, gold: true, alpha: 1 }, seg(t, 4.7, 5.7));
      ctx.restore();
    }
    const u2 = seg(t, 4.6, 5.1);
    if (u2 > 0) { const ls = lerp(60, 24, eExpo(u2)); const px = fitPx(ctx, 'TOURNAMENT', anton, 96, 900 - 9 * 24); txt(ctx, 'TOURNAMENT', 540, 1212, { font: anton(px), ls, fill: silverGrad(ctx, 1140, 1212), alpha: eOut3(u2), shadow: 'rgba(0,0,0,.9)' }); }
    const u3 = seg(t, 5.0, 5.4);
    if (u3 > 0) {
      const e = eExpo(u3), s = lerp(1.5, 1, e);
      ctx.save(); ctx.translate(540, 1332); ctx.scale(s, s); ctx.globalAlpha = clamp(u3 * 3);
      ctx.fillStyle = goldGrad(ctx, -46, 46); rrect(ctx, -190, -48, 380, 96, 6); ctx.fill();
      txt(ctx, 'EDISI 3.0', 0, 4, { font: anton(70), ls: 6, fill: '#0a0a0a', base: 'middle' });
      ctx.restore();
    }
    const u4 = seg(t, 5.9, 6.5);
    if (u4 > 0) {
      const e = eExpo(u4), lw = 430 * e;
      ctx.fillStyle = `rgba(255,198,26,${0.9 * e})`; ctx.fillRect(540 - lw, 1452, lw * 2, 2); ctx.fillRect(540 - lw, 1540, lw * 2, 2);
      txt(ctx, 'THE OFFICIAL GROUP DRAW', 540, 1512, { font: bc(600, 50), ls: lerp(26, 11, e), fill: '#fff', alpha: eOut3(u4) });
    }
    ctx.restore();
    goldFlash(fl * 0.85, 540, 690);
    fadeBlack(Math.max(1 - seg(t, 0.1, 0.5), out));
  }

  // ---------- stage (wheel, plate, reel, boards) ----------
  const WH = { cx: 540, cy: 592, R: 392, disc: 360, hub: 112, rIn: 128, rOut: 348 };
  const face = mk(760, 760); let faceKey = '';
  let tickTimes = [];
  function uniformEntries(pool) { const n = pool.length, s = TAU / n; return pool.map((p, i) => ({ id: p.id, name: p.name, a0: i * s, a1: (i + 1) * s })); }
  function wheelFont(entries) {
    let px = 54;
    for (const e of entries) px = Math.min(px, fitPx(ctx, e.name, (p) => bc(600, p), 54, WH.rOut - WH.rIn - 10));
    const minSeg = Math.min(...entries.map((e) => e.a1 - e.a0));
    return Math.min(px, Math.max(18, minSeg * 150 * 0.62));
  }
  function wedge(c, a0, a1, r0, r1) { c.beginPath(); c.arc(0, 0, r1, a0, a1); c.arc(0, 0, r0, a1, a0, true); c.closePath(); }
  function buildFace(entries, px, vis) {
    const key = entries.map((e) => e.id + ':' + e.a0.toFixed(4) + ':' + e.a1.toFixed(4)).join('|') + '#' + px.toFixed(2) + '#' + vis.toFixed(3);
    if (key === faceKey) return; faceKey = key;
    const c = face.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 760, 760); c.translate(380, 380);
    c.fillStyle = '#060606'; c.beginPath(); c.arc(0, 0, WH.disc, 0, TAU); c.fill();
    entries.forEach((e, i) => {
      const wd = e.a1 - e.a0; if (wd < 0.004) return;
      const g = c.createRadialGradient(0, 0, WH.hub, 0, 0, WH.disc);
      if (e.id % 2) { g.addColorStop(0, '#231c0c'); g.addColorStop(1, '#0d0a04'); } else { g.addColorStop(0, '#171717'); g.addColorStop(1, '#080808'); }
      wedge(c, e.a0, e.a1, WH.hub - 4, WH.disc); c.fillStyle = g; c.fill();
    });
    if (entries.length > 1) entries.forEach((e) => {
      if (e.a1 - e.a0 < 0.004) return;
      c.save(); c.rotate(e.a0);
      const g = c.createLinearGradient(WH.hub, 0, WH.disc, 0); g.addColorStop(0, 'rgba(200,162,74,0.25)'); g.addColorStop(1, 'rgba(255,198,26,0.95)');
      c.fillStyle = g; c.fillRect(WH.hub, -1.25, WH.disc - WH.hub, 2.5);
      c.fillStyle = HI; c.beginPath(); c.arc(WH.disc - 9, 0, 4, 0, TAU); c.fill();
      c.restore();
    });
    entries.forEach((e, i) => {
      const wd = e.a1 - e.a0; const a = Math.min(clamp(wd / 0.2), clamp(vis - i));
      if (a <= 0.01) return;
      c.save(); c.rotate((e.a0 + e.a1) / 2); c.globalAlpha = a;
      txt(c, e.name, (WH.rIn + WH.rOut) / 2 + (1 - clamp(vis - i)) * 30, 1, { font: bc(600, px), fill: IVORY, base: 'middle', shadow: 'rgba(0,0,0,.8)', blur: 6 });
      c.restore();
    });
    // rotating trim
    c.strokeStyle = 'rgba(255,198,26,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, WH.disc - 20, 0, TAU); c.stroke();
    c.lineWidth = 3; c.strokeStyle = CHAMP; c.beginPath(); c.arc(0, 0, WH.disc - 1.5, 0, TAU); c.stroke();
  }
  function wheelPhi(t) {
    if (t <= T.s3) return T.phiStart - (T.s3 - t) * 0.1;
    for (const s of T.selections) {
      if (t < s.end || s.k === T.selections.length - 1) {
        if (t <= s.spinStart) return s.phi0;
        if (t >= s.spinEnd) return s.phi1;
        return s.phi0 + (s.phi1 - s.phi0) * T.spinEase((t - s.spinStart) / (s.spinEnd - s.spinStart));
      }
    }
    return 0;
  }
  function currentSel(t) { if (t < T.s3) return null; for (const s of T.selections) if (t < s.end) return s; return T.selections[T.selections.length - 1]; }

  function drawWheel(t, appear) {
    const { cx, cy, R, disc, hub } = WH;
    const s = currentSel(t);
    // layout
    let entries, hl = null, remaining;
    if (!s) { entries = uniformEntries(T.initialPool); remaining = 12; }
    else {
      const old = uniformEntries(s.pool), u = eIO(seg(t, s.reflow0, s.reflow1));
      remaining = t < s.reflow0 ? s.n : s.n - 1;
      if (u <= 0) entries = old;
      else {
        const m = s.n - 1, ns = m > 0 ? TAU / m : 0;
        entries = old.map((e, i) => {
          const j = i < s.j ? i : i - 1;
          const b0 = i === s.j ? s.j * ns : j * ns, b1 = i === s.j ? s.j * ns : (j + 1) * ns;
          return { id: e.id, name: e.name, a0: lerp(e.a0, m > 0 ? b0 : (e.a0 + e.a1) / 2, u), a1: lerp(e.a1, m > 0 ? b1 : (e.a0 + e.a1) / 2, u), sel: i === s.j };
        });
      }
      if (t >= s.spinEnd && t < s.reflow1) { const e = entries[s.j]; hl = { a0: e.a0, a1: e.a1, name: s.name, since: t - s.spinEnd, fade: 1 - seg(t, s.reflow0, s.reflow1) }; }
      if (t >= s.reflow1) entries = entries.filter((e, i) => i !== s.j);
      else if (t >= s.spinEnd) entries = entries.map((e, i) => (i === s.j ? Object.assign({}, e, { hidden: true }) : e));
    }
    const live = entries.filter((e) => e.a1 - e.a0 > 0.004);
    const px = live.length ? wheelFont(live.filter((e) => !e.hidden).length ? live.filter((e) => !e.hidden) : live) : 40;
    const vis = t < T.s3 ? clamp((t - (T.wheelIn + 0.2)) / 0.09, 0, 12.99) : 99;
    buildFace(entries, px, vis);
    const phi = wheelPhi(t);
    const sc = lerp(0.72, 1, eBack(appear));
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.globalAlpha = clamp(appear * 2.5);
    // ambient glow + floor shadow
    let g = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R * 1.5);
    g.addColorStop(0, 'rgba(255,198,26,0.20)'); g.addColorStop(1, 'rgba(255,198,26,0)');
    ctx.fillStyle = g; ctx.fillRect(-R * 1.5, -R * 1.5, R * 3, R * 3);
    // bezel
    const cg = ctx.createConicGradient(-0.6, 0, 0);
    ['#FFE45C', '#C8A24A', '#6b4f14', '#C8A24A', '#FFF0A0', '#FFC61A', '#7a5a16', '#C8A24A', '#FFE45C', '#8a6a1e', '#FFC61A', '#FFE45C'].forEach((c, i, a) => cg.addColorStop(i / (a.length - 1), c));
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R - 5, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.arc(0, 0, disc + 3, 0, TAU); ctx.fill();
    // bezel lamps
    const spinning = s && t > s.spinStart && t < s.spinEnd, landed = s && t >= s.spinEnd && t < s.spinEnd + 0.9;
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * TAU - Math.PI / 2, x = Math.cos(a) * (R - 15.5), y = Math.sin(a) * (R - 15.5);
      let on = 0.25;
      if (spinning) { const d = ((i / 36 * TAU - phi * 0.5) % TAU + TAU) % TAU; on = 0.25 + 0.75 * Math.pow(Math.max(0, Math.cos(d * 3)), 6); }
      else if (landed) on = 0.35 + 0.65 * Math.abs(Math.cos((t - s.spinEnd) * 9)) * (1 - (t - s.spinEnd) / 0.9);
      else on = 0.3 + 0.12 * Math.sin(t * 2 + i * 0.7);
      on *= clamp(appear * 3 - 1.2 - i * 0.02 + 0.6);
      ctx.fillStyle = '#1a1204'; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,${Math.round(225 + 25 * on)},${Math.round(120 + 110 * on)},${0.25 + 0.75 * on})`;
      if (on > 0.6) { ctx.shadowColor = GOLD; ctx.shadowBlur = 14 * on; }
      ctx.beginPath(); ctx.arc(x, y, 4.2, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    // disc with motion blur
    const dt = 0.5 / 30, om = Math.abs(wheelPhi(t + dt / 2) - wheelPhi(t - dt / 2));
    const M = om * disc > 3 ? Math.min(12, Math.ceil(om * disc / 5)) : 1;
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, disc, 0, TAU); ctx.clip();
    const baseAlpha = ctx.globalAlpha;
    for (let i = 0; i < M; i++) {
      const ph = M === 1 ? phi : wheelPhi(t + (i / (M - 1) - 0.5) * dt);
      ctx.save(); ctx.rotate(ph); ctx.globalAlpha = baseAlpha / (i + 1); ctx.drawImage(face, -380, -380); ctx.restore();
    }
    // selected segment highlight
    if (hl && hl.a1 - hl.a0 > 0.004) {
      ctx.save(); ctx.rotate(phi); ctx.globalAlpha = baseAlpha * hl.fade;
      const flash = Math.exp(-hl.since * 7), pulse = 0.5 + 0.5 * Math.cos(hl.since * 14);
      const gg = ctx.createRadialGradient(0, 0, hub, 0, 0, disc);
      gg.addColorStop(0, '#C8A24A'); gg.addColorStop(0.6, GOLD); gg.addColorStop(1, HI);
      wedge(ctx, hl.a0, hl.a1, hub - 4, disc); ctx.fillStyle = gg; ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${(0.75 * flash + 0.12 * pulse) * clamp(0.55 / (hl.a1 - hl.a0), 0.15, 1)})`; ctx.fill();
      ctx.rotate((hl.a0 + hl.a1) / 2);
      const hpx = Math.min(fitPx(ctx, hl.name, (p) => bc(700, p), 60, WH.rOut - WH.rIn), Math.max(18, (hl.a1 - hl.a0) * 150 * 0.7));
      txt(ctx, hl.name, (WH.rIn + WH.rOut) / 2, 1, { font: bc(700, hpx), fill: '#0a0803', base: 'middle' });
      ctx.restore();
      trace('wheelHighlight', { k: s.k, name: hl.name });
    }
    // depth shading & gloss
    g = ctx.createRadialGradient(0, 0, hub, 0, 0, disc);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.18, 'rgba(0,0,0,0)'); g.addColorStop(0.86, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g; ctx.fillRect(-disc, -disc, disc * 2, disc * 2);
    g = ctx.createLinearGradient(-disc, -disc, disc * 0.3, disc * 0.6);
    g.addColorStop(0, 'rgba(255,255,255,0.075)'); g.addColorStop(0.5, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = g; ctx.fillRect(-disc, -disc, disc * 2, disc * 2);
    ctx.restore();
    // which entry is geometrically under the pointer once the wheel has stopped
    if (s && t >= s.spinEnd && t < s.reflow0) {
      const a = (((T.POINTER - phi) % TAU) + TAU) % TAU, under = uniformEntries(s.pool).find((e) => a >= e.a0 && a < e.a1);
      trace('pointerEntry', { k: s.k, name: under ? under.name : null });
    }
    // hub
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 30;
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, hub, 0, TAU); ctx.fill(); ctx.restore();
    g = ctx.createRadialGradient(0, -30, 10, 0, 0, hub - 10); g.addColorStop(0, '#1b1b1b'); g.addColorStop(1, '#050505');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, hub - 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,198,26,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, hub - 18, 0, TAU); ctx.stroke();
    const pop = s && t >= s.reflow0 ? 1 + 0.35 * Math.exp(-(t - s.reflow0) * 9) : 1;
    ctx.save(); ctx.translate(0, 18); ctx.scale(pop, pop);
    txt(ctx, String(remaining), 0, 0, { font: anton(96), fill: goldGrad(ctx, -74, 4) });
    ctx.restore();
    txt(ctx, remaining === 1 ? 'PAIR LEFT' : 'PAIRS LEFT', 0, 52, { font: bc(600, 21), ls: 4, fill: 'rgba(243,234,211,0.8)' });
    // pointer
    let lastTick = -9; for (const tt of tickTimes) { if (tt <= t) lastTick = tt; else break; }
    const kick = spinning ? -0.3 * Math.exp(-(t - lastTick) * 26) : 0;
    ctx.save(); ctx.translate(0, -R - 26); ctx.rotate(kick);
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
    g = ctx.createLinearGradient(-34, 0, 34, 0); g.addColorStop(0, '#8a6a1e'); g.addColorStop(0.35, HI); g.addColorStop(0.5, '#FFF6C4'); g.addColorStop(0.7, GOLD); g.addColorStop(1, '#8a6a1e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-34, -14); ctx.lineTo(34, -14); ctx.lineTo(0, 78); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(0, 4, 9, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  const PLATE = { x: 40, y: 1014, w: 1000, h: 172, cy: 1112 };
  function plateFont(name) { return fitPx(ctx, name, (p) => bc(700, p), 96, 900); }
  function drawPlate(t, appear) {
    if (appear <= 0) return;
    const s = currentSel(t), P = PLATE;
    ctx.save(); ctx.globalAlpha = appear;
    const shown = s && t >= s.plateAt, since = shown ? t - s.plateAt : 0;
    const flash = shown ? Math.exp(-since * 5) : 0;
    panelPath(ctx, P.x, P.y, P.w, P.h, 26);
    let g = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); g.addColorStop(0, 'rgba(26,24,18,0.96)'); g.addColorStop(1, 'rgba(8,8,8,0.96)');
    ctx.fillStyle = g; ctx.fill();
    if (flash > 0.01) { ctx.fillStyle = `rgba(255,198,26,${0.28 * flash})`; ctx.fill(); }
    ctx.strokeStyle = `rgba(255,${Math.round(198 + 40 * flash)},${Math.round(26 + 150 * flash)},${0.55 + 0.45 * flash})`; ctx.lineWidth = 2 + 2 * flash; ctx.stroke();
    ctx.fillStyle = GOLD; ctx.fillRect(P.x, P.y + 26, 5, P.h - 26);
    const k = s ? s.k : 0;
    txt(ctx, `PAIR ${pad2(k + 1)} / 12`, P.x + 28, P.y + 36, { font: bc(600, 22), ls: 4, align: 'left', fill: CHAMP });
    const gone = s && t >= s.flyStart;
    if (shown && !gone) {
      txt(ctx, 'DRAWN', P.x + P.w - 28, P.y + 36, { font: bc(700, 22), ls: 4, align: 'right', fill: GOLD });
      const u = eExpo(seg(since, 0, 0.4)), px = plateFont(s.name), wd = measure(ctx, s.name, bc(700, px));
      ctx.save(); ctx.beginPath(); ctx.rect(540 - (wd / 2 + 30) * u, P.y, (wd + 60) * u, P.h); ctx.clip();
      const sc = lerp(1.18, 1, u); ctx.translate(540, P.cy + 8); ctx.scale(sc, sc);
      txt(ctx, s.name, 0, 0, { font: bc(700, px), fill: silverGrad(ctx, -px * 0.5, px * 0.4), base: 'middle', shadow: `rgba(255,198,26,${0.5 * flash + 0.15})`, blur: 26 });
      ctx.restore();
      const lw = (wd / 2) * eExpo(seg(since, 0.1, 0.55));
      ctx.fillStyle = GOLD; ctx.fillRect(540 - lw, P.y + P.h - 26, lw * 2, 3);
      trace('plate', { k: s.k, name: s.name });
    } else if (!gone) {
      const spin = s && t > s.spinStart && t < s.spinEnd;
      const dots = '.'.repeat(1 + (Math.floor(t * 4) % 3));
      txt(ctx, s ? (spin ? 'DRAWING' : 'NEXT PAIR') : 'THE DRAW BEGINS', 540, P.cy + 8, { font: anton(54), ls: 10, base: 'middle', fill: `rgba(200,162,74,${spin ? 0.55 + 0.25 * Math.sin(t * 12) : 0.5})` });
      void dots;
    } else {
      txt(ctx, `ALLOCATED TO GROUP ${s.group}`, 540, P.cy + 8, { font: anton(46), ls: 8, base: 'middle', fill: 'rgba(200,162,74,0.4)', alpha: seg(t, s.flyStart + 0.1, s.flyEnd) });
    }
    ctx.restore();
  }

  const REEL = { cx: 540, cy: 1262, w: 136, h: 106 };
  function reelState(t) {
    const s = currentSel(t);
    if (!s) return { p: 0, mode: 'idle', s: null };
    if (t < s.reelStart) return { p: s.reel0, mode: 'idle', s };
    if (t < s.reelEnd) return { p: s.reel0 + (s.reel1 - s.reel0) * T.reelEase((t - s.reelStart) / (s.reelEnd - s.reelStart)), mode: 'spin', s };
    return { p: s.reel1, mode: 'done', s };
  }
  function drawReel(t, appear) {
    if (appear <= 0) return;
    const R = REEL, st = reelState(t), s = st.s;
    ctx.save(); ctx.globalAlpha = appear;
    const letterNow = (((Math.round(st.p) % 2) + 2) % 2) === 0 ? 'A' : 'B';
    const since = s && st.mode === 'done' ? t - s.reelEnd : 0;
    const flash = st.mode === 'done' ? Math.exp(-since * 4.5) : 0;
    // lamps
    for (const G of ['A', 'B']) {
      const x = G === 'A' ? 226 : 854;
      let lit = 0.16;
      if (st.mode === 'spin') lit = letterNow === G ? 0.85 : 0.16;
      if (st.mode === 'done') lit = s.group === G ? 1 : 0.12;
      const on = lit > 0.5;
      txt(ctx, 'GROUP ' + G, x, R.cy + 22, { font: anton(60), ls: 3, fill: on ? goldGrad(ctx, R.cy - 26, R.cy + 24) : `rgba(200,162,74,${lit + 0.08})`, shadow: on ? `rgba(255,198,26,${0.5 + 0.4 * flash})` : undefined, blur: 24 + 30 * flash });
      // chevrons pointing from reel to lamp
      for (let i = 0; i < 3; i++) {
        const dir = G === 'A' ? -1 : 1, cx = R.cx + dir * (98 + i * 20);
        const a = st.mode === 'done' && s.group === G ? clamp(0.35 + 0.65 * Math.cos(since * 9 - i * 0.9)) : (on ? 0.6 : 0.14);
        ctx.strokeStyle = `rgba(255,198,26,${a})`; ctx.lineWidth = 4; ctx.lineJoin = 'miter';
        ctx.beginPath(); ctx.moveTo(cx - dir * 7, R.cy - 14); ctx.lineTo(cx + dir * 7, R.cy); ctx.lineTo(cx - dir * 7, R.cy + 14); ctx.stroke();
      }
    }
    // window
    const x0 = R.cx - R.w / 2, y0 = R.cy - R.h / 2;
    rrect(ctx, x0 - 6, y0 - 6, R.w + 12, R.h + 12, 12);
    let g = ctx.createLinearGradient(0, y0 - 6, 0, y0 + R.h + 6); g.addColorStop(0, HI); g.addColorStop(0.5, '#8a6a1e'); g.addColorStop(1, GOLD);
    ctx.fillStyle = g; ctx.save(); ctx.shadowColor = `rgba(255,198,26,${0.25 + 0.6 * flash})`; ctx.shadowBlur = 30; ctx.fill(); ctx.restore();
    rrect(ctx, x0, y0, R.w, R.h, 8); ctx.fillStyle = '#070707'; ctx.fill();
    ctx.save(); rrect(ctx, x0, y0, R.w, R.h, 8); ctx.clip();
    const dim = st.mode === 'idle' ? 0.22 : 1;
    const speed = st.mode === 'spin' ? Math.abs(reelState(t + 0.008).p - reelState(t - 0.008).p) / 0.016 : 0;
    const M = speed > 3 ? 5 : 1;
    for (let m = 0; m < M; m++) {
      const p = M === 1 ? st.p : reelState(t + (m / (M - 1) - 0.5) / 60).p;
      ctx.save(); ctx.globalAlpha *= dim / (m + 1);
      for (let i = Math.floor(p) - 1; i <= Math.floor(p) + 2; i++) {
        const L = (((i % 2) + 2) % 2) === 0 ? 'A' : 'B', y = R.cy + (i - p) * 112 + 34;
        txt(ctx, L, R.cx, y, { font: anton(92), fill: goldGrad(ctx, y - 72, y + 2) });
      }
      ctx.restore();
    }
    g = ctx.createLinearGradient(0, y0, 0, y0 + R.h);
    g.addColorStop(0, 'rgba(0,0,0,0.92)'); g.addColorStop(0.3, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, R.w, R.h);
    if (flash > 0.02) { ctx.fillStyle = `rgba(255,240,170,${0.35 * flash})`; ctx.fillRect(x0, y0, R.w, R.h); }
    ctx.restore();
    // caption
    let cap = 'GROUP ALLOCATION', capA = 0.55;
    if (s && st.mode === 'spin') cap = 'GROUP ALLOCATION  ·  RANDOM';
    if (s && st.mode === 'done') { cap = s.auto ? `GROUP ${s.group === 'A' ? 'B' : 'A'} IS FULL  ·  AUTO-ASSIGNED TO GROUP ${s.group}` : `RANDOM ALLOCATION  ·  GROUP ${s.group}`; capA = 0.95; trace('reel', { k: s.k, letter: letterNow, group: s.group, auto: s.auto }); }
    txt(ctx, cap, 540, 1342, { font: bc(600, 23), ls: 5, fill: `rgba(243,234,211,${capA})` });
    ctx.restore();
  }

  const BRD = { y: 1366, hh: 72, rh: 66, w: 488, xA: 40, xB: 552, namePx: 38 };
  const rowY = (i) => BRD.y + BRD.hh + 4 + i * BRD.rh;
  function boardNamePx(name) { return fitPx(ctx, name, (p) => bc(600, p), BRD.namePx, BRD.w - 60); }
  function drawBoards(t, appear) {
    if (appear <= 0) return;
    const s = currentSel(t);
    ctx.save(); ctx.globalAlpha = appear; ctx.translate(0, (1 - eOut3(appear)) * 90);
    for (const G of ['A', 'B']) {
      const x = G === 'A' ? BRD.xA : BRD.xB, h = BRD.hh + 6 * BRD.rh + 12;
      const picked = s && s.group === G && t >= s.reelEnd && t < s.end ? Math.exp(-(t - s.reelEnd) * 3) : 0;
      panelPath(ctx, x, BRD.y, BRD.w, h, 18);
      let g = ctx.createLinearGradient(0, BRD.y, 0, BRD.y + h); g.addColorStop(0, 'rgba(22,20,15,0.96)'); g.addColorStop(1, 'rgba(7,7,7,0.96)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = `rgba(255,198,26,${0.32 + 0.68 * picked})`; ctx.lineWidth = 1.5 + 2 * picked; ctx.stroke();
      // header
      ctx.save(); panelPath(ctx, x, BRD.y, BRD.w, h, 18); ctx.clip();
      g = ctx.createLinearGradient(x, 0, x + BRD.w, 0); g.addColorStop(0, `rgba(255,198,26,${0.95})`); g.addColorStop(1, `rgba(200,162,74,0.9)`);
      ctx.fillStyle = g; ctx.fillRect(x, BRD.y, BRD.w, BRD.hh);
      if (picked > 0.02) { ctx.fillStyle = `rgba(255,255,255,${0.6 * picked})`; ctx.fillRect(x, BRD.y, BRD.w, BRD.hh); }
      ctx.restore();
      txt(ctx, 'GROUP ' + G, x + 24, BRD.y + 53, { font: anton(44), ls: 2, align: 'left', fill: '#0a0803' });
      const filled = T.selections.filter((q) => q.group === G && q.flyEnd <= t);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i < filled.length ? '#0a0803' : 'rgba(10,8,3,0.22)'; ctx.fillRect(x + BRD.w - 24 - (6 - i) * 24 + 4, BRD.y + 30, 18, 12); }
      for (let i = 0; i < 6; i++) {
        const y = rowY(i), q = filled.find((f) => f.slot === i);
        if (i > 0) { ctx.fillStyle = 'rgba(200,162,74,0.16)'; ctx.fillRect(x + 20, y, BRD.w - 40, 1); }
        if (q) {
          const since = t - q.flyEnd, fl = Math.exp(-since * 4);
          if (fl > 0.02) { ctx.fillStyle = `rgba(255,198,26,${0.5 * fl})`; ctx.fillRect(x + 2, y + 2, BRD.w - 4, BRD.rh - 3); }
          ctx.fillStyle = GOLD; ctx.fillRect(x + 20, y + 20, 4, BRD.rh - 40);
          txt(ctx, q.name, x + 40, y + BRD.rh / 2 + 2, { font: bc(600, boardNamePx(q.name)), align: 'left', base: 'middle', fill: IVORY });
          trace('boardRow', { group: G, slot: i, name: q.name });
        } else {
          ctx.fillStyle = 'rgba(200,162,74,0.22)'; ctx.fillRect(x + 20, y + 20, 4, BRD.rh - 40);
          ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(x + 40, y + BRD.rh / 2 - 5, 200 - i * 14, 10);
        }
      }
    }
    ctx.restore();
  }
  function drawFly(t) {
    const s = currentSel(t); if (!s || t < s.flyStart || t >= s.flyEnd) return;
    const u = eIO(seg(t, s.flyStart, s.flyEnd));
    const px0 = plateFont(s.name), px1 = boardNamePx(s.name);
    const w1 = measure(ctx, s.name, bc(600, px1));
    const x1 = (s.group === 'A' ? BRD.xA : BRD.xB) + 40 + w1 / 2, y1 = rowY(s.slot) + BRD.rh / 2 + 2;
    for (let g = 4; g >= 0; g--) {
      const uu = clamp(u - g * 0.045), x = lerp(540, x1, uu), y = lerp(PLATE.cy + 8, y1, uu) - Math.sin(uu * Math.PI) * 26, px = lerp(px0, px1, uu);
      txt(ctx, s.name, x, y, { font: bc(g ? 600 : 700, px), base: 'middle', fill: g ? GOLD : '#fff', alpha: g ? 0.16 : 1, shadow: g ? undefined : 'rgba(255,198,26,0.9)', blur: 28 });
    }
  }
  function drawStageHeader(t, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    drawCrest(92, 100, 88, { glow: 0.5 });
    txt(ctx, 'PEMBERANI TOURNAMENT', 152, 100, { font: anton(46), ls: 1.5, align: 'left', fill: silverGrad(ctx, 62, 100) });
    txt(ctx, 'EDISI 3.0  ·  THE OFFICIAL GROUP DRAW', 153, 138, { font: bc(600, 24), ls: 4.2, align: 'left', fill: GOLD });
    const s = currentSel(t), done = T.selections.filter((q) => q.flyEnd <= t).length;
    txt(ctx, 'ALLOCATED', 1040, 74, { font: bc(600, 20), ls: 4, align: 'right', fill: CHAMP });
    txt(ctx, pad2(done), 986, 138, { font: anton(60), align: 'right', fill: goldGrad(ctx, 92, 138) });
    txt(ctx, '/12', 1040, 138, { font: anton(34), align: 'right', fill: 'rgba(243,234,211,0.6)' });
    void s;
    ctx.restore();
  }
  function shake(t) {
    let x = 0, y = 0;
    for (const s of T.selections) {
      for (const [tt, amp] of [[s.spinEnd, 7], [s.reelEnd, s.auto ? 3 : 5]]) {
        const d = t - tt; if (d >= 0 && d < 0.4) { const e = Math.exp(-d * 13) * amp; x += e * Math.sin(d * 85); y += e * Math.cos(d * 71); }
      }
    }
    return [x, y];
  }
  function stage(t) {
    const exit = seg(t, T.s4 - 0.05, T.s4 + 0.5), ex = 1 - eIn3(exit);
    const inW = seg(t, T.wheelIn, T.wheelIn + 1.0), inB = seg(t, T.wheelIn + 0.7, T.wheelIn + 1.5), inP = seg(t, T.wheelIn + 1.1, T.wheelIn + 1.8);
    const [sx, sy] = shake(t);
    ctx.save(); ctx.translate(sx, sy);
    if (exit > 0) { ctx.translate(540, 960); ctx.scale(1 - 0.06 * eIn3(exit), 1 - 0.06 * eIn3(exit)); ctx.translate(-540, -960); }
    ctx.globalAlpha = ex;
    drawStageHeader(t, seg(t, T.wheelIn + 0.1, T.wheelIn + 0.8));
    // beam from pointer to plate on reveal
    const s = currentSel(t);
    drawBoards(t, inB);
    drawWheel(t, inW);
    drawPlate(t, eOut3(inP));
    drawReel(t, eOut3(inP));
    drawFly(t);
    ctx.restore();
    // landing light pop
    if (s) goldFlash(0.2 * Math.exp(-Math.max(0, t - s.spinEnd) * 7) * (t >= s.spinEnd ? 1 : 0), WH.cx, WH.cy - 300);
  }

  // ---------- SCENE 2 intro text ----------
  function scene2Text(t) {
    const out = 10.0;
    slamLine('12 PAIRS.', 800, 200, t, 7.5, { out });
    slamLine('2 GROUPS.', 1020, 200, t, 8.25, { out });
    slamLine('ONE DRAW.', 1270, 232, t, 9.0, { out, gold: true });
    const a = seg(t, 7.5, 7.8) * (1 - seg(t, out, out + 0.3));
    if (a > 0) {
      ctx.fillStyle = `rgba(255,198,26,${0.8 * a})`; const lw = 300 * eExpo(seg(t, 7.5, 8.2));
      ctx.fillRect(540 - lw, 560, lw * 2, 3); ctx.fillRect(540 - lw, 1360, lw * 2, 3);
    }
    goldFlash(0.5 * Math.exp(-Math.max(0, t - 9.0) * 5) * (t >= 9 ? 1 : 0), 540, 1180);
  }

  // ---------- SCENE 4: final group reveal ----------
  const FB = { y: 480, hh: 196, rh: 156, w: 494, xA: 36, xB: 550 };
  function scene4(t) {
    const q = t - T.s4, out = seg(q, 9.0, 9.45);
    ctx.save(); ctx.globalAlpha = 1 - out;
    const hA = eExpo(seg(q, 0.45, 1.0));
    if (hA > 0) {
      ctx.save(); ctx.globalAlpha *= clamp(hA * 2);
      drawCrest(540, 150, 150, { glow: 0.7 });
      ctx.restore();
      sweepText('THE OFFICIAL GROUPS', 540, 352 + 30 * (1 - hA), { font: anton(92), px: 92, gold: true, alpha: clamp(hA * 2), ls: 2 }, seg(q, 4.3, 5.3));
      txt(ctx, 'PEMBERANI TOURNAMENT  ·  EDISI 3.0', 540, 412, { font: bc(600, 30), ls: 8, fill: '#fff', alpha: seg(q, 0.8, 1.3) });
    }
    for (const G of ['A', 'B']) {
      const x = G === 'A' ? FB.xA : FB.xB, h = FB.hh + 6 * FB.rh + 14;
      const u = seg(q, 1.0 + (G === 'B' ? 0.12 : 0), 1.45 + (G === 'B' ? 0.12 : 0)); if (u <= 0) continue;
      const e = eExpo(u);
      ctx.save(); ctx.globalAlpha *= clamp(u * 3); ctx.translate(0, (1 - e) * 140);
      panelPath(ctx, x, FB.y, FB.w, h, 26);
      let g = ctx.createLinearGradient(0, FB.y, 0, FB.y + h); g.addColorStop(0, 'rgba(24,22,16,0.97)'); g.addColorStop(1, 'rgba(7,7,7,0.97)');
      ctx.fillStyle = g; ctx.save(); ctx.shadowColor = 'rgba(255,198,26,0.18)'; ctx.shadowBlur = 40; ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(255,198,26,0.55)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); panelPath(ctx, x, FB.y, FB.w, h, 26); ctx.clip();
      g = ctx.createLinearGradient(x, FB.y, x + FB.w, FB.y + FB.hh); g.addColorStop(0, HI); g.addColorStop(0.45, GOLD); g.addColorStop(1, CHAMP);
      ctx.fillStyle = g; ctx.fillRect(x, FB.y, FB.w, FB.hh);
      const sw = seg(q, 1.5, 2.3); if (sw > 0 && sw < 1) { const p = x + lerp(-200, FB.w + 200, sw); const gg = ctx.createLinearGradient(p - 90, 0, p + 90, 60); gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,0.7)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gg; ctx.fillRect(x, FB.y, FB.w, FB.hh); }
      txt(ctx, G, x + FB.w - 34, FB.y + 168, { font: anton(180), align: 'right', fill: 'rgba(10,8,3,0.95)' });
      ctx.restore();
      txt(ctx, 'GROUP', x + 32, FB.y + 106, { font: anton(84), ls: 3, align: 'left', fill: '#0a0803' });
      txt(ctx, '6 PAIRS', x + 34, FB.y + 158, { font: bc(700, 32), ls: 8, align: 'left', fill: 'rgba(10,8,3,0.82)' });
      const names = T.groups[G];
      for (let i = 0; i < 6; i++) {
        const y = FB.y + FB.hh + 6 + i * FB.rh, idx = i * 2 + (G === 'B' ? 1 : 0), t0 = 1.5 + idx * 0.2;
        if (i > 0) { ctx.fillStyle = 'rgba(200,162,74,0.2)'; ctx.fillRect(x + 28, y, FB.w - 56, 1); }
        const ru = seg(q, t0, t0 + 0.42); if (ru <= 0 || !names[i]) continue;
        const re = eExpo(ru), dir = G === 'A' ? -1 : 1, fl = Math.exp(-Math.max(0, q - t0 - 0.3) * 3.5) * (q > t0 + 0.3 ? 1 : ru);
        ctx.save(); ctx.globalAlpha *= clamp(ru * 2.5);
        ctx.fillStyle = `rgba(255,198,26,${0.07 + 0.4 * fl})`; ctx.fillRect(x + 2, y + 3, FB.w - 4, FB.rh - 5);
        ctx.translate(dir * (1 - re) * 240, 0);
        ctx.fillStyle = GOLD; ctx.fillRect(x + 28, y + 46, 6, FB.rh - 92);
        const px = fitPx(ctx, names[i], (p) => bc(700, p), 58, FB.w - 86);
        txt(ctx, names[i], x + 54, y + FB.rh / 2 + 3, { font: bc(700, px), align: 'left', base: 'middle', fill: silverGrad(ctx, y + 40, y + 120), shadow: `rgba(255,198,26,${0.6 * fl})`, blur: 22 });
        ctx.restore();
        trace('finalRow', { group: G, slot: i, name: names[i], u: ru });
      }
      ctx.restore();
    }
    const fa = seg(q, 4.2, 4.9);
    if (fa > 0) {
      txt(ctx, '12 PAIRS  ·  2 GROUPS  ·  ONE DRAW', 540, 1722, { font: bc(700, 34), ls: 9, fill: GOLD, alpha: fa });
      if (META.sha256) txt(ctx, `SEALED DRAW  ·  SHA-256  ${META.sha256.slice(0, 16).toUpperCase()}…`, 540, 1772, { font: bc(500, 25), ls: 4, fill: 'rgba(243,234,211,0.7)', alpha: fa });
    }
    ctx.restore();
    goldFlash(0.9 * Math.exp(-Math.pow((q - 0.3) / 0.22, 2)), 540, 900);
    goldFlash(0.3 * Math.exp(-Math.max(0, q - 1.0) * 5) * (q >= 1 ? 1 : 0), 540, 700);
    fadeBlack(out);
  }

  // ---------- SCENE 5: closing ----------
  function scene5(t) {
    const q = t - T.s5;
    const inn = seg(q, 0.15, 1.3);
    const sc = lerp(1.14, 1, eExpo(seg(q, 0.15, 1.6))) * (1 + 0.04 * seg(q, 1.6, 9));
    drawCrest(540, 540, 540 * sc, { light: lerp(0.04, 1, eOut3(inn)), rays: eOut3(inn), t, sweep: seg(q, 2.4, 3.5) + (q > 4.8 ? seg(q, 4.8, 5.9) - 1 + 1e-6 : 0) * 0 });
    if (q > 4.8) { /* second sweep on the final hit */
      const s2 = seg(q, 4.85, 5.9);
      if (s2 > 0 && s2 < 1) drawCrest(540, 540, 540 * sc, { light: 1, glow: 0, sweep: s2 });
    }
    const outA = 4.1;
    slamLine('12 PAIRS.', 1140, 128, t, T.s5 + 1.2, { out: T.s5 + outA });
    slamLine('2 GROUPS.', 1282, 128, t, T.s5 + 1.8, { out: T.s5 + outA });
    slamLine('ZERO MERCY.', 1470, 178, t, T.s5 + 2.4, { out: T.s5 + outA, gold: true });
    goldFlash(0.45 * Math.exp(-Math.max(0, q - 2.4) * 5) * (q >= 2.4 ? 1 : 0), 540, 1420);
    const u = seg(q, 4.8, 5.3);
    if (u > 0) {
      const e = eExpo(u);
      txt(ctx, 'THE ROAD TO', 540, 1130, { font: bc(600, 54), ls: lerp(40, 18, e), fill: '#fff', alpha: clamp(u * 3) });
      const px = fitPx(ctx, 'PEMBERANI EDISI 3.0', anton, 160, 960);
      const s = lerp(1.35, 1, e);
      ctx.save(); ctx.translate(540, 1240); ctx.scale(s, s); ctx.translate(-540, -1240);
      sweepText('PEMBERANI EDISI 3.0', 540, 1290, { font: anton(px), px, gold: true, alpha: clamp(u * 3) }, seg(q, 5.2, 6.3));
      ctx.restore();
      const u2 = seg(q, 5.25, 5.7), lw = 380 * eExpo(u2);
      ctx.fillStyle = `rgba(255,198,26,${0.9 * u2})`; ctx.fillRect(540 - lw, 1338, lw * 2, 3);
      txt(ctx, 'STARTS NOW.', 540, 1470, { font: anton(120), ls: 4, fill: silverGrad(ctx, 1380, 1470), alpha: eOut3(u2), shadow: 'rgba(0,0,0,0.9)' });
    }
    goldFlash(0.7 * Math.exp(-Math.max(0, q - 4.8) * 4) * (q >= 4.8 ? 1 : 0), 540, 1250);
    fadeBlack(Math.max(1 - seg(q, 0.0, 0.5), seg(q, 7.3, 8.5)));
  }

  // ---------- frame ----------
  function renderFrame(i) {
    const t = i / T.fps;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (t < T.s2) scene1(t);
    else if (t < T.s4 + 0.5) {
      background(t, 1, t < T.wheelIn ? 960 : WH.cy);
      if (t < T.wheelIn + 0.1) scene2Text(t);
      if (t >= T.wheelIn) stage(t);
      if (t >= T.s4) { const q = t - T.s4; goldFlash(0.9 * Math.exp(-Math.pow((q - 0.3) / 0.22, 2)), 540, 900); }
    } else if (t < T.s5) { background(t, 1, 900); scene4(t); }
    else { background(t, 1, 600); scene5(t); }
    post(i);
  }

  function setDraw(draw, meta) {
    T = buildTimeline(draw); if (meta) META = meta; faceKey = '';
    tickTimes = T.events.filter((e) => e.type === 'tick').map((e) => e.t);
    return { frames: T.frames, fps: T.fps, duration: T.end };
  }
  async function init(draw, meta) {
    await Promise.all(['400 40px Anton', '500 40px "Barlow Condensed"', '600 40px "Barlow Condensed"', '700 40px "Barlow Condensed"'].map((f) => document.fonts.load(f)));
    crest = new Image(); crest.src = 'crest.png'; await crest.decode();
    initPost();
    return setDraw(draw, meta);
  }
  window.FILM = { init, setDraw, renderFrame, timeline: () => T, canvas: cv };
})();
