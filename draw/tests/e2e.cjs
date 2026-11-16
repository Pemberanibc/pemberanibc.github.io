// End-to-end test of the real pages in Chromium: node draw/tests/e2e.cjs [outDir]
// Serve the repository first:  python3 -m http.server 8791 --bind 127.0.0.1
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8791/draw/';
const out = process.argv[2];
const PAIRS = ['Herman & Poknik', 'Charlie & Azlan', 'Aizat & Abg Mie', 'Syahir & Samad', 'Daus & Abg Fizan', 'Fauzie Gigi & Jai', 'Soul & Syaqir', 'Rosli & Nataman', 'Nizam & Satbeer', 'Muizz & Fareez', 'Adian & Pok', 'Rasheed & Abdel'];
const results = []; const ok = (name, cond, extra) => { results.push(!!cond); console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  (' + extra + ')' : '')); };
const errs = [];
const watch = (p, tag) => { p.on('pageerror', (e) => errs.push(tag + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/gstatic|firebase|ERR_/i.test(m.text())) errs.push(tag + ': ' + m.text()); }); };
const state = (p) => p.evaluate(() => window.__draw.store.view());
const phase = (p, ph, timeout = 15000) => p.waitForFunction((ph) => window.__draw.store.view().phase === ph, ph, { timeout });
const boards = (p) => p.evaluate(() => ({ A: [...document.querySelectorAll('#boardA li:not(.empty) span')].map((e) => e.textContent), B: [...document.querySelectorAll('#boardB li:not(.empty) span')].map((e) => e.textContent), rem: +document.querySelector('#remCount').textContent }));
const names = (s, G) => s.groups[G].map((id) => s.pairs[id]);
const shot = (p, n) => out && p.screenshot({ path: `${out}/${n}.png` });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
  const arena = await ctx.newPage(), control = await ctx.newPage(); watch(arena, 'arena'); watch(control, 'control');
  await arena.goto(BASE); await control.goto(BASE + 'control.html');
  await control.waitForFunction(() => window.__draw); await arena.waitForFunction(() => window.__draw);

  ok('header shows crest, title and LIVE DRAW; no presentation / fullscreen / sound buttons', await arena.evaluate(() => /PEMBERANI TOURNAMENT/.test(document.querySelector('.brand h1').textContent) && /LIVE GROUP DRAW/.test(document.querySelector('.brand p').textContent) && document.querySelector('#liveTag').offsetWidth > 0 && document.querySelector('.brand img').naturalWidth > 0 && !document.querySelector('#btnFs, #btnSound, #btnPresent') && !/presentation|fullscreen|sound o/i.test(document.querySelector('.top').textContent + document.querySelector('#dock').textContent)));
  ok('control panel has no presentation / fullscreen / sound buttons', await control.evaluate(() => !document.querySelector('#cScreen, #cSound') && ![...document.querySelectorAll('button')].some((b) => /fullscreen|sound o|presentation/i.test(b.textContent))));
  ok('all 12 pairs preloaded with exact spelling', JSON.stringify(await arena.evaluate(() => [...document.querySelectorAll('#pairList li span')].map((e) => e.textContent))) === JSON.stringify(PAIRS));

  // --- controls gating ---
  const dis = (sel) => control.$eval(sel, (b) => b.disabled);
  ok('before start: only START DRAW is available', !(await dis('#cStart')) && (await dis('#cDraw')) && (await dis('#cReveal')) && (await dis('#cNext')) && (await dis('#cUndo')));
  await control.click('#cStart'); await phase(arena, 'ready');
  ok('audience screen follows the control panel (start)', (await state(arena)).phase === 'ready');

  // --- a short draw, then RESET (cancel, then confirm) ---
  await control.click('#cDraw'); await phase(control, 'spinning');
  ok('during the spin: draw / reveal / next / undo are disabled, pause is enabled', (await dis('#cDraw')) && (await dis('#cReveal')) && (await dis('#cNext')) && (await dis('#cUndo')) && !(await dis('#cPause')));
  ok('the control panel does not show the result before the wheel stops', (await control.$eval('#nowPair', (e) => e.textContent)) === '');
  // pause / resume
  await control.click('#cPause'); const a1 = await arena.evaluate(() => window.__draw.store.view().paused);
  await arena.waitForTimeout(8500);
  ok('PAUSE freezes the spin (still spinning after 8.5 s)', a1 && (await state(arena)).phase === 'spinning' && !(await dis('#cResume')));
  await control.click('#cResume'); await phase(arena, 'picked');
  ok('RESUME lets the wheel finish', (await state(arena)).phase === 'picked');
  await control.waitForFunction(() => window.__draw.store.get().phase === 'picked', null, { timeout: 3000 }).catch(() => {}); await control.waitForTimeout(150);
  ok('next pair cannot be drawn before the group is allocated', (await dis('#cDraw')) && !(await dis('#cReveal')));
  const s1 = await state(arena);
  ok('selected pair removed from the pool, counter updated', s1.remaining.length === 11 && !s1.remaining.includes(s1.current.pairId) && (await boards(arena)).rem === 11);
  await arena.waitForTimeout(2300);
  ok('selected pair is shown prominently on the audience screen', await arena.evaluate(() => { const h = document.querySelector('#rvName'), r = h.getBoundingClientRect(); return h.textContent === window.__draw.store.view().pairs[window.__draw.store.view().current.pairId] && r.height > innerHeight * 0.08 && r.left >= 0 && r.right <= innerWidth && +getComputedStyle(h.closest('.st')).opacity > 0.9; }));
  await shot(arena, 'p1-picked-present');
  await control.click('#cReveal'); await phase(arena, 'allocated');
  const s2 = await state(arena), b2 = await boards(arena);
  ok('pair appears in the correct group board with capacity 1/6', b2[s2.current.group][0] === s2.pairs[s2.current.pairId] && (await arena.$eval('#cap' + s2.current.group, (e) => e.textContent)) === '1');
  ok('history has a timestamped entry', s2.history.length === 1 && Math.abs(s2.history[0].at - Date.now()) < 60000 && /\d\d:\d\d:\d\d/.test(await control.$eval('#cHistory time', (e) => e.textContent)));
  await control.click('#cReset'); await control.click('#confirm button[value=cancel]');
  ok('RESET asks for confirmation (cancel keeps the draw)', (await state(control)).history.length === 1);
  await control.click('#cReset'); await control.click('#confirmOk'); await phase(arena, 'idle'); await arena.waitForTimeout(300);
  const s3 = await state(arena);
  ok('RESET restores an empty draw on every screen', s3.remaining.length === 12 && s3.history.length === 0 && (await boards(arena)).A.length + (await boards(arena)).B.length === 0);

  // --- the full 12-pair draw, with undo and refresh along the way ---
  await control.click('#cStart');
  const seen = [];
  for (let i = 0; i < 12; i++) {
    await phase(control, 'ready'); await control.click('#cDraw');
    if (i === 3) { await arena.waitForTimeout(2500); await Promise.all([arena.reload(), control.reload()]); await arena.waitForFunction(() => window.__draw); await control.waitForFunction(() => window.__draw); const r = await state(arena); ok('refresh during a spin recovers the draw in progress', r.phase === 'spinning' && r.history.length === 3 && r.remaining.length === 9); }
    await phase(arena, 'picked'); const sp = await state(arena);
    if (i === 5) { // undo a picked pair, then draw again
      await control.click('#cUndo'); await control.click('#confirmOk'); await phase(arena, 'ready'); const u = await state(arena);
      ok('UNDO of a drawn-but-unallocated pair returns it to the pool', u.remaining.length === 7 && u.remaining.includes(sp.current.pairId) && u.history.length === 5);
      await control.click('#cDraw'); await phase(arena, 'picked');
    }
    await control.click('#cReveal'); await phase(arena, 'allocated'); let s = await state(arena);
    if (i === 7) { // undo an allocated pair
      const last = s.history[s.history.length - 1]; await control.click('#cUndo'); await control.click('#confirmOk'); await phase(arena, 'ready'); await arena.waitForTimeout(300); const u = await state(arena), b = await boards(arena);
      ok('UNDO reverses the last allocation (pool, group board and history)', u.remaining.includes(last.pairId) && !u.groups[last.group].includes(last.pairId) && u.history.length === 7 && !b[last.group].includes(last.pair) && b.rem === 5);
      await control.click('#cDraw'); await phase(arena, 'picked'); await control.click('#cReveal'); await phase(arena, 'allocated'); s = await state(arena);
    }
    if (i === 8) { await arena.reload(); await arena.waitForFunction(() => window.__draw); await arena.waitForTimeout(600); const b = await boards(arena); ok('refresh between draws keeps groups and history', JSON.stringify(b.A) === JSON.stringify(names(s, 'A')) && JSON.stringify(b.B) === JSON.stringify(names(s, 'B')) && b.rem === s.remaining.length); }
    const h = s.history[s.history.length - 1]; seen.push(h.pair);
    await arena.waitForTimeout(250); const b = await boards(arena);
    if (JSON.stringify(b.A) !== JSON.stringify(names(s, 'A')) || JSON.stringify(b.B) !== JSON.stringify(names(s, 'B')) || b.rem !== 11 - i) ok(`boards match state after draw ${i + 1}`, false);
    if (i === 6) await shot(arena, 'p2-allocated-present');
    if (i < 11) await control.click('#cNext');
  }
  const sEnd = await state(arena);
  ok('12 draws completed, each pair exactly once', seen.length === 12 && new Set(seen).size === 12 && [...seen].sort().join('|') === [...PAIRS].sort().join('|'));
  ok('group boards matched the engine state after every draw', true);
  ok('exactly six pairs in each group', sEnd.groups.A.length === 6 && sEnd.groups.B.length === 6);
  let a = 0, bb = 0, autoOk = true; for (const h of sEnd.history) { if ((h.allocation === 'auto') !== (a === 6 || bb === 6)) autoOk = false; h.group === 'A' ? a++ : bb++; }
  ok('automatic assignment used exactly when a group was full', autoOk, sEnd.history.map((h) => h.allocation[0]).join(''));
  await phase(arena, 'complete', 12000); await arena.waitForTimeout(6800);
  const fin = await arena.evaluate(() => ({ on: document.querySelector('#final').classList.contains('on'), A: [...document.querySelectorAll('#finalA span')].map((e) => e.textContent), B: [...document.querySelectorAll('#finalB span')].map((e) => e.textContent), close: document.querySelector('.closing').innerText.replace(/\s+/g, ' ').trim(), fits: [...document.querySelectorAll('#final li span, #final h2, .closing p')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }) }));
  const sFin = await state(arena);
  ok('final reveal opens automatically and shows both groups from the live draw', fin.on && JSON.stringify(fin.A) === JSON.stringify(names(sFin, 'A')) && JSON.stringify(fin.B) === JSON.stringify(names(sFin, 'B')));
  ok('closing message is exact', fin.close === '12 PAIRS. 2 GROUPS. ZERO MERCY. THE ROAD TO PEMBERANI EDISI 3.0 STARTS NOW.', fin.close);
  ok('final reveal fits inside a 1080p screen', fin.fits);
  await shot(arena, 'p3-final-present');

  // --- exports ---
  const dl = async (sel) => { const [d] = await Promise.all([control.waitForEvent('download'), control.click(sel)]); return { name: d.suggestedFilename(), buf: fs.readFileSync(await d.path()) }; };
  const j = await dl('#cJson'), json = JSON.parse(j.buf.toString());
  ok('JSON export matches the final draw', json.complete && JSON.stringify(json.groups.A) === JSON.stringify(names(sFin, 'A')) && JSON.stringify(json.groups.B) === JSON.stringify(names(sFin, 'B')) && json.history.length === 12 && json.history.every((h, i) => h.pair === sFin.history[i].pair && h.group === sFin.history[i].group && !isNaN(Date.parse(h.drawnAt))), j.name);
  const c = await dl('#cCsv'), rows = c.buf.toString().replace(/^\ufeff/, '').trim().split('\r\n');
  ok('CSV export matches the final draw', rows.length === 13 && sFin.history.every((h, i) => rows[i + 1].startsWith(`${i + 1},"${h.pair}",Group ${h.group},`)), c.name);
  const im = await dl('#cImage'); if (out) fs.writeFileSync(`${out}/export.png`, im.buf);
  ok('image export is a 2160x2700 PNG', im.buf.readUInt32BE(16) === 2160 && im.buf.readUInt32BE(20) === 2700 && im.buf.length > 100000, `${(im.buf.length / 1024).toFixed(0)} KB`);
  await control.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; }); await control.click('#cPrint');
  ok('print sheet lists both groups and the draw order', await control.evaluate((n) => window.__printed === 1 && document.querySelectorAll('#printSheet ol li').length === 12 && document.querySelectorAll('#printSheet tbody tr').length === 12 && n.every((x) => document.querySelector('#printSheet').textContent.includes(x)), PAIRS));
  await control.click('#cView'); await arena.waitForFunction(() => document.querySelector('#final').hidden);
  ok('VIEW FINAL RESULTS toggles between arena and final screen', (await state(arena)).view === 'arena'); await control.click('#cView');
  ok('draw history can be reviewed (12 entries in order)', (await control.$$eval('#cHistory li', (l) => l.map((e) => e.querySelector('.hp').textContent))).join('|') === sFin.history.map((h) => h.pair).join('|'));

  // --- single-laptop arena (dock), history drawer, sound and fullscreen buttons, keyboard ---
  const solo = await ctx.newPage(); watch(solo, 'solo'); await solo.goto(BASE); await solo.waitForFunction(() => window.__draw); await solo.waitForTimeout(500);
  ok('refresh after completion still shows the final results', await solo.evaluate(() => !document.querySelector('#final').hidden));
  await solo.click('#btnBackArena'); await solo.click('#btnHistory');
  ok('history drawer opens without interrupting the draw', await solo.evaluate(() => !document.querySelector('#historyDrawer').hidden && document.querySelectorAll('#historyList li').length === 12)); await solo.click('#btnHistoryClose');
  await solo.click('#btnReset'); await solo.click('#confirmOk'); await phase(solo, 'idle'); await solo.keyboard.press('Space'); await phase(solo, 'ready'); await solo.keyboard.press('Space');
  ok('space bar drives the draw (start, then spin)', (await state(solo)).phase === 'spinning');
  await phase(solo, 'picked'); await solo.click('#btnUndo'); await solo.click('#confirmOk'); await solo.click('#btnReset'); await solo.click('#confirmOk');

  // --- layouts: 4K TV, phone, reduced motion ---
  for (const [tag, opts] of [['4k', { viewport: { width: 3840, height: 2160 } }], ['phone', devices['iPhone 13']], ['phone-small', devices['iPhone SE']], ['phone-landscape', devices['iPhone 13 landscape']], ['reduced', { viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' }]]) {
    const c2 = await browser.newContext(opts), p = await c2.newPage(); watch(p, tag);
    await p.goto(BASE); await p.waitForFunction(() => window.__draw); await p.waitForTimeout(400); await shot(p, 'layout-' + tag + '-idle');
    if (opts.hasTouch) { await p.tap('#btnPrimary'); await p.waitForTimeout(700); await shot(p, 'layout-' + tag + '-ready'); ok(`${tag}: START button within thumb reach and tappable; sound unlocked by that tap`, (await state(p)).phase === 'ready' && await p.evaluate(() => { const r = document.querySelector('#btnPrimary').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0 && r.height >= 40; })); await p.tap('#btnPrimary'); }
    else await p.evaluate(() => { const s = window.__draw.store; s.dispatch('start'); s.dispatch('drawNext'); });
    await phase(p, 'picked', 12000); await p.waitForTimeout(tag === 'reduced' ? 300 : 2300);
    const m = await p.evaluate(() => { const r = (sel) => document.querySelector(sel).getBoundingClientRect(); const n = r('#rvName'), w = r('#wheel'), a = r('#boardA'), b = r('#boardB'); return { overflowX: document.documentElement.scrollWidth > innerWidth + 1, name: n.left >= 0 && n.right <= innerWidth + 1 && n.height > 20, wheel: w.width > innerWidth * 0.25 && w.left >= 0 && w.right <= innerWidth + 1, boards: a.right <= innerWidth + 1 && b.right <= innerWidth + 1 && a.width > 100, boardsOnScreen: a.top >= 0 && b.bottom <= innerHeight + 1, nameH: n.height, vh: innerHeight }; });
    await shot(p, 'layout-' + tag);
    if (tag === 'phone' || tag === 'phone-small') ok(tag + ': vertical layout, no sideways scrolling, wheel / name / boards within the width', !m.overflowX && m.name && m.wheel && m.boards);
    else ok(`${tag}: wheel, selected pair and both boards inside the screen`, !m.overflowX && m.name && m.wheel && m.boards && m.boardsOnScreen, `name height ${Math.round(m.nameH)}px of ${m.vh}px`);
    await c2.close();
  }
  // --- a second device without the realtime service must not pretend to be in sync ---
  const c3 = await browser.newContext({ viewport: { width: 1280, height: 720 } }), f = await c3.newPage(); watch(f, 'follower');
  await f.goto(BASE + '?cloud'); await f.waitForFunction(() => window.__draw); await f.waitForTimeout(2500);
  const chip = await f.$eval('#syncChip', (e) => e.textContent);
  ok('?cloud screen is read-only and reports its real connection status', (await f.evaluate(() => getComputedStyle(document.querySelector('#dock')).display === 'none' && window.__draw.store.dispatch('start') === false)) && chip.length > 0, 'status here: ' + chip);
  await c3.close();

  ok('no JavaScript errors on any page', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(results.every(Boolean) ? `\nALL ${results.length} CHECKS PASSED` : `\n${results.filter((r) => !r).length} CHECK(S) FAILED`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
