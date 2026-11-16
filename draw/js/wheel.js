// The draw wheel. It never chooses anything: it is handed an angle and a list of names and paints them.
import { TAU } from './engine.js';
const GOLD = '#FFC61A', CHAMP = '#C8A24A', HI = '#FFE45C', IVORY = '#F3EAD3';
const R = 400, DISC = 366, HUB = 108, RIN = 126, ROUT = 352;      // design units; scaled to the canvas

export function createWheel(canvas) {
  const ctx = canvas.getContext('2d'), face = document.createElement('canvas'), fctx = face.getContext('2d');
  let size = 0, k = 1, faceKey = '', kick = 0, lastIdx = null;
  const font = (w, px) => `${w} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const display = (px) => `400 ${px}px Anton, Impact, sans-serif`;

  function resize() {
    const box = canvas.parentElement.getBoundingClientRect(), css = Math.floor(Math.min(box.width, box.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2), px = Math.max(200, Math.round(css * dpr));
    if (px !== size) { size = px; canvas.width = canvas.height = px; face.width = face.height = px; faceKey = ''; }
    canvas.style.width = canvas.style.height = css + 'px'; k = size / 880;
  }
  const wedge = (c, a0, a1, r0, r1) => { c.beginPath(); c.arc(0, 0, r1, a0, a1); c.arc(0, 0, r0, a1, a0, true); c.closePath(); };
  function fit(c, names, weight, max, segAngle) {
    c.font = font(weight, 100); let px = max;
    for (const n of names) px = Math.min(px, (ROUT - RIN - 8) / c.measureText(n).width * 100);
    return Math.max(16, Math.min(px, segAngle * 150 * 0.66));
  }
  function buildFace(entries) {
    const key = entries.map((e) => e.id).join(',') + '@' + size; if (key === faceKey) return; faceKey = key;
    const c = fctx, n = entries.length, seg = TAU / Math.max(1, n);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, size, size); c.setTransform(k, 0, 0, k, size / 2, size / 2);
    c.fillStyle = '#060606'; c.beginPath(); c.arc(0, 0, DISC, 0, TAU); c.fill();
    entries.forEach((e, i) => {
      const g = c.createRadialGradient(0, 0, HUB, 0, 0, DISC);
      if (e.id % 2) { g.addColorStop(0, '#241d0d'); g.addColorStop(1, '#0d0a04'); } else { g.addColorStop(0, '#181818'); g.addColorStop(1, '#080808'); }
      wedge(c, i * seg, (i + 1) * seg, HUB - 4, DISC); c.fillStyle = g; c.fill();
    });
    if (n > 1) entries.forEach((e, i) => {
      c.save(); c.rotate(i * seg);
      const g = c.createLinearGradient(HUB, 0, DISC, 0); g.addColorStop(0, 'rgba(200,162,74,0.25)'); g.addColorStop(1, 'rgba(255,198,26,0.95)');
      c.fillStyle = g; c.fillRect(HUB, -1.3, DISC - HUB, 2.6); c.fillStyle = HI; c.beginPath(); c.arc(DISC - 9, 0, 4, 0, TAU); c.fill(); c.restore();
    });
    const px = fit(c, entries.map((e) => e.name), 600, 54, seg);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = IVORY; c.font = font(600, px);
    entries.forEach((e, i) => { c.save(); c.rotate((i + 0.5) * seg); c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 6; c.fillText(e.name, (RIN + ROUT) / 2, 1); c.restore(); });
    c.strokeStyle = 'rgba(255,198,26,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, DISC - 20, 0, TAU); c.stroke();
    c.lineWidth = 3; c.strokeStyle = CHAMP; c.beginPath(); c.arc(0, 0, DISC - 1.5, 0, TAU); c.stroke();
  }

  // m: { entries:[{id,name}], angle, highlightId, hlAge (s), remaining, spinning, t (s) } -> returns true when a divider passed the pointer
  function draw(m) {
    resize(); buildFace(m.entries);
    const c = ctx, n = m.entries.length, seg = TAU / Math.max(1, n);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, size, size); c.setTransform(k, 0, 0, k, size / 2, size / 2 + 14 * k);
    let g = c.createRadialGradient(0, 0, R * 0.8, 0, 0, R * 1.08); g.addColorStop(0, 'rgba(255,198,26,0.16)'); g.addColorStop(1, 'rgba(255,198,26,0)');
    c.fillStyle = g; c.fillRect(-R * 1.1, -R * 1.1, R * 2.2, R * 2.2);
    const cg = c.createConicGradient(-0.6, 0, 0);
    ['#FFE45C', '#C8A24A', '#6b4f14', '#C8A24A', '#FFF0A0', '#FFC61A', '#7a5a16', '#C8A24A', '#FFE45C', '#8a6a1e', '#FFC61A', '#FFE45C'].forEach((col, i, a) => cg.addColorStop(i / (a.length - 1), col));
    c.fillStyle = cg; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R - 5, 0, TAU); c.stroke();
    c.fillStyle = '#050505'; c.beginPath(); c.arc(0, 0, DISC + 3, 0, TAU); c.fill();
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * TAU - Math.PI / 2, x = Math.cos(a) * (R - 16), y = Math.sin(a) * (R - 16);
      let on = 0.3 + 0.12 * Math.sin(m.t * 2 + i * 0.7);
      if (m.spinning) { const d = (((i / 36 * TAU - m.angle * 0.5) % TAU) + TAU) % TAU; on = 0.25 + 0.75 * Math.pow(Math.max(0, Math.cos(d * 3)), 6); }
      else if (m.highlightId != null && m.hlAge < 1.2) on = 0.35 + 0.65 * Math.abs(Math.cos(m.hlAge * 9)) * (1 - m.hlAge / 1.2);
      c.fillStyle = '#1a1204'; c.beginPath(); c.arc(x, y, 6.5, 0, TAU); c.fill();
      c.fillStyle = `rgba(255,${Math.round(225 + 25 * on)},${Math.round(120 + 110 * on)},${0.25 + 0.75 * on})`; c.beginPath(); c.arc(x, y, 4.2, 0, TAU); c.fill();
    }
    c.save(); c.beginPath(); c.arc(0, 0, DISC, 0, TAU); c.clip();
    c.save(); c.rotate(m.angle); c.drawImage(face, -size / 2 / k, -size / 2 / k, size / k, size / k); c.restore();
    const hi = m.entries.findIndex((e) => e.id === m.highlightId);
    if (hi >= 0) {
      c.save(); c.rotate(m.angle);
      const flash = Math.exp(-m.hlAge * 5), pulse = 0.5 + 0.5 * Math.cos(m.hlAge * 8);
      const gg = c.createRadialGradient(0, 0, HUB, 0, 0, DISC); gg.addColorStop(0, CHAMP); gg.addColorStop(0.6, GOLD); gg.addColorStop(1, HI);
      wedge(c, hi * seg, (hi + 1) * seg, HUB - 4, DISC); c.fillStyle = gg; c.fill();
      c.fillStyle = `rgba(255,255,255,${(0.7 * flash + 0.1 * pulse) * Math.min(1, 0.55 / seg)})`; c.fill();
      c.rotate((hi + 0.5) * seg); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#0a0803';
      c.font = font(700, fit(c, [m.entries[hi].name], 700, 60, seg)); c.fillText(m.entries[hi].name, (RIN + ROUT) / 2, 1); c.restore();
    }
    g = c.createRadialGradient(0, 0, HUB, 0, 0, DISC); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.18, 'rgba(0,0,0,0)'); g.addColorStop(0.86, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = g; c.fillRect(-DISC, -DISC, DISC * 2, DISC * 2);
    c.restore();
    // hub
    c.fillStyle = cg; c.beginPath(); c.arc(0, 0, HUB, 0, TAU); c.fill();
    g = c.createRadialGradient(0, -30, 10, 0, 0, HUB - 10); g.addColorStop(0, '#1b1b1b'); g.addColorStop(1, '#050505');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, HUB - 10, 0, TAU); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const tg = c.createLinearGradient(0, -60, 0, 20); tg.addColorStop(0, '#FFF0A0'); tg.addColorStop(0.5, GOLD); tg.addColorStop(1, CHAMP);
    c.fillStyle = tg; c.font = display(92); c.fillText(String(m.remaining), 0, 20);
    c.fillStyle = 'rgba(243,234,211,0.8)'; c.font = font(600, 20); c.letterSpacing = '4px'; c.fillText(m.remaining === 1 ? 'PAIR LEFT' : 'PAIRS LEFT', 2, 52); c.letterSpacing = '0px';
    // divider ticks + pointer
    let ticked = false;
    if (m.spinning && n > 1) { const idx = Math.floor((-Math.PI / 2 - m.angle) / seg); if (lastIdx !== null && idx !== lastIdx) { ticked = true; kick = 1; } lastIdx = idx; } else lastIdx = null;
    kick *= 0.82;
    c.save(); c.translate(0, -R - 22); c.rotate(-0.3 * kick);
    c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 16; c.shadowOffsetY = 6;
    g = c.createLinearGradient(-34, 0, 34, 0); g.addColorStop(0, '#8a6a1e'); g.addColorStop(0.35, HI); g.addColorStop(0.5, '#FFF6C4'); g.addColorStop(0.7, GOLD); g.addColorStop(1, '#8a6a1e');
    c.fillStyle = g; c.beginPath(); c.moveTo(-34, -14); c.lineTo(34, -14); c.lineTo(0, 76); c.closePath(); c.fill();
    c.shadowColor = 'transparent'; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(0, 4, 9, 0, TAU); c.fill(); c.restore();
    return ticked;
  }
  return { draw, resize };
}
