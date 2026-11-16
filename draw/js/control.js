// Organiser control panel. Same store as the audience screen: one state, many windows.
import { can, primaryAction } from './engine.js';
import { createStore } from './store.js';
import { downloadJson, downloadCsv, downloadImage, printResults } from './results.js';
import { $, esc, pad2, confirmDialog, historyHtml } from './ui.js';

const store = createStore();
let prevKey = '';
const BTN = { start: '#cStart', drawNext: '#cDraw', revealGroup: '#cReveal', next: '#cNext' };

function render() {
  const v = store.view(), key = [v.rev, v.phase, v.paused, v.view].join('|');
  store.autoTick();
  if (key === prevKey) return; prevKey = key;
  const k = can(v), p = primaryAction(v), c = v.current, shown = c && v.phase !== 'spinning';
  $('#stepNo').textContent = pad2(v.history.length);
  $('#nowLabel').textContent = { idle: 'Not started', ready: `Ready for draw ${pad2(v.history.length + 1)}`, spinning: 'Wheel spinning…', picked: 'Pair drawn — reveal the group', allocating: 'Allocating group…', allocated: 'Allocated', complete: 'Draw complete' }[v.phase] + (v.paused ? ' · PAUSED' : '');
  $('#nowPair').textContent = shown ? v.pairs[c.pairId] : v.phase === 'complete' ? 'Group A 6 · Group B 6' : '';
  $('#nowSub').textContent = v.phase === 'allocated' ? `Group ${c.group}${c.allocation === 'auto' ? ' — assigned automatically, the other group is full' : ' — random allocation'}`
    : v.phase === 'picked' && (v.groups.A.length === 6 || v.groups.B.length === 6) ? `Group ${v.groups.A.length === 6 ? 'A' : 'B'} is full: this pair goes to Group ${v.groups.A.length === 6 ? 'B' : 'A'} automatically.`
    : v.phase === 'idle' ? 'Press Start draw when the audience is ready.' : v.phase === 'spinning' ? 'The result appears here when the wheel stops.' : '';
  for (const [name, sel] of Object.entries(BTN)) { const b = $(sel); b.disabled = !k[name]; b.classList.toggle('next', p === name); }
  $('#cNext').firstChild.textContent = v.phase === 'allocated' && v.remaining.length === 0 ? 'Reveal final groups' : 'Next draw';
  $('#cPause').disabled = !k.pause; $('#cResume').disabled = !k.resume; $('#cUndo').disabled = !k.undo; $('#cReset').disabled = !k.reset;
  $('#cView').disabled = !k.view; $('#cView').textContent = v.view === 'final' && v.phase === 'complete' ? 'Back to the arena' : 'View final results';
  for (const G of ['A', 'B']) { $('#m' + G).innerHTML = Array.from({ length: 6 }, (_, i) => `<li>${v.groups[G][i] !== undefined ? esc(v.pairs[v.groups[G][i]]) : ''}</li>`).join(''); $('#mCap' + G).textContent = `${v.groups[G].length}/6`; }
  $('#remainN').textContent = v.remaining.length;
  $('#remain').innerHTML = v.remaining.map((id) => `<span>${esc(v.pairs[id])}</span>`).join('');
  $('#cHistory').innerHTML = historyHtml(v);
}
setInterval(render, 100); store.subscribe(() => render());   // instant on every change, timer for time-driven steps

const act = (name, ...a) => { store.dispatch(name, ...a); render(); };
$('#cStart').onclick = () => act('start'); $('#cDraw').onclick = () => act('drawNext'); $('#cReveal').onclick = () => act('revealGroup'); $('#cNext').onclick = () => act('next');
$('#cPause').onclick = () => act('pause'); $('#cResume').onclick = () => act('resume');
$('#cUndo').onclick = async () => { const v = store.view(), last = v.phase === 'picked' ? v.pairs[v.current.pairId] : v.history.length ? v.history[v.history.length - 1].pair : null; if (last && await confirmDialog({ title: 'Undo last draw?', text: `${last} goes back into the wheel and leaves its group.`, ok: 'Undo' })) act('undo'); };
$('#cReset').onclick = async () => { if (await confirmDialog({ title: 'Reset the entire draw?', text: 'All 12 pairs return to the wheel and both groups are emptied. This cannot be undone.', ok: 'Reset draw' })) act('reset'); };
$('#cView').onclick = () => act('setView', store.view().view === 'final' ? 'arena' : 'final');
$('#cJson').onclick = () => downloadJson(store.view()); $('#cCsv').onclick = () => downloadCsv(store.view());
$('#cImage').onclick = () => downloadImage(store.view()); $('#cPrint').onclick = () => printResults(store.view());
addEventListener('keydown', (e) => { if (e.code !== 'Space' || e.repeat || e.target.closest('input, button, dialog')) return; e.preventDefault(); const p = primaryAction(store.view()); if (p) act(p); });

// ---------- sharing to other devices (optional) ----------
$('#cloudUrl').textContent = new URL('./?cloud', location.href).href;
let cloudReady = null;
store.onStatus((c) => {
  $('#cloudChip').textContent = { off: 'This laptop only', 'signed-out': 'This laptop only', live: 'Sharing online', offline: 'Online sharing: no connection', error: 'Online sharing: error', choose: 'Online draw found' }[c.status] || c.status;
  $('#cloudChip').dataset.s = c.status;
  $('#cSignOut').hidden = !c.user; $('#cSignIn').hidden = !!c.user; $('#cEmail').hidden = $('#cPass').hidden = !!c.user;
  $('#cloudChoice').hidden = c.status !== 'choose';
  const m = $('#cloudMsg'); m.classList.toggle('okmsg', c.status === 'live' && !c.error);
  m.textContent = c.error || (c.status === 'live' ? `Signed in as ${c.user}. Other devices now follow this draw.` : c.status === 'choose' ? 'A draw with results already exists online. Choose which one to keep.' : c.status === 'offline' && c.user ? 'No connection. The draw keeps working on this laptop and re-syncs when the connection returns.' : '');
});
$('#cloudForm').onsubmit = async (e) => {
  e.preventDefault(); $('#cloudMsg').classList.remove('okmsg'); $('#cloudMsg').textContent = 'Connecting…';
  cloudReady ||= store.connectCloud({ auth: true }); await cloudReady;
  if (!store.cloud) return;
  try { await store.cloud.signIn($('#cEmail').value.trim(), $('#cPass').value); }
  catch (err) { $('#cloudMsg').textContent = /invalid-credential|wrong-password|user-not-found/.test(err.code) ? 'Wrong email or password.' : /network/.test(err.code) ? 'No internet connection.' : err.message; }
};
$('#cSignOut').onclick = () => store.cloud && store.cloud.signOut();
$('#useCloud').onclick = () => store.cloud.resolve(true); $('#useLocal').onclick = () => store.cloud.resolve(false);
window.__draw = { store };
