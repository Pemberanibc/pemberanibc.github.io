// Visual walk-through: node draw/tests/shots.cjs <outDir>   (site served at http://127.0.0.1:8791)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8791/draw/';
(async () => {
  const out = process.argv[2], b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  await page.goto(BASE); await page.waitForTimeout(1200); await shot(page, 'a1-idle');
  await page.click('#btnPrimary'); await page.waitForTimeout(900); await shot(page, 'a2-ready');
  await page.click('#btnPrimary'); await page.waitForTimeout(3000); await shot(page, 'a3-spin');
  await page.waitForTimeout(4700); await shot(page, 'a4-landed');
  await page.waitForTimeout(2300); await shot(page, 'a5-picked');
  await page.click('#btnPrimary'); await page.waitForTimeout(2000); await shot(page, 'a6-alloc');
  await page.waitForTimeout(4200); await shot(page, 'a7-allocated');
  const c = await ctx.newPage(); c.on('pageerror', (e) => errs.push('CTRL ' + e.message));
  await c.setViewportSize({ width: 1440, height: 900 }); await c.goto(BASE + 'control.html'); await c.waitForTimeout(800); await c.screenshot({ path: `${out}/c1-control.png`, fullPage: true });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
