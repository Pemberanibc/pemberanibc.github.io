// Deterministic draw procedure. Given a seed, the result is fully reproducible.
// Random stream: HMAC-SHA256(seed, "pemberani-e3-draw:" + counter), consumed 4 bytes
// at a time; uniform integers via rejection sampling (no modulo bias).
const crypto = require('crypto');

function makeStream(seedHex) {
  const key = Buffer.from(seedHex, 'hex');
  let counter = 0, buf = Buffer.alloc(0), off = 0;
  function u32() {
    if (off + 4 > buf.length) {
      buf = crypto.createHmac('sha256', key).update('pemberani-e3-draw:' + counter++).digest();
      off = 0;
    }
    const v = buf.readUInt32BE(off); off += 4; return v;
  }
  return function uniform(n) {            // uniform integer in [0, n)
    if (n === 1) return 0;
    const limit = Math.floor(0x100000000 / n) * n;
    let v; do { v = u32(); } while (v >= limit);
    return v % n;
  };
}

function runDraw(pairs, seedHex) {
  const uniform = makeStream(seedHex);
  const pool = pairs.map((name, id) => ({ id, name }));
  const groups = { A: [], B: [] };
  const selections = [];
  while (pool.length) {
    const poolSize = pool.length;
    const poolIndex = uniform(poolSize);          // wheel: pick one remaining pair
    const picked = pool.splice(poolIndex, 1)[0];
    let group, allocation;
    if (groups.A.length < 6 && groups.B.length < 6) {
      group = uniform(2) === 0 ? 'A' : 'B';       // A/B spinner
      allocation = 'random';
    } else {
      group = groups.A.length < 6 ? 'A' : 'B';    // other group is full
      allocation = 'auto';
    }
    groups[group].push(picked.name);
    selections.push({ order: selections.length + 1, pairId: picked.id, pair: picked.name,
                      poolSize, poolIndex, group, allocation });
  }
  return { selections, groups };
}
module.exports = { runDraw };
