// Results export: JSON, CSV, high-resolution PNG and a print sheet. All built from the same results() object.
import { results, resultsCsv } from './engine.js';

const stamp = () => new Date().toISOString().slice(0, 10);
function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
export const downloadJson = (s) => save(new Blob([JSON.stringify(results(s), null, 2) + '\n'], { type: 'application/json' }), `pemberani-e3-group-draw-${stamp()}.json`);
export const downloadCsv = (s) => save(new Blob(['﻿' + resultsCsv(s)], { type: 'text/csv;charset=utf-8' }), `pemberani-e3-group-draw-${stamp()}.csv`);

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export async function renderImage(s) {            // 2160 x 2700 (4:5), sharp enough to print
  const r = results(s), W = 2160, H = 2700, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  await Promise.all(['400 40px Anton', '600 40px "Barlow Condensed"', '700 40px "Barlow Condensed"'].map((f) => document.fonts.load(f)));
  const crest = new Image(); crest.src = new URL('../../assets/crest.png', import.meta.url).href; await crest.decode().catch(() => {});
  c.fillStyle = '#050505'; c.fillRect(0, 0, W, H);
  let g = c.createRadialGradient(W / 2, 520, 0, W / 2, 520, 1700); g.addColorStop(0, 'rgba(255,198,26,0.16)'); g.addColorStop(1, 'rgba(255,198,26,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const gold = (y0, y1) => { const gg = c.createLinearGradient(0, y0, 0, y1); gg.addColorStop(0, '#FFF0A0'); gg.addColorStop(0.45, '#FFC61A'); gg.addColorStop(1, '#C8A24A'); return gg; };
  if (crest.naturalWidth) c.drawImage(crest, W / 2 - 150, 90, 300, 300 * crest.naturalHeight / crest.naturalWidth);
  c.textAlign = 'center';
  c.fillStyle = '#fff'; c.font = '400 120px Anton'; c.fillText('PEMBERANI TOURNAMENT', W / 2, 660);
  c.fillStyle = gold(700, 800); c.font = '400 96px Anton'; c.fillText(r.complete ? 'EDISI 3.0  ·  THE OFFICIAL GROUPS' : 'EDISI 3.0  ·  GROUP DRAW IN PROGRESS', W / 2, 800);
  ['A', 'B'].forEach((G, gi) => {
    const x = gi ? 1110 : 110, w = 940, y = 900, hh = 220, rh = 190;
    c.fillStyle = '#111111'; c.fillRect(x, y, w, hh + rh * 6 + 20); c.strokeStyle = 'rgba(255,198,26,0.6)'; c.lineWidth = 3; c.strokeRect(x, y, w, hh + rh * 6 + 20);
    g = c.createLinearGradient(x, y, x + w, y + hh); g.addColorStop(0, '#FFE45C'); g.addColorStop(0.45, '#FFC61A'); g.addColorStop(1, '#C8A24A'); c.fillStyle = g; c.fillRect(x, y, w, hh);
    c.fillStyle = '#0a0803'; c.textAlign = 'left'; c.font = '400 150px Anton'; c.fillText('GROUP ' + G, x + 50, y + 168);
    c.textAlign = 'right'; c.font = '700 54px "Barlow Condensed"'; c.fillText(`${r.groups[G].length} / 6 PAIRS`, x + w - 50, y + 160);
    for (let i = 0; i < 6; i++) {
      const ry = y + hh + 10 + i * rh, name = r.groups[G][i];
      if (i) { c.fillStyle = 'rgba(200,162,74,0.25)'; c.fillRect(x + 50, ry, w - 100, 2); }
      c.fillStyle = name ? '#FFC61A' : 'rgba(200,162,74,0.3)'; c.fillRect(x + 50, ry + 60, 10, rh - 120);
      if (name) { c.textAlign = 'left'; c.fillStyle = '#fff'; let px = 104; c.font = `700 ${px}px "Barlow Condensed"`; const mw = c.measureText(name).width; if (mw > w - 150) { px = px * (w - 150) / mw; c.font = `700 ${px}px "Barlow Condensed"`; } c.fillText(name, x + 96, ry + rh / 2 + px * 0.34); }
    }
  });
  c.textAlign = 'center'; c.fillStyle = '#FFC61A'; c.font = '700 64px "Barlow Condensed"'; c.letterSpacing = '14px'; c.fillText('12 PAIRS.  2 GROUPS.  ZERO MERCY.', W / 2 + 7, 2420);
  c.fillStyle = '#888888'; c.font = '600 40px "Barlow Condensed"'; c.letterSpacing = '6px';
  c.fillText(`LIVE DRAW${r.completedAt ? '  ·  COMPLETED ' + when(r.completedAt).toUpperCase() : ''}`, W / 2 + 3, 2520); c.letterSpacing = '0px';
  return cv;
}
export async function downloadImage(s) { const cv = await renderImage(s); const blob = await new Promise((res) => cv.toBlob(res, 'image/png')); save(blob, `pemberani-e3-group-draw-${stamp()}.png`); return cv; }

export function printResults(s) {
  const r = results(s), esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  let el = document.getElementById('printSheet'); if (!el) { el = document.createElement('div'); el.id = 'printSheet'; document.body.appendChild(el); }
  el.innerHTML = `<h1>PEMBERANI TOURNAMENT — EDISI 3.0</h1><h2>${r.complete ? 'Official group draw' : 'Group draw (in progress)'}${r.completedAt ? ' · ' + esc(when(r.completedAt)) : ''}</h2>
    <div class="pg">${['A', 'B'].map((G) => `<div><h3>GROUP ${G}</h3><ol>${r.groups[G].map((n) => `<li>${esc(n)}</li>`).join('')}</ol></div>`).join('')}</div>
    <h3>Draw order</h3><table><thead><tr><th>#</th><th>Pair</th><th>Group</th><th>Allocation</th><th>Time</th></tr></thead><tbody>
    ${r.history.map((h) => `<tr><td>${String(h.order).padStart(2, '0')}</td><td>${esc(h.pair)}</td><td>Group ${h.group}</td><td>${h.allocation === 'auto' ? 'Automatic (other group full)' : 'Random'}</td><td>${new Date(h.drawnAt).toLocaleTimeString('en-GB')}</td></tr>`).join('')}</tbody></table>`;
  window.print();
}
