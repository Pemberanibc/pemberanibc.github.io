// Small helpers shared by the arena and the control panel.
export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const pad2 = (n) => String(n).padStart(2, '0');
export const clockTime = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function confirmDialog({ title, text, ok = 'Confirm' }) {
  const d = $('#confirm'); $('#confirmTitle').textContent = title; $('#confirmText').textContent = text; $('#confirmOk').textContent = ok;
  return new Promise((res) => { d.returnValue = 'cancel'; d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true }); d.showModal(); });
}
export function historyHtml(s) {
  if (!s.history.length) return '<li class="empty">No pair has been drawn yet.</li>';
  return s.history.map((h) => `<li><b>${pad2(h.order)}</b><span class="hp">${esc(h.pair)}</span><span class="hg g${h.group}">GROUP ${h.group}${h.allocation === 'auto' ? '<small>auto</small>' : ''}</span><time>${clockTime(h.at)}</time></li>`).join('');
}
export const PRIMARY_LABEL = { start: 'Start draw', drawNext: 'Draw next pair', revealGroup: 'Reveal group', next: 'Next draw' };
