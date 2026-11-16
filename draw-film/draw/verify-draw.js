// Verifies draw.json: hash matches commitment, draw is reproducible from its seed, and is structurally valid.
// Prints PASS/FAIL only (add --show to print the groups).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { runDraw } = require('./draw-lib');
const dir = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || __dirname;
const bytes = fs.readFileSync(path.join(dir, 'draw.json'));
const draw = JSON.parse(bytes), commit = JSON.parse(fs.readFileSync(path.join(dir, 'commitment.json')));
const official = JSON.parse(fs.readFileSync(path.join(__dirname, 'pairs.json')));
const checks = [];
const ok = (name, cond) => checks.push([name, !!cond]);
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
ok('SHA-256 of draw.json matches commitment', sha === commit.sha256);
ok('seed hash matches commitment', crypto.createHash('sha256').update(draw.seed, 'utf8').digest('hex') === commit.seedSha256);
ok('pair list is the exact official 12', JSON.stringify(draw.pairs) === JSON.stringify(official) && official.length === 12);
const re = runDraw(official, draw.seed);
ok('draw reproduces exactly from seed', JSON.stringify(re.selections) === JSON.stringify(draw.selections) && JSON.stringify(re.groups) === JSON.stringify(draw.groups));
ok('12 selections', draw.selections.length === 12);
ok('every pair drawn exactly once', [...draw.selections.map(s => s.pair)].sort().join('|') === [...official].sort().join('|'));
ok('Group A has exactly 6', draw.groups.A.length === 6);
ok('Group B has exactly 6', draw.groups.B.length === 6);
ok('groups cover all 12 without duplicates', new Set([...draw.groups.A, ...draw.groups.B]).size === 12);
let a = 0, b = 0, autoOk = true;
for (const s of draw.selections) {
  const full = a === 6 || b === 6;
  if ((s.allocation === 'auto') !== full) autoOk = false;
  if (full && s.group !== (a === 6 ? 'B' : 'A')) autoOk = false;
  s.group === 'A' ? a++ : b++;
}
ok('auto-assignment used only once a group was full', autoOk);
for (const [n, c] of checks) console.log((c ? 'PASS  ' : 'FAIL  ') + n);
console.log('sha256 ' + sha);
if (process.argv.includes('--show')) console.log(JSON.stringify(draw.groups, null, 2));
process.exit(checks.every(c => c[1]) ? 0 : 1);
