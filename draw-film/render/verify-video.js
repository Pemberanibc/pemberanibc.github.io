// Blind verification: proves the rendered MP4 shows exactly the committed draw, WITHOUT printing the allocation.
//   node verify-video.js <drawDir> <video.mp4> [silent.mp4]
// 1) trace pass  – every frame is re-rendered and each name/letter the renderer draws is checked against draw.json
// 2) pixel pass  – frames are decoded from the MP4 itself and matched against all 12 candidate names / both groups
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const buildTimeline = require('../film/timeline.js');
const [drawDir, video, silent] = process.argv.slice(2);
const FILM_DIR = path.join(__dirname, '..', 'film');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2' };
const bytes = fs.readFileSync(path.join(drawDir, 'draw.json')), draw = JSON.parse(bytes);
const commit = JSON.parse(fs.readFileSync(path.join(drawDir, 'commitment.json')));
const T = buildTimeline(draw), FPS = T.fps;
const results = []; const ok = (name, cond, extra) => { results.push(!!cond); console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  (' + extra + ')' : '')); };

function videoCrop(file, frame, x, y, w, h) {
  return execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `select=eq(n\\,${frame}),crop=${w}:${h}:${x}:${y},scale=in_range=tv:out_range=pc:in_color_matrix=bt709,format=rgb24`, '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
}
(async () => {
  const srv = http.createServer((req, rsp) => { const f = path.join(FILM_DIR, path.basename(req.url) === 'crest.png' || req.url.includes('fonts/') ? req.url : path.basename(req.url)); fs.readFile(f, (e, d) => { if (e) { rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] }); rsp.end(d); }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
  const meta = { sha256: commit.sha256 };
  const info = await page.evaluate(([d, m]) => window.FILM.init(d, m), [draw, meta]);

  ok('draw.json SHA-256 matches commitment', crypto.createHash('sha256').update(bytes).digest('hex') === commit.sha256);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames,codec_name,pix_fmt', '-of', 'json', video])).streams[0];
  ok('video is 1080x1920 H.264 30fps', probe.width === 1080 && probe.height === 1920 && probe.codec_name === 'h264' && probe.r_frame_rate === '30/1', `${probe.width}x${probe.height} ${probe.codec_name} ${probe.r_frame_rate} ${probe.pix_fmt}`);
  ok('video frame count equals timeline', +probe.nb_read_frames === info.frames, `${probe.nb_read_frames} frames = ${(probe.nb_read_frames / FPS).toFixed(2)}s`);

  // ---------- 1) trace pass ----------
  const traces = await page.evaluate((n) => { const out = []; for (let i = 0; i < n; i++) { window.__trace = []; window.FILM.renderFrame(i); out.push(window.__trace); } window.__trace = null; return out; }, info.frames);
  const S = draw.selections; let hlOK = true, ptrOK = true, plateOK = true, reelOK = true, rowsOK = true, seenHL = 0, seenPlate = 0, seenReel = 0, minPlateFrames = 1e9;
  const plateFrames = S.map(() => 0);
  traces.forEach((tr) => tr.forEach((e) => {
    if (e.type === 'wheelHighlight') { seenHL++; if (S[e.k].pair !== e.name) hlOK = false; }
    if (e.type === 'pointerEntry') { if (S[e.k].pair !== e.name) ptrOK = false; }
    if (e.type === 'plate') { seenPlate++; plateFrames[e.k]++; if (S[e.k].pair !== e.name) plateOK = false; }
    if (e.type === 'reel') { seenReel++; if (S[e.k].group !== e.letter || S[e.k].group !== e.group || (S[e.k].allocation === 'auto') !== e.auto) reelOK = false; }
    if (e.type === 'boardRow' || e.type === 'finalRow') { if (draw.groups[e.group][e.slot] !== e.name) rowsOK = false; }
  }));
  minPlateFrames = Math.min(...plateFrames);
  ok('wheel: highlighted segment is the committed pair, all 12 selections', hlOK && seenHL > 0);
  ok('wheel: segment geometrically under the pointer is the committed pair', ptrOK);
  ok('name plate shows the committed pair, all 12 selections', plateOK && plateFrames.every((n) => n > 0), `each name on screen >= ${(minPlateFrames / FPS).toFixed(2)}s`);
  ok('A/B spinner lands on the committed group, all 12 selections', reelOK && seenReel > 0);
  ok('every board row (live boards + final boards) matches draw.json', rowsOK);
  // wheel shrink 12 -> 0 and no pair lost/duplicated on any frame
  let conserve = true;
  for (let i = Math.round(T.s3 * FPS); i < Math.round(T.s4 * FPS); i++) {
    const t = i / FPS, cur = T.selections.find((s) => t < s.end) || T.selections[11];
    const onWheel = cur.pool.filter((p) => !(p.id === cur.id && t >= cur.reflow1)).map((p) => p.name);
    const inTransit = t >= cur.reflow1 && t < cur.flyEnd ? [cur.name] : [];
    const rows = traces[i].filter((e) => e.type === 'boardRow').map((e) => e.name);
    const all = [...onWheel, ...inTransit, ...rows];
    if (all.length !== 12 || new Set(all).size !== 12) conserve = false;
  }
  ok('no pair disappears or appears twice on any frame of the draw', conserve);
  const full = traces.filter((tr) => tr.filter((e) => e.type === 'finalRow' && e.u >= 1).length === 12).length;
  const lastFinal = traces.map((tr) => tr.filter((e) => e.type === 'finalRow'));
  const fin = lastFinal[Math.round((T.s4 + 7) * FPS)];
  ok('final boards: 6 + 6 pairs, all 12 official names exactly once', fin.filter((e) => e.group === 'A').length === 6 && fin.filter((e) => e.group === 'B').length === 6 && fin.map((e) => e.name).sort().join('|') === [...draw.pairs].sort().join('|'), `complete boards held ${(full / FPS).toFixed(1)}s`);

  // ---------- 2) pixel pass against the MP4 ----------
  const renderCrop = async (hyp, frame, x, y, w, h) => Buffer.from(await page.evaluate(([d, m, f, x, y, w, h]) => { window.FILM.setDraw(d, m); window.FILM.renderFrame(f); const id = window.FILM.canvas.getContext('2d').getImageData(x, y, w, h).data; let s = ''; for (let i = 0; i < id.length; i += 4) s += String.fromCharCode(id[i], id[i + 1], id[i + 2]); return btoa(s); }, [hyp, meta, frame, x, y, w, h]), 'base64');
  const mse = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return s / a.length; };
  const clone = () => JSON.parse(JSON.stringify(draw));
  let nameMatch = true, groupMatch = true, worstMargin = 1e9, worstBest = 0;
  for (let k = 0; k < 12; k++) {
    const s = T.selections[k], f = Math.round((s.plateAt + 0.75) * FPS), vid = videoCrop(video, f, 60, 1050, 960, 120);
    const scores = [];
    for (let c = 0; c < 12; c++) { const h = clone(); h.selections[k].pair = draw.pairs[c]; scores.push(mse(vid, await renderCrop(h, f, 60, 1050, 960, 120))); }
    const best = scores.indexOf(Math.min(...scores)), second = Math.min(...scores.filter((_, i) => i !== best));
    if (draw.pairs[best] !== draw.selections[k].pair) nameMatch = false;
    worstMargin = Math.min(worstMargin, second / scores[best]); worstBest = Math.max(worstBest, scores[best]);
    // group: reel window + both lamps, just after the spinner stops
    const f2 = Math.round((s.reelEnd + 0.1) * FPS), vid2 = videoCrop(video, f2, 60, 1200, 960, 120);
    const gs = {};
    for (const G of ['A', 'B']) { const h = clone(); h.selections[k].group = G; gs[G] = mse(vid2, await renderCrop(h, f2, 60, 1200, 960, 120)); }
    const gBest = gs.A < gs.B ? 'A' : 'B';
    if (gBest !== draw.selections[k].group) groupMatch = false;
    worstMargin = Math.min(worstMargin, Math.max(gs.A, gs.B) / Math.min(gs.A, gs.B));
  }
  ok('MP4 pixels: drawn name on screen = committed pair, 12/12 (tested against all 12 names)', nameMatch);
  ok('MP4 pixels: A/B result on screen = committed group, 12/12', groupMatch);
  // final boards: each of the 12 rows, matched against all 12 names
  const ff = Math.round((T.s4 + 7) * FPS); let finalMatch = true;
  const rowRect = (G, i) => [G === 'A' ? 40 : 554, 480 + 196 + 6 + i * 156 + 10, 486, 136];
  const vrows = {}; for (const G of ['A', 'B']) for (let i = 0; i < 6; i++) vrows[G + i] = videoCrop(video, ff, ...rowRect(G, i));
  const sc = {}; Object.keys(vrows).forEach((k) => (sc[k] = []));
  for (let sh = 0; sh < 12; sh++) {
    const h = clone(); h.selections.forEach((s, i) => (s.pair = draw.selections[(i + sh) % 12].pair));
    const Th = buildTimeline(h);
    for (const G of ['A', 'B']) for (let i = 0; i < 6; i++) sc[G + i].push({ name: Th.groups[G][i], d: mse(vrows[G + i], await renderCrop(h, ff, ...rowRect(G, i))) });
  }
  for (const G of ['A', 'B']) for (let i = 0; i < 6; i++) {
    const a = sc[G + i].sort((x, y) => x.d - y.d);
    if (a[0].name !== draw.groups[G][i]) finalMatch = false;
    worstMargin = Math.min(worstMargin, a[1].d / a[0].d); worstBest = Math.max(worstBest, a[0].d);
  }
  ok('MP4 pixels: final GROUP A / GROUP B boards = draw.json, 12/12 rows (tested against all 12 names)', finalMatch, `closest wrong candidate is >= ${worstMargin.toFixed(1)}x further than the committed one`);
  if (silent) {
    const md5 = (f) => execFileSync('ffmpeg', ['-loglevel', 'error', '-i', f, '-map', '0:v', '-c', 'copy', '-f', 'md5', '-']).toString().trim();
    const streams = (f) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'json', f])).streams.map((s) => s.codec_type).join(',');
    const a = md5(video), b = md5(silent);
    ok('silent export has the bit-identical video stream and no audio track', a === b && streams(silent) === 'video' && streams(video).includes('audio'), a);
  }
  await browser.close(); srv.close();
  console.log(results.every(Boolean) ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
