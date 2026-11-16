// ONE-TIME sealed draw. Writes draw.json + commitment.json and prints NOTHING about the allocation.
// Usage: node generate-draw.js            (official draw; refuses to run twice)
//        node generate-draw.js --rehearsal <outDir>   (fixed public seed, layout testing only)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { runDraw } = require('./draw-lib');
const pairs = JSON.parse(fs.readFileSync(path.join(__dirname, 'pairs.json'), 'utf8'));
const rehearsal = process.argv[2] === '--rehearsal';
const outDir = rehearsal ? process.argv[3] : __dirname;
const drawPath = path.join(outDir, 'draw.json'), commitPath = path.join(outDir, 'commitment.json');
if (!rehearsal && (fs.existsSync(drawPath) || fs.existsSync(commitPath))) {
  console.error('REFUSED: an official draw already exists. The draw is generated only once.');
  process.exit(1);
}
const seed = rehearsal
  ? crypto.createHash('sha256').update('REHEARSAL-NOT-THE-OFFICIAL-DRAW').digest('hex')
  : crypto.randomBytes(32).toString('hex');       // OS CSPRNG
const generatedAt = new Date().toISOString();
const { selections, groups } = runDraw(pairs, seed);
const draw = {
  event: 'PEMBERANI TOURNAMENT EDISI 3.0 — OFFICIAL GROUP DRAW',
  official: !rehearsal, version: 1, generatedAt, seed,
  algorithm: 'HMAC-SHA256(seed, "pemberani-e3-draw:"+counter) stream, 32-bit rejection sampling; ' +
             'each step: uniform pick from remaining pool, then uniform A/B while both groups < 6, else auto',
  pairs, selections, groups,
};
const bytes = Buffer.from(JSON.stringify(draw, null, 2) + '\n', 'utf8');
fs.writeFileSync(drawPath, bytes, { flag: rehearsal ? 'w' : 'wx' });
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
fs.writeFileSync(commitPath, JSON.stringify({
  event: draw.event, official: !rehearsal, committedAt: generatedAt,
  file: 'draw.json', bytes: bytes.length, sha256,
  seedSha256: crypto.createHash('sha256').update(seed, 'utf8').digest('hex'),
  rng: 'Node.js crypto.randomBytes(32) (OS CSPRNG) -> 256-bit seed',
  node: process.version,
  note: 'The seed and allocation are inside draw.json and stay sealed until the film is rendered.',
}, null, 2) + '\n');
console.log((rehearsal ? 'REHEARSAL' : 'OFFICIAL') + ' draw sealed. sha256=' + sha256);
