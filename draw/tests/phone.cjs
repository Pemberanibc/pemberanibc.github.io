// Phone walk-through screenshots: node draw/tests/phone.cjs <outDir>
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8791/draw/';
(async () => {
  const out = process.argv[2], b = await chromium.launch(), ctx = await b.newContext(devices['iPhone 13']), p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ph = (x) => p.waitForFunction((x) => window.__draw.store.view().phase === x, x, { timeout: 15000 });
  await p.goto(BASE); await p.waitForFunction(() => window.__draw); await p.waitForTimeout(500); await p.screenshot({ path: out + '/m1.png' });
  await p.tap('#btnPrimary'); await p.waitForTimeout(700); await p.tap('#btnPrimary'); await ph('picked'); await p.waitForTimeout(2300); await p.screenshot({ path: out + '/m2.png' });
  await p.tap('#btnPrimary'); await ph('allocated'); await p.waitForTimeout(900); await p.screenshot({ path: out + '/m3.png' }); await p.waitForTimeout(1600); await p.screenshot({ path: out + '/m4.png' });
  await p.tap('#btnPrimary'); await p.waitForTimeout(900); await p.screenshot({ path: out + '/m5.png' });
  await p.evaluate(() => { window.__draw.store.dispatch('reset'); });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
