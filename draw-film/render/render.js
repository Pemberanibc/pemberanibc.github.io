// Frame-accurate renderer: headless Chromium draws each frame of film/ deterministically,
// frames are piped as PNG into FFmpeg (H.264). The draw file is only READ here — never generated.
//   node render.js stills <drawDir> <outDir> <t1,t2,...|sel:K>     PNG stills at given seconds
//   node render.js video  <drawDir> <out.mp4> [audio.wav]          full film (video-only if no wav)
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const { chromium } = require('playwright');
const FILM_DIR = path.join(__dirname, '..', 'film');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(FILM_DIR, path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[\/\\])+/, ''));
      fs.readFile(f.endsWith(path.sep) || f === FILM_DIR ? path.join(FILM_DIR, 'index.html') : f, (e, d) => {
        if (e) { rsp.writeHead(404); rsp.end(); return; }
        rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); rsp.end(d);
      });
    }).listen(0, '127.0.0.1', () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/index.html` }));
  });
}
function loadDraw(dir) {
  const draw = JSON.parse(fs.readFileSync(path.join(dir, 'draw.json'), 'utf8'));
  const commit = JSON.parse(fs.readFileSync(path.join(dir, 'commitment.json'), 'utf8'));
  return { draw, meta: { sha256: commit.sha256 } };
}
async function openPage(browser, url, draw, meta) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  await page.goto(url);
  const info = await page.evaluate(([d, m]) => window.FILM.init(d, m), [draw, meta]);
  return { page, info };
}
const framePng = (page, i) => page.evaluate((i) => { window.FILM.renderFrame(i); return window.FILM.canvas.toDataURL('image/png').slice(22); }, i).then((b) => Buffer.from(b, 'base64'));

async function main() {
  const [mode, drawDir, out, extra] = process.argv.slice(2);
  const { draw, meta } = loadDraw(drawDir);
  const { srv, url } = await serve();
  if (mode === 'stills') {
    const browser = await chromium.launch();
    const { page, info } = await openPage(browser, url, draw, meta);
    fs.mkdirSync(out, { recursive: true });
    const T = require('../film/timeline.js')(draw);
    let times = [];
    for (const tok of extra.split(',')) {
      if (tok.startsWith('s4+')) times.push(T.s4 + parseFloat(tok.slice(3)));
      else if (tok.startsWith('s5+')) times.push(T.s5 + parseFloat(tok.slice(3)));
      else if (tok.startsWith('sel')) { const [k, o] = tok.slice(3).split('+'); times.push(T.selections[+k].t0 + parseFloat(o)); }
      else times.push(parseFloat(tok));
    }
    let n = 0;
    for (const t of times) { const t0 = Date.now(); fs.writeFileSync(path.join(out, `still_${String(n++).padStart(2, '0')}.png`), await framePng(page, Math.round(t * info.fps))); console.log(`still ${n - 1} ${Date.now() - t0}ms`); }
    console.log('frames', info.frames, 'duration', info.duration.toFixed(2));
    await browser.close(); srv.close(); return;
  }
  // ---- video ----
  const WORKERS = 4, tmp = path.resolve(out) + '.parts'; fs.mkdirSync(tmp, { recursive: true });
  const b0 = await chromium.launch(); const probe = await openPage(b0, url, draw, meta); const total = process.env.MAXFRAMES ? +process.env.MAXFRAMES : probe.info.frames, fps = probe.info.fps; await b0.close();
  const gop = 150, per = Math.ceil(total / WORKERS); let done = 0;
  const started = Date.now();
  const parts = await Promise.all([...Array(WORKERS)].map(async (_, w) => {
    const a = w * per, b = Math.min(total, a + per); if (a >= b) return null;
    const part = path.join(tmp, `part${w}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-maxrate', '24M', '-bufsize', '48M',
      '-profile:v', 'high', '-level', '4.2', '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0', '-bf', '2', '-flags', '+cgop',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-r', String(fps), part], { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())));
    const browser = await chromium.launch(); const { page } = await openPage(browser, url, draw, meta);
    for (let i = a; i < b; i++) {
      const png = await framePng(page, i);
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (++done % 150 === 0) console.log(`rendered ${done}/${total} frames  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end(); await closed; await browser.close(); return part;
  }));
  srv.close();
  const list = path.join(tmp, 'list.txt'); fs.writeFileSync(list, parts.filter(Boolean).map((p) => `file '${p}'`).join('\n'));
  const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (extra) args.push('-i', extra, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest');
  args.push('-c:v', 'copy', '-movflags', '+faststart', out);
  await new Promise((res, rej) => spawn('ffmpeg', args, { stdio: 'inherit' }).on('close', (c) => (c ? rej(new Error('mux ' + c)) : res())));
  fs.rmSync(tmp, { recursive: true });
  console.log(`done: ${total} frames @ ${fps}fps -> ${path.basename(out)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
