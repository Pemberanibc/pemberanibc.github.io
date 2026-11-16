// node --test draw/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { PAIRS, CAP, DUR, initialState, actions, tick, can, validate, results, resultsCsv, cryptoRng, POINTER, TAU } from '../js/engine.js';

const rng = cryptoRng(webcrypto);
const scripted = (seq) => { let i = 0; return { int: (n) => { const v = seq[i++ % seq.length] % n; return v; } }; };
function step(s, now, r = rng) {           // one complete draw: pick -> spin -> reveal -> allocate -> next
  s = actions.drawNext(s, now.t, r); assert.ok(s); validate(s);
  assert.equal(actions.drawNext(s, now.t, r), null, 'cannot draw during spin');
  assert.equal(actions.revealGroup(s, now.t, r), null, 'cannot reveal during spin');
  now.t += DUR.spin; s = tick(s, now.t); assert.equal(s.phase, 'picked'); validate(s);
  assert.equal(actions.drawNext(s, now.t, r), null, 'cannot draw next pair before allocation');
  s = actions.revealGroup(s, now.t, r); assert.ok(s);
  now.t += s.current.alloc.dur; s = tick(s, now.t); assert.equal(s.phase, 'allocated'); validate(s);
  return s;
}
function fullDraw(r = rng) {
  const now = { t: 1e12 }; let s = actions.start(initialState(now.t), now.t);
  for (let i = 0; i < 12; i++) { s = step(s, now, r); if (i < 11) s = actions.next(s, now.t); }
  now.t += DUR.finalDelay; s = tick(s, now.t);
  return { s, now };
}

test('full draw: 12 entries, each exactly once, 6 + 6 (500 runs)', () => {
  for (let run = 0; run < 500; run++) {
    const { s } = fullDraw();
    assert.equal(s.phase, 'complete'); validate(s);
    assert.equal(s.groups.A.length, CAP); assert.equal(s.groups.B.length, CAP);
    assert.deepEqual([...s.groups.A, ...s.groups.B].sort((a, b) => a - b), [...Array(12).keys()]);
    assert.deepEqual(s.history.map((h) => h.pair).sort(), [...PAIRS].sort());
    assert.equal(new Set(s.history.map((h) => h.pairId)).size, 12);
  }
});

test('auto-assignment once a group is full, never more than six', () => {
  const { s } = fullDraw(scripted([0]));          // always first pair, always group A
  assert.deepEqual(s.history.map((h) => h.group), ['A', 'A', 'A', 'A', 'A', 'A', 'B', 'B', 'B', 'B', 'B', 'B']);
  assert.deepEqual(s.history.map((h) => h.allocation), [...Array(6).fill('random'), ...Array(6).fill('auto')]);
  for (let run = 0; run < 300; run++) {
    const { s } = fullDraw(); let a = 0, b = 0;
    for (const h of s.history) { assert.equal(h.allocation, a === CAP || b === CAP ? 'auto' : 'random'); h.group === 'A' ? a++ : b++; assert.ok(a <= CAP && b <= CAP); }
  }
});

test('the wheel stops with the selected pair under the pointer', () => {
  const now = { t: 1e12 }; let s = actions.start(initialState(now.t), now.t);
  for (let i = 0; i < 12; i++) {
    s = actions.drawNext(s, now.t, rng); const c = s.current, n = c.poolBefore.length;
    const a = (((POINTER - c.spin.to) % TAU) + TAU) % TAU;
    assert.equal(c.poolBefore[Math.floor(a / (TAU / n))], c.pairId);
    assert.ok(c.spin.to - c.spin.from > TAU * 4);
    now.t += DUR.spin; s = tick(s, now.t); s = actions.revealGroup(s, now.t, rng); now.t += s.current.alloc.dur; s = tick(s, now.t);
    if (i < 11) s = actions.next(s, now.t);
  }
});

test('selection and allocation are uniform', () => {
  const first = Array(12).fill(0), grp = { A: 0, B: 0 }, N = 12000;
  for (let i = 0; i < N; i++) {
    let s = actions.start(initialState(0), 0); s = actions.drawNext(s, 0, rng); first[s.current.pairId]++;
    s = tick(s, DUR.spin); s = actions.revealGroup(s, DUR.spin, rng); grp[s.current.group]++;
  }
  first.forEach((c) => assert.ok(Math.abs(c - N / 12) < 150, 'pair frequency ' + c));
  assert.ok(Math.abs(grp.A - N / 2) < 300, 'group frequency ' + grp.A);
});

test('undo restores the pair to the pool and reverses its group', () => {
  const now = { t: 1e12 }; let s = actions.start(initialState(now.t), now.t);
  s = step(s, now); s = actions.next(s, now.t); s = step(s, now);
  const last = s.history[1], before = s.history[0];
  let u = actions.undo(s, now.t); validate(u);
  assert.equal(u.phase, 'ready'); assert.equal(u.history.length, 1); assert.deepEqual(u.history[0], before);
  assert.ok(u.remaining.includes(last.pairId)); assert.ok(!u.groups[last.group].includes(last.pairId)); assert.equal(u.remaining.length, 11);
  // undo while a pair is picked but not yet allocated
  let p = actions.drawNext(u, now.t, rng); now.t += DUR.spin; p = tick(p, now.t);
  const picked = p.current.pairId; p = actions.undo(p, now.t); validate(p);
  assert.ok(p.remaining.includes(picked)); assert.equal(p.remaining.length, 11); assert.equal(p.history.length, 1);
  // not during an animation
  const spinning = actions.drawNext(p, now.t, rng); assert.equal(actions.undo(spinning, now.t), null);
  // undo from the completed draw reopens it
  const done = fullDraw().s; const r = actions.undo(done, 0); validate(r);
  assert.equal(r.phase, 'ready'); assert.equal(r.history.length, 11); assert.equal(r.remaining.length, 1); assert.equal(r.view, 'arena');
});

test('reset returns to an empty draw and keeps the revision counter rising', () => {
  const { s, now } = fullDraw(); const r = actions.reset(s, now.t); validate(r);
  assert.equal(r.phase, 'idle'); assert.equal(r.remaining.length, 12); assert.equal(r.history.length, 0);
  assert.deepEqual(r.groups, { A: [], B: [] }); assert.ok(r.rev > s.rev); assert.notEqual(r.drawId, s.drawId);
});

test('pause freezes the animation clock; resume continues where it stopped', () => {
  let s = actions.start(initialState(0), 0); s = actions.drawNext(s, 1000, rng);
  s = actions.pause(s, 3000); assert.ok(s.paused);
  assert.equal(tick(s, 999999).phase, 'spinning', 'paused spin never finishes');
  assert.equal(actions.revealGroup(s, 5000, rng), null); assert.equal(can(s).resume, true);
  s = actions.resume(s, 60000); assert.equal(tick(s, 60000 + DUR.spin - 2001).phase, 'spinning');
  assert.equal(tick(s, 60000 + DUR.spin - 1999).phase, 'picked');
});

test('state survives a JSON round trip (refresh recovery) at every phase', () => {
  const now = { t: 1e12 }; let s = actions.start(initialState(now.t), now.t);
  const rt = (x) => validate(JSON.parse(JSON.stringify(x)));
  for (let i = 0; i < 12; i++) {
    s = rt(actions.drawNext(s, now.t, rng)); now.t += DUR.spin / 2; s = rt(tick(s, now.t)); assert.equal(s.phase, 'spinning');
    now.t += DUR.spin; s = rt(tick(s, now.t)); s = rt(actions.revealGroup(s, now.t, rng)); now.t += DUR.alloc; s = rt(tick(s, now.t));
    if (i < 11) s = rt(actions.next(s, now.t));
  }
  now.t += DUR.finalDelay; s = rt(tick(s, now.t)); assert.equal(s.phase, 'complete');
});

test('exports match the final draw', () => {
  const { s } = fullDraw(); const r = results(s), csv = resultsCsv(s).trim().split('\r\n');
  assert.equal(r.complete, true);
  assert.deepEqual(r.groups.A, s.groups.A.map((id) => PAIRS[id])); assert.deepEqual(r.groups.B, s.groups.B.map((id) => PAIRS[id]));
  assert.equal(csv.length, 13);
  s.history.forEach((h, i) => { assert.equal(r.history[i].pair, h.pair); assert.equal(r.history[i].group, h.group); assert.ok(csv[i + 1].startsWith(`${i + 1},"${h.pair}",Group ${h.group},`)); });
});

test('validate rejects corrupted states', () => {
  const { s } = fullDraw();
  const dup = JSON.parse(JSON.stringify(s)); dup.groups.A[0] = dup.groups.A[1]; assert.throws(() => validate(dup));
  const seven = JSON.parse(JSON.stringify(s)); seven.groups.A.push(seven.groups.B.pop()); assert.throws(() => validate(seven));
  const names = JSON.parse(JSON.stringify(s)); names.pairs[0] = 'Herman & Poknick'; assert.throws(() => validate(names));
});
