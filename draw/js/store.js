// One authoritative draw state.
//  • Same computer (control window + audience window): localStorage is the single source of truth,
//    BroadcastChannel / storage events keep every window in step. Works with no internet.
//  • Other devices: the organiser's panel mirrors each change to Firebase Realtime Database
//    (needs sign-in); screens opened with ?cloud follow it read-only.
import { initialState, actions, tick, validate, cryptoRng } from './engine.js';

const KEY = 'pemberani-e3-live-draw-v1', CHANNEL = 'pemberani-e3-live-draw';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2';

export function createStore({ follower = false } = {}) {
  const rng = cryptoRng(), subs = new Set(), statusSubs = new Set();
  let skew = 0;                                   // follower only: controller clock − this clock
  let cloud = { status: follower ? 'connecting' : 'off', user: null, error: null, push: null, pending: null };
  const bc = !follower && 'BroadcastChannel' in self ? new BroadcastChannel(CHANNEL) : null;
  const load = () => { try { const raw = localStorage.getItem(KEY); return raw ? validate(JSON.parse(raw)) : null; } catch (e) { console.warn('Stored draw unreadable', e); return null; } };
  let state = (!follower && load()) || initialState(follower ? 0 : Date.now());
  let persisted = !follower && !!load();
  const emit = () => subs.forEach((cb) => cb(state));
  const emitStatus = () => statusSubs.forEach((cb) => cb({ ...cloud, push: undefined }));
  const now = () => Date.now() + skew;

  function commit(n, base) {
    n.rev = base.rev + 1; n.updatedAt = Date.now(); validate(n);
    localStorage.setItem(KEY, JSON.stringify(n));           // throws if storage is unavailable -> nothing changes
    state = n; persisted = true;
    if (bc) bc.postMessage(n);
    emit();
    if (cloud.push) cloud.push(n);
    return true;
  }
  function adopt(n) { if (n && n.rev > state.rev) { state = n; emit(); } }
  if (!follower) {
    if (bc) bc.onmessage = (e) => { try { adopt(validate(e.data)); } catch {} };
    addEventListener('storage', (e) => { if (e.key === KEY) { const l = load(); if (l) adopt(l); } });
  }

  const api = {
    follower,
    get: () => state,
    view: () => tick(state, now()),                // what the screens should show right now (pure)
    now,
    subscribe(cb) { subs.add(cb); cb(state); return () => subs.delete(cb); },
    onStatus(cb) { statusSubs.add(cb); cb({ ...cloud, push: undefined }); },
    dispatch(name, ...args) {
      if (follower) return false;
      const latest = load() || state, base = tick(latest, Date.now());
      const extra = name === 'drawNext' || name === 'revealGroup' ? [rng] : args;
      const n = actions[name](base, Date.now(), ...extra);
      if (!n) { if (latest.rev > state.rev) adopt(latest); return false; }
      return commit(n, latest);
    },
    // persists time-driven transitions (spin finished, allocation finished, final reveal)
    autoTick() {
      if (follower) return;
      const t = tick(state, Date.now()); if (t === state) return;
      const latest = load();
      if (latest && latest.rev !== state.rev) { adopt(latest); return; }
      commit(JSON.parse(JSON.stringify(t)), state);
    },

    // ---------- cloud (optional) ----------
    async connectCloud({ auth = false } = {}) {
      try {
        const [{ firebaseConfig }, { DB_ROOT }] = await Promise.all([import('../../js/firebase-config.js'), import('../../js/config.js')]);
        const [{ initializeApp }, db, au] = await Promise.all([import(`${FB}/firebase-app.js`), import(`${FB}/firebase-database.js`), auth ? import(`${FB}/firebase-auth.js`) : null]);
        const app = initializeApp(firebaseConfig, 'live-draw'), database = db.getDatabase(app), ref = db.ref(database, `${DB_ROOT}/draw`);
        let offset = 0, connected = false;
        db.onValue(db.ref(database, '.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });
        db.onValue(db.ref(database, '.info/connected'), (s) => { connected = !!s.val(); if (follower) { cloud.status = connected ? (state.rev ? 'live' : 'waiting') : 'offline'; emitStatus(); } else if (cloud.user) { cloud.status = connected ? 'live' : 'offline'; emitStatus(); } });
        if (follower) {
          db.onValue(ref, (snap) => {
            const v = snap.val(); if (!v || !v.json) { cloud.status = connected ? 'waiting' : 'offline'; emitStatus(); return; }
            try { const s = validate(JSON.parse(v.json)); skew = offset - (v.clockOffset || 0); state = s; cloud.status = 'live'; emit(); emitStatus(); } catch (e) { console.warn(e); }
          }, (err) => { cloud.status = 'error'; cloud.error = err.message; emitStatus(); });
          return api;
        }
        const authInst = au.getAuth(app);
        const push = (s) => db.set(ref, { json: JSON.stringify(s), rev: s.rev, updatedAt: s.updatedAt, clockOffset: offset })
          .then(() => { if (cloud.error) { cloud.error = null; emitStatus(); } })
          .catch((err) => { cloud.error = /permission/i.test(err.message) ? 'This account is not allowed to publish the draw (not in the Firebase admins list).' : err.message; cloud.status = 'error'; emitStatus(); });
        au.onAuthStateChanged(authInst, async (user) => {
          cloud.user = user ? user.email : null; cloud.error = null;
          if (!user) { cloud.push = null; cloud.status = 'signed-out'; emitStatus(); return; }
          cloud.status = connected ? 'live' : 'offline';
          const snap = await db.get(ref).catch(() => null), v = snap && snap.val();
          let remote = null; try { remote = v && v.json ? validate(JSON.parse(v.json)) : null; } catch {}
          // a different draw already in the cloud with progress, while this laptop has none: let the organiser choose
          if (remote && remote.drawId !== state.drawId && remote.history.length > 0 && state.history.length === 0 && state.phase === 'idle') { cloud.pending = remote; cloud.status = 'choose'; emitStatus(); return; }
          cloud.push = push; push(state); emitStatus();
        });
        api.cloud = {
          signIn: (email, password) => au.signInWithEmailAndPassword(authInst, email, password),
          signOut: () => au.signOut(authInst),
          resolve(useRemote) {
            if (!cloud.pending) return;
            if (useRemote) { const r = cloud.pending; r.rev = Math.max(r.rev, state.rev) + 1; localStorage.setItem(KEY, JSON.stringify(r)); state = r; if (bc) bc.postMessage(r); emit(); }
            cloud.pending = null; cloud.push = push; cloud.status = connected ? 'live' : 'offline'; push(state); emitStatus();
          },
        };
        cloud.status = follower ? cloud.status : 'signed-out'; emitStatus();
      } catch (err) { cloud.status = 'error'; cloud.error = 'Could not reach the realtime service: ' + err.message; emitStatus(); }
      return api;
    },
  };
  if (!follower && !persisted) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
  return api;
}
