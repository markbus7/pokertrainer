/**
 * End-to-end smoke test. Drives the real UI in a real browser: every screen
 * renders, a drill grades an answer, a hand plays to showdown, and progress
 * survives a reload.
 *
 * Needs Playwright and a running server:
 *   npm start &  &&  npm run test:e2e
 */
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('Playwright is not installed — skipping the end-to-end test.');
  console.log('Install it with:  npm i -D playwright && npx playwright install chromium');
  process.exit(0);
}

const SHOT = process.env.SHOT_DIR || null;
const BASE = process.env.BASE_URL || 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

const step = async (name, fn) => {
  try { await fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.log(`  ✗ ${name}: ${e.message}`); errors.push(`${name}: ${e.message}`); }
};

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

await step('dashboard renders', async () => {
  await page.waitForSelector('.module-tile', { timeout: 5000 });
  const rank = await page.textContent('.rank-chip .name');
  const tiles = await page.$$eval('.module-tile', (n) => n.length);
  if (tiles !== 12) throw new Error(`expected 12 module tiles, got ${tiles}`);
  console.log(`      rank="${rank}", ${tiles} modules`);
});
if (SHOT) await page.screenshot({ path: `${SHOT}/01-home.png` });

await step('lesson opens', async () => {
  await page.click('.module-tile');
  await page.waitForSelector('.lesson-points li', { timeout: 5000 });
  const points = await page.$$eval('.lesson-points li', (n) => n.length);
  if (points < 3) throw new Error(`expected lesson points, got ${points}`);
});
if (SHOT) await page.screenshot({ path: `${SHOT}/02-lesson.png` });

await step('drill answers and explains', async () => {
  await page.click('button.btn.primary.lg');
  await page.waitForSelector('.option', { timeout: 5000 });
  const q = await page.textContent('.question');
  await page.click('.option');
  await page.waitForSelector('.feedback', { timeout: 5000 });
  const fb = await page.textContent('.feedback');
  console.log(`      Q: ${q.slice(0, 60)}…`);
  console.log(`      feedback: ${fb.slice(0, 70).replace(/\n/g, ' ')}…`);
  if (!/Correct|Not quite/.test(fb)) throw new Error('no verdict shown');
});
if (SHOT) await page.screenshot({ path: `${SHOT}/03-drill.png` });

await step('next question advances', async () => {
  await page.click('button.btn.primary');
  await page.waitForSelector('.option:not([disabled])', { timeout: 5000 });
});

await step('table deals and plays', async () => {
  await page.goto(`${BASE}/#play`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.felt', { timeout: 5000 });
  await page.click('button.btn.primary.lg');           // Deal me in
  await page.waitForSelector('.action-buttons button', { timeout: 12000 });
  const seats = await page.$$eval('.seat', (n) => n.length);
  const cards = await page.$$eval('.seat.hero .card', (n) => n.length);
  const coach = await page.textContent('.coach');
  console.log(`      ${seats} seats, hero holds ${cards} cards`);
  if (seats !== 6) throw new Error(`expected 6 seats, got ${seats}`);
  if (cards !== 2) throw new Error(`expected 2 hole cards, got ${cards}`);
  if (!/equity/i.test(coach)) throw new Error('coach panel not showing equity');
});
if (SHOT) await page.screenshot({ path: `${SHOT}/04-table.png` });

await step('hero action is graded', async () => {
  const buttons = await page.$$eval('.action-buttons button', (n) => n.map((b) => b.textContent));
  console.log(`      actions: ${buttons.join(' | ')}`);
  // Prefer calling so the hand continues.
  const call = await page.$('.action-buttons .btn.success');
  if (call) await call.click();
  else await page.click('.action-buttons .btn');
  await page.waitForSelector('.verdict-box', { timeout: 8000 });
  const verdict = await page.textContent('.verdict-box');
  console.log(`      verdict: ${verdict.slice(0, 90).replace(/\n/g, ' ')}…`);
});
if (SHOT) await page.screenshot({ path: `${SHOT}/05-coach.png` });

await step('hand plays to completion', async () => {
  // Keep acting until the hand resolves, the way a player would.
  for (let i = 0; i < 40; i++) {
    const bar = await page.textContent('.action-bar');
    if (/Deal next hand/.test(bar)) break;
    const btn = (await page.$('.action-buttons .btn.success'))
      || (await page.$('.action-buttons .btn:not(.danger):not(.primary)'))
      || (await page.$('.action-buttons .btn.danger'));
    if (btn) await btn.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  const bar = await page.textContent('.action-bar');
  if (!/Deal next hand/.test(bar)) throw new Error('hand never resolved');
  const street = await page.textContent('.street-tag');
  const log = await page.textContent('.log');
  console.log(`      reached: ${street}`);
  console.log(`      log tail: ${log.split('\n').filter(Boolean).slice(0, 2).join(' / ').slice(0, 90)}`);
});

await step('a second hand deals cleanly', async () => {
  await page.click('.action-bar .btn.primary');
  await page.waitForSelector('.action-buttons button', { timeout: 12000 });
  const cards = await page.$$eval('.seat.hero .card', (n) => n.length);
  if (cards !== 2) throw new Error(`expected 2 fresh hole cards, got ${cards}`);
});
if (SHOT) await page.screenshot({ path: `${SHOT}/06-showdown.png` });

await step('range charts render', async () => {
  await page.goto(`${BASE}/#charts?chart=BTN`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.range-cell', { timeout: 5000 });
  const cells = await page.$$eval('.range-cell', (n) => n.length);
  const inRange = await page.$$eval('.range-cell.in', (n) => n.length);
  if (cells !== 169) throw new Error(`expected 169 cells, got ${cells}`);
  console.log(`      ${cells} cells, ${inRange} in the button opening range`);
});
if (SHOT) await page.screenshot({ path: `${SHOT}/07-charts.png` });

await step('gauntlet, bankroll and progress screens render', async () => {
  for (const [route, sel] of [['gauntlet', '.btn.primary.lg'], ['grind', '.panel'], ['stats', '.achievement']]) {
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(sel, { timeout: 5000 });
  }
});
if (SHOT) await page.screenshot({ path: `${SHOT}/08-grind.png` });

await step('progress persists across a reload', async () => {
  await page.goto(`${BASE}/#home`, { waitUntil: 'networkidle' });
  const xp = await page.textContent('.rank-chip .xp');
  await page.reload({ waitUntil: 'networkidle' });
  const xpAfter = await page.textContent('.rank-chip .xp');
  if (xp !== xpAfter) throw new Error(`XP changed across reload: ${xp} -> ${xpAfter}`);
  console.log(`      persisted: ${xpAfter}`);
});

console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors.slice(0, 12)) console.log(`  ! ${e}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
