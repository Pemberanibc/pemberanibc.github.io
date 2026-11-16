// Audience screen (and single-laptop mode with the organiser dock).
// Renders whatever the store says; the only place results come from is engine.js via the store.
import { can, primaryAction, spinEase, flipEase, clock, CAP } from './engine.js';
import { createStore } from './store.js';
import { createWheel } from './wheel.js';
import { createSound } from './sound.js';
import { downloadJson, downloadCsv, downloadImage, printResults } from './results.js';
import { $, esc, pad2, confirmDialog, historyHtml, PRIMARY_LABEL, toggleFullscreen } from './ui.js';

const params = new URLSearchParams(location.search);
const follower = params.has('cloud');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = createStore({ follower });
const wheel = createWheel($('#wheel'));
const sound = createSound();
const body = document.body;
let present = params.has('present') || follower;
let prev = null, lastFlip = null, hlStart = 0, finalShown = false, lastAngle = null;

body.classList.toggle('follower', follower);
if (reduced) body.classList.add('reduced');
if (follower) { store.connectCloud(); store.onStatus((c) => { const chip = $('#syncChip'); chip.hidden = false; chip.dataset.s = c.status; chip.textContent = { connecting: 'Connecting…', waiting: 'Waiting for the organiser', live: 'Synced', offline: 'Offline — reconnecting', error: 'Sync error' }[c.status] || c.status; }); }

function setPresent(on) { present = on; body.classList.toggle('present', on); $('#btnPresent').textContent = on ? 'Exit presentation' : 'Presentation mode'; if (on) $('#historyDrawer').hidden = true; requestAnimationFrame(() => wheel.resize()); }
setPresent(present);

// ---------- static lists ----------
function renderLists(v) {
  const drawn = new Map(v.history.map((h) => [h.pairId, h.group]));
  const cur = v.current && ['picked', 'allocating', 'allocated'].includes(v.phase) ? v.current.pairId : null;
  $('#pairList').innerHTML = v.pairs.map((name, id) => {
    const g = drawn.get(id), cls = g ? 'done' : id === cur ? 'cur' : '';
    return `<li class="${cls}"><i>${pad2(id + 1)}</i><span>${esc(name)}</span>${g ? `<b>${g}</b>` : ''}</li>`;
  }).join('');
  $('#remCount').textContent = v.remaining.length;
  for (const G of ['A', 'B']) {
    const ids = v.groups[G], was = prev ? prev.groups[G] : ids, board = $('#board' + G);
    board.querySelector('ol').innerHTML = Array.from({ length: CAP }, (_, i) => {
      const id = ids[i]; if (id === undefined) return `<li class="empty"><i>${i + 1}</i><span></span></li>`;
      return `<li class="${prev && !was.includes(id) ? 'enter' : ''}"><i>${i + 1}</i><span>${esc(v.pairs[id])}</span></li>`;
    }).join('');
    $('#cap' + G).textContent = ids.length; $('#capSel' + G).textContent = `${ids.length}/6`;
    board.classList.toggle('full', ids.length === CAP);
    board.classList.toggle('hit', v.phase === 'allocated' && v.current && v.current.group === G);
  }
  $('#historyList').innerHTML = historyHtml(v);
}

function fitName(el) { el.style.fontSize = ''; const max = el.parentElement.clientWidth * 0.96; if (el.scrollWidth > max) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * max / el.scrollWidth) + 'px'; }

function renderStage(v) {
  body.dataset.phase = v.phase; body.classList.toggle('is-paused', v.paused);
  const c = v.current, order = c ? c.order : v.history.length + 1;
  const cap = { idle: follower || present ? 'The draw will begin shortly' : 'Press START DRAW to open the ceremony', ready: `Draw ${pad2(order)} of 12 · Ready`, spinning: `Drawing pair ${pad2(order)} of 12`, picked: `Pair ${pad2(order)} of 12 drawn`, allocating: 'Allocating group', allocated: `Pair ${pad2(order)} of 12 allocated`, complete: 'Draw complete' }[v.phase];
  $('#caption').textContent = cap;
  if (c && v.phase !== 'spinning') {
    $('#rvKicker').textContent = `Pair ${pad2(c.order)} of 12`;
    const nm = $('#rvName'); if (nm.textContent !== v.pairs[c.pairId]) { nm.textContent = v.pairs[c.pairId]; fitName(nm); }
    const full = c.allocation === 'auto' ? (c.group === 'A' ? 'B' : 'A') : null;
    $('#selector').dataset.auto = full || '';
    $('#rvVerdict').innerHTML = v.phase === 'picked' ? 'Awaiting group allocation'
      : v.phase === 'allocating' ? (full ? `Group ${full} is full · auto-assigned` : 'Random allocation')
      : `Allocated to <b>GROUP ${c.group}</b>${full ? ` <small>Group ${full} is full</small>` : ''}`;
  }
  // dock
  const k = can(v), p = primaryAction(v), btn = $('#btnPrimary');
  btn.textContent = p ? (p === 'next' && v.remaining.length === 0 ? 'Reveal final groups' : PRIMARY_LABEL[p]) : v.phase === 'complete' ? 'View final results' : v.phase === 'spinning' ? 'Drawing…' : 'Allocating…';
  btn.disabled = !(p ? k[p] : v.phase === 'complete');
  $('#btnPause').textContent = v.paused ? 'Resume animation' : 'Pause animation'; $('#btnPause').disabled = !(k.pause || k.resume);
  $('#btnUndo').disabled = !k.undo; $('#btnReset').disabled = !k.reset;
  $('#btnSound').textContent = v.sound ? 'Sound on' : 'Sound off'; $('#btnSound').setAttribute('aria-pressed', v.sound);
  sound.setEnabled(v.sound); $('#soundGate').hidden = !(v.sound && sound.locked && v.phase !== 'idle');
}

function renderFinal(v) {
  const show = v.phase === 'complete' && v.view === 'final', el = $('#final');
  if (show && !finalShown) {
    for (const G of ['A', 'B']) $('#final' + G).innerHTML = v.groups[G].map((id, i) => `<li style="--d:${(i * 2 + (G === 'B' ? 1 : 0)) * 0.16 + 1.1}s"><span>${esc(v.pairs[id])}</span></li>`).join('');
    el.hidden = false; requestAnimationFrame(() => el.classList.add('on')); confetti.start();
  } else if (!show && finalShown) { el.classList.remove('on'); el.hidden = true; confetti.stop(); }
  finalShown = show;
}

// ---------- transitions -> sound ----------
function onPhaseChange(v) {
  const from = prev ? prev.phase : null, to = v.phase;
  if (!prev || from === to && prev.rev === v.rev) return;
  if (prev.drawId !== v.drawId) return;
  if (from === 'idle' && to === 'ready') sound.play('opening');
  if (to === 'picked' && from === 'spinning') { sound.spin(0); sound.play('reveal'); hlStart = performance.now(); }
  if (to === 'allocated' && from === 'allocating') { sound.play('group'); setTimeout(() => sound.play('confirm'), 650); }
  if (to === 'complete' && from !== 'complete') sound.play('finale');
  if (prev.history.length > v.history.length || (from === 'picked' && to === 'ready')) sound.play('undo');
}

// ---------- frame loop ----------
function frame() {
  const v = store.view(), t = performance.now();
  if (!prev || prev !== v) {
    if (!prev || prev.rev !== v.rev || prev.phase !== v.phase || prev.view !== v.view || prev.paused !== v.paused) { onPhaseChange(v); renderLists(v); renderStage(v); renderFinal(v); }
    prev = v;
  }
  store.autoTick();
  // wheel
  const c = v.current, showPool = c && ['spinning', 'picked', 'allocating'].includes(v.phase);
  const ids = showPool ? c.poolBefore : v.remaining;
  let angle = v.wheelAngle, spinning = false, speed = 0;
  if (v.phase === 'spinning') {
    const u = (clock(v, store.now()) - c.spin.startedAt) / c.spin.dur;
    angle = reduced ? c.spin.to : c.spin.from + (c.spin.to - c.spin.from) * spinEase(u); spinning = !reduced && !v.paused;
    if (lastAngle !== null) speed = Math.min(1, Math.abs(angle - lastAngle) / 0.42);
  } else if (v.phase === 'idle' || v.phase === 'ready') angle += reduced ? 0 : Math.sin(t / 2600) * 0.012;
  lastAngle = angle;
  const hl = c && ['picked', 'allocating'].includes(v.phase) ? c.pairId : null;
  const ticked = wheel.draw({ entries: ids.map((id) => ({ id, name: v.pairs[id] })), angle, highlightId: hl, hlAge: (t - hlStart) / 1000, remaining: v.remaining.length, spinning, t: t / 1000 });
  if (ticked) sound.play('tick'); sound.spin(spinning ? speed : 0);
  // A/B selector
  const tiles = $('#selector').children;
  let lit = null;
  if (c && c.group && (v.phase === 'allocating' || v.phase === 'allocated')) {
    if (v.phase === 'allocated' || c.allocation === 'auto' || reduced) lit = c.group;
    else {
      const u = (clock(v, store.now()) - c.alloc.startedAt) / c.alloc.dur, i = Math.min(c.alloc.flips, Math.floor(c.alloc.flips * flipEase(u / 0.86)));
      const other = c.group === 'A' ? 'B' : 'A'; lit = (c.alloc.flips - i) % 2 === 0 ? c.group : other;
      if (lastFlip !== null && lastFlip !== i) sound.play('flip'); lastFlip = i;
    }
  } else lastFlip = null;
  tiles[0].classList.toggle('lit', lit === 'A'); tiles[2].classList.toggle('lit', lit === 'B');
  $('#selector').classList.toggle('settled', v.phase === 'allocated');
  requestAnimationFrame(frame);
}
setInterval(() => { if (document.hidden) store.autoTick(); }, 250);   // keeps the draw moving if this tab is in the background

// ---------- particles ----------
function particles(canvas, { count, gold = false }) {
  const c = canvas.getContext('2d'); let ps = [], run = false, w = 0, h = 0;
  const size = () => { w = canvas.width = canvas.clientWidth; h = canvas.height = canvas.clientHeight; };
  const seed = () => { ps = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h, z: 0.3 + Math.random() * 0.7, r: Math.random() * 6.28, s: Math.random() })); };
  function loop(t) {
    if (!run) return; c.clearRect(0, 0, w, h);
    for (const p of ps) {
      if (gold) { p.y += (0.5 + p.z * 1.6) * h / 900; p.x += Math.sin(t / 900 + p.r) * 0.6; if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
        c.save(); c.translate(p.x, p.y); c.rotate(t / 700 * (p.s - 0.5) * 4 + p.r); c.fillStyle = `rgba(255,${200 + Math.round(p.s * 40)},${40 + Math.round(p.s * 90)},${0.25 + p.z * 0.5})`; c.fillRect(-3 * p.z * h / 900, -1.2 * h / 900, 7 * p.z * h / 900, 2.6 * h / 900); c.restore();
      } else { p.y -= 0.12 * p.z; p.x += 0.05 * p.z; if (p.y < -5) p.y = h + 5; if (p.x > w + 5) p.x = -5;
        c.fillStyle = `rgba(255,220,130,${0.4 * p.z * (0.5 + 0.5 * Math.sin(t / 900 * (0.5 + p.s) + p.r))})`; c.beginPath(); c.arc(p.x, p.y, (0.6 + p.z * 1.6) * h / 900, 0, 6.28); c.fill(); }
    }
    requestAnimationFrame(loop);
  }
  return { start() { if (reduced || run) return; size(); seed(); run = true; requestAnimationFrame(loop); }, stop() { run = false; c.clearRect(0, 0, w, h); }, size };
}
const dust = particles($('#fx'), { count: 70 }), confetti = particles($('#confetti'), { count: 90, gold: true });
dust.start(); addEventListener('resize', () => { dust.size(); wheel.resize(); const nm = $('#rvName'); if (nm.textContent) fitName(nm); });

// ---------- controls ----------
const act = (name, ...a) => { sound.unlock(); return store.dispatch(name, ...a); };
function primary() {
  const v = store.view(), p = primaryAction(v);
  if (p) act(p); else if (v.phase === 'complete') act('setView', 'final');
}
if (!follower) {
  $('#btnPrimary').onclick = primary;
  $('#btnPause').onclick = () => act(store.view().paused ? 'resume' : 'pause');
  $('#btnUndo').onclick = async () => { const v = store.view(), last = v.phase === 'picked' ? v.pairs[v.current.pairId] : v.history.length ? v.history[v.history.length - 1].pair : null; if (last && await confirmDialog({ title: 'Undo last draw?', text: `${last} goes back into the wheel and leaves its group.`, ok: 'Undo' })) act('undo'); };
  $('#btnReset').onclick = async () => { if (await confirmDialog({ title: 'Reset the entire draw?', text: 'All 12 pairs return to the wheel and both groups are emptied. This cannot be undone.', ok: 'Reset draw' })) act('reset'); };
  $('#btnBackArena').onclick = () => act('setView', 'arena');
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, dialog') || e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); primary(); }
    if (e.key === 'p' || e.key === 'P') setPresent(!present);
    if (e.key === 'Escape' && present && !document.fullscreenElement) setPresent(false);
  });
}
$('#btnSound').onclick = () => { sound.unlock(); if (follower) { const on = $('#btnSound').getAttribute('aria-pressed') !== 'true'; sound.setEnabled(on); $('#btnSound').textContent = on ? 'Sound on' : 'Sound off'; $('#btnSound').setAttribute('aria-pressed', on); } else store.dispatch('setSound', !store.view().sound); };
$('#btnFs').onclick = () => { sound.unlock(); toggleFullscreen(); };
$('#btnPresent').onclick = () => setPresent(!present);
$('#btnHistory').onclick = () => { $('#historyDrawer').hidden = !$('#historyDrawer').hidden; };
$('#btnHistoryClose').onclick = () => { $('#historyDrawer').hidden = true; };
$('#btnJson').onclick = () => downloadJson(store.view()); $('#btnCsv').onclick = () => downloadCsv(store.view());
$('#btnImage').onclick = () => downloadImage(store.view()); $('#btnPrint').onclick = () => printResults(store.view());
addEventListener('keydown', (e) => { if ((e.key === 'f' || e.key === 'F') && !e.target.closest('input, dialog')) toggleFullscreen(); });
addEventListener('pointerdown', () => { sound.unlock().then(() => { $('#soundGate').hidden = true; }); }, { capture: true });
document.addEventListener('fullscreenchange', () => { $('#btnFs').textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; requestAnimationFrame(() => wheel.resize()); });
// hide the pointer and header tools when the presentation is left alone
let idleTimer; const wake = () => { body.classList.remove('idle-ui'); clearTimeout(idleTimer); idleTimer = setTimeout(() => body.classList.add('idle-ui'), 3000); };
addEventListener('pointermove', wake); wake();

document.fonts.ready.then(() => { requestAnimationFrame(frame); });
window.__draw = { store };          // for the automated end-to-end test
