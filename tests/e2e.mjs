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
// The bundled browser build and the one this machine has installed do not
// always match — CI images pin their own. Fall back to it by path rather than
// failing the whole suite over a version number.
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let browser;
try {
  browser = await chromium.launch();
} catch (err) {
  const { existsSync } = await import('node:fs');
  if (!existsSync(CHROME)) throw err;
  console.log(`  · using the browser at ${CHROME}`);
  browser = await chromium.launch({ executablePath: CHROME });
}
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  // The update check calls out to raw.githubusercontent.com on load. The
  // failure is handled in code, but the browser still logs the dropped
  // request, and a sandbox without egress will always produce one.
  if (/raw\.githubusercontent|ERR_CONNECTION|Failed to load resource/.test(m.text())) return;
  errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

// ONLY=duel runs the steps whose names match, for working on one of them.
const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
const step = async (name, fn) => {
  if (only && !only.test(name)) return;
  try { await fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.log(`  ✗ ${name}: ${e.message}`); errors.push(`${name}: ${e.message}`); }
};

// Most of these steps were written for a course that was open by rank and a
// coach who graded every decision out loud. Both are now things a player
// earns or switches on, so the steps that test the teaching itself run as a
// veteran: every chapter and chart owned, and Silas at the table. The steps
// that test the economy and free play switch this off for themselves and put
// it back afterwards.
const VETERAN_OWNS = [
  'hand-rankings', 'pot-odds', 'outs', 'preflop', 'position', 'cbet', 'mdf', 'bluffing', 'spr', 'exploit', 'icm', 'bankroll',
].map((id) => `lesson:${id}`).concat(
  ['open:UTG', 'open:HJ', 'open:CO', 'open:BTN', 'open:SB', 'defend:BB', 'threebet'].map((key) => `chart:${key}`),
);
await page.addInitScript((owned) => {
  try {
    if (localStorage.getItem('e2e.veteran') !== '1') return;
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    const economy = raw.economy || {};
    raw.economy = { version: 1, pearls: economy.pearls || 0, earned: economy.earned || 0, spent: economy.spent || 0, owned };
    raw.settings = { ...(raw.settings || {}) };
    if (raw.settings.liveCoach === undefined) raw.settings.liveCoach = true;
    localStorage.setItem(key, JSON.stringify(raw));
  } catch { /* a test that breaks storage on purpose breaks this too */ }
}, VETERAN_OWNS);
// Auto-deal is on by default, which is right for a player and a race for a test
// that clicks "Deal next hand" a moment after the hand ends. So every step runs
// with it off, except the one that tests it and asks for the way it ships.
await page.addInitScript(() => {
  try {
    if (localStorage.getItem('e2e.autodeal') === '1') return;
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.settings = { ...(raw.settings || {}), autoDeal: false };
    localStorage.setItem(key, JSON.stringify(raw));
  } catch { /* a test that breaks storage on purpose breaks this too */ }
});
const veteran = async (on) => {
  await page.evaluate((flag) => localStorage.setItem('e2e.veteran', flag ? '1' : '0'), on);
};

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
// The first visit writes a save of its own (the contracts it posted, and the
// defaults beside them). The veteran is made from nothing, not from that.
await page.evaluate(() => localStorage.removeItem('poker-trainer.profile.v1'));
await veteran(true);
await page.reload({ waitUntil: 'networkidle' });

await step('dashboard renders', async () => {
  // The app opens on the career now, so the training dashboard is somewhere
  // you go rather than where you land.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
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
  // Navigate by route, not by "the big primary button" — that button was
  // "Start drilling" when this test was written and is now "Teach me this",
  // so the test was quietly exercising the guided lesson instead.
  await page.goto(`${BASE}/#drill?module=hand-rankings`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.option', { timeout: 5000 });
  const q = await page.textContent('.question');
  await page.click('.option');
  await page.waitForSelector('.feedback', { timeout: 5000 });
  const fb = await page.textContent('.feedback');
  console.log(`      Q: ${q.slice(0, 60)}…`);
  console.log(`      feedback: ${fb.slice(0, 70).replace(/\n/g, ' ')}…`);
  if (!/✓ Correct|✗ Not quite/.test(fb)) throw new Error(`no verdict shown: "${fb.slice(0, 60)}"`);
});
if (SHOT) await page.screenshot({ path: `${SHOT}/03-drill.png` });

await step('next question advances', async () => {
  await page.click('button:has-text("Next question")');
  await page.waitForSelector('.option:not([disabled])', { timeout: 5000 });
});

await step('the guided lesson grades its checks too', async () => {
  await page.goto(`${BASE}/#walkthrough?module=hand-rankings`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.option', { timeout: 5000 });
  await page.click('.option');
  await page.waitForSelector('.feedback', { timeout: 5000 });
  const fb = await page.textContent('.feedback');
  if (!/That is right|Not quite/.test(fb)) throw new Error(`lesson check gave no verdict: "${fb.slice(0, 60)}"`);
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
  // The coach names the skill and repeats the felt. It must not do the sum
  // for you before you have decided — "your equity 41%" in green next to
  // "needed 30%" is the answer written out.
  if (/equity/i.test(coach)) {
    throw new Error(`the coach gave the answer away before the decision: "${coach.replace(/\n/g, ' · ').slice(0, 160)}"`);
  }
  const stuck = await page.$('button:has-text("show me the numbers")');
  if (!stuck) throw new Error('there is no way to ask the coach for help');
  await stuck.click();
  await page.waitForTimeout(200);
  const helped = await page.textContent('.coach');
  if (!/equity/i.test(helped)) throw new Error('asking for the numbers did not produce them');
  if (!/not count as solved/i.test(helped)) throw new Error('asking for help has to be marked as help');
});
if (SHOT) await page.screenshot({ path: `${SHOT}/04-table.png` });

await step('every raise control agrees on one amount', async () => {
  // The bug this pins: the sizing buttons moved a slider while the button you
  // press kept its old label, so the bar offered "Raise to 137" and raised to
  // 4. A control that lies about what it will do is worse than no control.
  const sizing = await page.$('.sizing');
  if (!sizing) throw new Error('the action bar has no raise controls');

  const state = () => page.evaluate(() => ({
    field: Number(document.querySelector('.raise-input').value),
    slider: Number(document.querySelector('.raise-slider').value),
    button: Number((document.querySelector('.action-buttons .btn.primary').textContent.match(/\d+/) || [0])[0]),
    active: [...document.querySelectorAll('.size-btn.is-active .size-name')].map((n) => n.textContent),
    offers: [...document.querySelectorAll('.size-btn')].map((b) => ({
      name: b.querySelector('.size-name').textContent,
      chips: Number(b.querySelector('.size-chips').textContent),
    })),
  }));

  const agree = (s, where) => {
    if (s.field !== s.slider || s.field !== s.button) {
      throw new Error(`${where}: field ${s.field}, slider ${s.slider}, button says ${s.button}`);
    }
  };

  const opened = await state();
  agree(opened, 'on open');
  if (opened.offers.length !== 5) throw new Error(`expected 5 sizing buttons, got ${opened.offers.length}`);
  console.log(`      offers: ${opened.offers.map((o) => `${o.name} ${o.chips}`).join(' | ')}`);

  // Every preset moves all three readouts to the amount printed on it.
  const seen = [];
  for (const offer of opened.offers) {
    await page.click(`.size-btn:has(.size-name:text-is("${offer.name}"))`);
    const s = await state();
    agree(s, `after ${offer.name}`);
    if (s.button !== offer.chips) throw new Error(`${offer.name} shows ${offer.chips} but sets ${s.button}`);
    if (!s.active.includes(offer.name)) throw new Error(`${offer.name} did not mark itself as chosen`);
    seen.push(s.button);
  }
  // In a pot with room, the presets must be four different prices, not one.
  const distinct = new Set(seen.slice(0, 4)).size;
  console.log(`      presets set ${seen.join(', ')} (${distinct} distinct)`);
  if (distinct < 2) throw new Error(`four pot fractions all set the same amount: ${seen.join(', ')}`);

  // The step buttons move by one chip and carry every readout with them.
  const before = (await state()).button;
  await page.click('.size-tune .step-btn:first-child');
  const stepped = await state();
  agree(stepped, 'after −1');
  if (stepped.button !== before - 1) throw new Error(`−1 moved ${before} to ${stepped.button}`);

  // And the amount is typable, for when aiming a slider is the hard part.
  await page.fill('.raise-input', '');
  await page.type('.raise-input', String(before));
  const typed = await state();
  agree(typed, 'after typing');
  if (typed.button !== before) throw new Error(`typed ${before}, bar says ${typed.button}`);
});

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
  // Keep acting until the hand resolves, the way a player would. Bounded by a
  // deadline rather than an iteration count: each bot turn takes ~600ms, and a
  // four-street hand against five opponents can legitimately run past twenty
  // seconds, which a fixed loop count was cutting off mid-hand.
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const bar = await page.textContent('.action-bar');
    if (/Deal next hand/.test(bar)) break;
    // Calling every street can bust the hero, and the rebuy panel's buttons
    // live outside .action-buttons — so without this the loop sits waiting for
    // an action control that is no longer on screen.
    if (/out of chips/i.test(bar)) {
      const topUp = await page.$('.action-bar .btn.primary');
      if (topUp) { await topUp.click().catch(() => {}); await page.waitForTimeout(250); continue; }
    }
    // River spots against one opponent ask for a read before they hand back
    // the buttons. Answering is part of playing now, so the loop answers.
    const band = await page.$('.read-bands .btn');
    if (band) { await band.click().catch(() => {}); await page.waitForTimeout(200); continue; }

    const btn = (await page.$('.action-buttons .btn.success'))
      || (await page.$('.action-buttons .btn:not(.danger):not(.primary)'))
      || (await page.$('.action-buttons .btn.danger'));
    if (btn) await btn.click().catch(() => {});
    await page.waitForTimeout(250);
  }
  const bar = await page.textContent('.action-bar');
  if (!/Deal next hand/.test(bar)) {
    throw new Error(`hand never resolved — action bar reads: "${bar.replace(/\s+/g, ' ').trim().slice(0, 120)}"`);
  }
  const street = await page.textContent('.street-tag');
  const log = await page.textContent('.log');
  console.log(`      reached: ${street}`);
  console.log(`      log tail: ${log.split('\n').filter(Boolean).slice(0, 2).join(' / ').slice(0, 90)}`);
});

await step('a second hand deals cleanly', async () => {
  await page.click('.action-bar .btn.primary');
  // Wait for the cards, not for the action buttons. A hand where everyone
  // folds to the blinds, or where the hero is already all-in, never offers a
  // decision — the deal is still clean, and this step is about the deal.
  await page.waitForFunction(
    () => document.querySelectorAll('.seat.hero .card').length === 2,
    null, { timeout: 12000 },
  );
});
if (SHOT) await page.screenshot({ path: `${SHOT}/06-showdown.png` });

await step('playing a hand teaches a named skill and counts toward it', async () => {
  // The point of the whole thing: a decision at a table is graded against
  // the skill it exercises and recorded the same way a drill answer is.
  // Before this, playing fed nothing at all — the ladder could only be
  // climbed by answering multiple-choice questions.
  // Via the dashboard: a goto to the hash we are already on is a fragment
  // navigation, so the previous step's half-played hand would still be there
  // and there would be no Deal button to click.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.felt', { timeout: 5000 });
  await page.click('button.btn.primary.lg');
  await page.waitForSelector('.action-buttons button', { timeout: 20000 });

  const named = await page.textContent('.spot-tag');
  if (!named || !named.trim()) throw new Error('the coach did not name the skill before you acted');
  console.log(`      before acting: ${named.replace(/\s+/g, ' ').trim().slice(0, 80)}`);

  const before = await page.evaluate(async () => {
    const { Profile } = await import('/src/js/state/profile.js');
    const p = Profile.load();
    return { xp: p.xp, drills: JSON.stringify(p.data.drills) };
  });

  const act = (await page.$('.action-buttons .btn.success')) || (await page.$('.action-buttons .btn'));
  await act.click();
  await page.waitForSelector('.verdict-box', { timeout: 8000 });
  const verdict = await page.textContent('.verdict-box');
  const learned = await page.textContent('.learned-row');
  console.log(`      graded: ${verdict.replace(/\s+/g, ' ').trim().slice(0, 80)}`);
  console.log(`      recorded against: ${learned.replace(/\s+/g, ' ').trim()}`);

  const after = await page.evaluate(async () => {
    const { Profile } = await import('/src/js/state/profile.js');
    const p = Profile.load();
    return { xp: p.xp, drills: JSON.stringify(p.data.drills) };
  });
  if (after.drills === before.drills) throw new Error('the decision was not recorded against any skill');
  if (after.xp <= before.xp) throw new Error('playing a decision earned nothing');
});

await step('a session reports the decisions you made, not only the chips you won', async () => {
  // The session panel led with Result and Win rate — both outcome, and a
  // session is far too short for either to mean anything. Every decision at
  // the table is already graded; nothing added them up.
  await page.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.felt', { timeout: 8000 });
  const deal = await page.$('button.btn.primary.lg');
  if (deal) await deal.click();

  // Play a handful of hands, always taking the cheapest legal action, so
  // the session accumulates graded decisions without needing to win.
  let acted = 0;
  for (let i = 0; i < 60 && acted < 6; i++) {
    await page.waitForTimeout(320);
    const check = await page.$('.action-buttons .btn:not(.danger):not(.success):not(.primary)');
    const fold = await page.$('.action-buttons .btn.danger');
    if (check) { await check.click(); acted++; continue; }
    if (fold) { await fold.click(); acted++; continue; }
    const next = await page.$('button:has-text("Deal next hand")');
    if (next) await next.click();
  }

  await page.waitForTimeout(500);
  const panel = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
  if (!/Decisions right/i.test(panel)) {
    throw new Error('the session never reports how many decisions were right');
  }
  const shown = /Decisions right\s*(\d+)\/(\d+)/.exec(panel);
  if (!shown) throw new Error('the decision count is not a count');
  if (Number(shown[2]) < 1) throw new Error('no decisions were counted despite playing');
  console.log(`      session reports ${shown[1]}/${shown[2]} decisions right after ${acted} actions`);
});

await step('a misplayed hand is recorded and replays', async () => {
  // Played inside the page against the real engine, through the same recorder
  // the table screen uses. Driving the UI to a bad decision would depend on
  // which cards came out; this makes the mistake on purpose and still
  // exercises the whole path from recorder to store to screen.
  const saved = await page.evaluate(async () => {
    const [{ createTable }, { botAction }, { makeRng }, hh, { equityVsField }, { requiredEquity }] =
      await Promise.all([
        import('/src/js/engine/table.js'),
        import('/src/js/engine/bots.js'),
        import('/src/js/core/rng.js'),
        import('/src/js/state/handHistory.js'),
        import('/src/js/core/equity.js'),
        import('/src/js/core/odds.js'),
      ]);
    hh.clearHands();
    const rng = makeRng(20260903);
    const table = createTable({
      smallBlind: 1, bigBlind: 2, rng,
      players: [
        { id: 'hero', name: 'You', stack: 200, isHero: true },
        ...[0, 1, 2, 3, 4].map((i) => ({ id: `bot${i}`, name: `Bot ${i}`, stack: 200, profile: 'station' })),
      ],
    });
    for (let h = 0; h < 25 && hh.loadHands().length === 0; h++) {
      for (const p of table.players) if (p.stack < 20) p.stack = 200;
      table.startHand();
      const rec = new hh.HandRecorder(table, 'hero', { source: 'play' });
      let guard = 0;
      while (!table.handOver && guard++ < 200) {
        const actor = table.actor;
        if (!actor) break;
        if (actor.isHero) {
          const live = table.contestants.filter((p) => !p.isHero).length;
          const toCall = Math.max(0, table.currentBet - actor.committed);
          const pot = table.totalPot;
          const equity = equityVsField(actor.hole, table.board, Math.max(1, live), table.variant, rng, 200);
          const coach = { equity, needed: toCall > 0 ? requiredEquity(toCall, pot) : 0, opponents: live, spr: 5 };
          // Call everything: eventually that is a call without the odds.
          const legal = table.legalActions(actor);
          const pick = legal.find((a) => a.type === 'call') || legal.find((a) => a.type === 'check');
          rec.act(table, { type: pick.type }, coach);
        } else {
          rec.act(table, botAction(table, actor, rng));
        }
      }
      hh.keepHand(rec.finish(table));
    }
    const hands = hh.loadHands();
    return { count: hands.length, id: hands.length ? hands[hands.length - 1].id : null };
  });
  if (!saved.count) throw new Error('25 hands of calling everything recorded no mistake');
  console.log(`      recorded ${saved.count} hand(s) worth reviewing`);

  await page.goto(`${BASE}/#review`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hand-card', { timeout: 5000 });
  const cards = await page.$$eval('.hand-card', (n) => n.length);
  if (cards !== saved.count) throw new Error(`review list shows ${cards} of ${saved.count} hands`);

  await page.click('.hand-card');
  await page.waitForSelector('.replay-dot', { timeout: 5000 });
  const dots = await page.$$eval('.replay-dot', (n) => n.length);
  const onMistake = await page.$$eval('.replay-dot.bad.here', (n) => n.length);
  if (dots < 3) throw new Error(`expected a timeline, got ${dots} dots`);
  if (!onMistake) throw new Error('the replay did not open on the mistake');
  const verdict = await page.textContent('.verdict-panel');
  console.log(`      ${dots} steps; opened on: ${verdict.replace(/\s+/g, ' ').trim().slice(0, 80)}…`);
  if (!/Instead/.test(verdict)) throw new Error('no better line offered for a bad decision');

  // The felt in the replay is the felt from the game.
  const seats = await page.$$eval('.replay-panel .seat', (n) => n.length);
  if (seats !== 6) throw new Error(`replay felt shows ${seats} seats, expected 6`);

  // Walk the whole hand.
  const total = dots;
  for (let i = 0; i < total; i++) {
    const next = await page.$('.replay-transport .btn:not([disabled]):last-child');
    if (!next) break;
    await next.click().catch(() => {});
  }
  const end = await page.textContent('.screen');
  if (!/won the pot/i.test(end)) throw new Error('stepping to the end never reached the result');
});
if (SHOT) await page.screenshot({ path: `${SHOT}/07-replay.png` });

await step('range charts render', async () => {
  await page.goto(`${BASE}/#charts?chart=BTN`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.range-cell', { timeout: 5000 });
  const cells = await page.$$eval('.range-cell', (n) => n.length);
  const inRange = await page.$$eval('.range-cell.in', (n) => n.length);
  if (cells !== 169) throw new Error(`expected 169 cells, got ${cells}`);
  console.log(`      ${cells} cells, ${inRange} in the button opening range`);
});
if (SHOT) await page.screenshot({ path: `${SHOT}/07-charts.png` });

await step('gauntlet and progress screens render', async () => {
  for (const [route, sel] of [['gauntlet', '.btn.primary.lg'], ['stats', '.achievement']]) {
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(sel, { timeout: 5000 });
  }
});
if (SHOT) await page.screenshot({ path: `${SHOT}/08-gauntlet.png` });

await step('progress persists across a reload', async () => {
  await page.goto(`${BASE}/#train`, { waitUntil: 'networkidle' });
  const xp = await page.textContent('.rank-chip .xp');
  await page.reload({ waitUntil: 'networkidle' });
  const xpAfter = await page.textContent('.rank-chip .xp');
  if (xp !== xpAfter) throw new Error(`XP changed across reload: ${xp} -> ${xpAfter}`);
  console.log(`      persisted: ${xpAfter}`);
});

await step('no lesson renders raw markup in any of its steps', async () => {
  // Markup is rendered in several places — body text, captions, questions,
  // option labels and table cells — and each is a separate code path. Two of
  // them once rendered [[term]] literally, so this walks every step of every
  // lesson and checks what actually reaches the screen.
  const mods = ['pot-odds', 'hand-rankings', 'outs', 'preflop', 'position', 'bankroll',
    'cbet', 'mdf', 'bluffing', 'spr', 'exploit', 'icm'];
  const faults = [];
  for (const m of mods) {
    await page.goto(`${BASE}/#walkthrough?module=${m}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lesson-body', { timeout: 5000 });
    for (let i = 0; i < 8; i++) {
      const txt = await page.evaluate(() => {
        const panel = document.querySelectorAll('.screen > .panel')[1];
        return panel ? panel.textContent : '';
      });
      if (/\[\[|\]\]/.test(txt)) faults.push(`${m} step ${i + 1}: literal [[ ]]`);
      if (/(^|[^*])\*([^*]|$)/.test(txt.replace(/\*\*/g, ''))) faults.push(`${m} step ${i + 1}: stray asterisk`);
      const option = await page.$('.option:not([disabled])');
      if (!option) break;
      await option.click();
      await page.waitForTimeout(50);
      const nextBtn = await page.$('button:has-text("Next step")');
      if (!nextBtn) break;
      await nextBtn.click();
      await page.waitForTimeout(80);
    }
  }
  if (faults.length) throw new Error(faults.join('; '));
});

await step('lessons deal real cards and grade what you do with them', async () => {
  // The outs exercise is the one that cannot be faked: you point at the cards
  // rather than pick a number from four options.
  await page.goto(`${BASE}/#walkthrough?module=outs`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Walk forward until the out-grid appears — the lesson gained naming and
  // odds steps ahead of it, and it may gain more.
  for (let i = 0; i < 8 && !(await page.$('.out-cell')); i++) {
    const opts = await page.$$('.option:not([disabled]), .practice-option:not([disabled])');
    if (opts.length) { await opts[0].click(); await page.waitForTimeout(250); }
    const entry = await page.$('.practice-entry input');
    if (entry) {
      await entry.fill('25');
      const send = await page.$('.practice-entry button');
      if (send) { await send.click(); await page.waitForTimeout(250); }
    }
    let moved = false;
    for (const b of await page.$$('button.btn.primary')) {
      if (/next step/i.test((await b.textContent()) || '')) { await b.click(); moved = true; break; }
    }
    if (!moved) break;
    await page.waitForTimeout(400);
  }

  const cells = await page.$$('.out-cell');
  if (cells.length !== 45) throw new Error(`expected 45 unseen cards, got ${cells.length}`);

  // The footer must refuse to advance until the exercise is done.
  const beforeButtons = await page.$$eval('button', (n) => n.map((b) => b.textContent.trim()));
  if (beforeButtons.some((txt) => /next step/i.test(txt))) {
    throw new Error('a practice step let you continue without doing it');
  }

  await cells[0].click();
  await cells[1].click();
  const checkBtn = await page.$('.practice button.btn.primary');
  if (!checkBtn) throw new Error('no way to submit the exercise');
  await checkBtn.click();
  await page.waitForTimeout(400);

  // Grading must mark the grid itself, not just print a sentence.
  const marked = await page.evaluate(() => document.querySelectorAll(
    '.out-cell.hit, .out-cell.missed, .out-cell.wrong').length);
  if (marked === 0) throw new Error('grading did not mark any cards on the grid');
  if (!(await page.$('.practice .feedback'))) throw new Error('no feedback shown');

  // And now it lets you move on.
  const after = await page.$$eval('button', (n) => n.map((b) => b.textContent.trim()));
  if (!after.some((txt) => /next step/i.test(txt))) {
    throw new Error('finishing the exercise did not unlock the next step');
  }
});

await step('"I don\'t know" treats an empty pick as an honest search, not a wrong guess', async () => {
  // The outs grid is the one exercise where a skip has no dedicated sentinel
  // at all — it is graded as an empty selection, which the grading already
  // treats as "found nothing" rather than "picked something wrong". This is
  // the one place that distinction is worth watching in a real browser: if
  // it ever regressed, every real out would wrongly render as a mistake
  // rather than as something simply not found.
  // goto() to a hash the browser is already sitting on is a no-op in a
  // single-page app — the earlier outs step above lands on this exact route,
  // and without a reload this one silently ran against ITS already-graded
  // exercise instead of a fresh one, which is why the first version of this
  // step saw two cells already marked wrong before ever clicking skip.
  await page.goto(`${BASE}/#walkthrough?module=outs`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  for (let i = 0; i < 8 && !(await page.$('.out-cell')); i++) {
    const opts = await page.$$('.option:not([disabled]), .practice-option:not([disabled])');
    if (opts.length) { await opts[0].click(); await page.waitForTimeout(250); }
    const entry = await page.$('.practice-entry input');
    if (entry) {
      await entry.fill('25');
      const send = await page.$('.practice-entry button');
      if (send) { await send.click(); await page.waitForTimeout(250); }
    }
    let moved = false;
    for (const b of await page.$$('button.btn.primary')) {
      if (/next step/i.test((await b.textContent()) || '')) { await b.click(); moved = true; break; }
    }
    if (!moved) break;
    await page.waitForTimeout(400);
  }
  const cells = await page.$$('.out-cell');
  if (cells.length !== 45) throw new Error(`expected 45 unseen cards, got ${cells.length}`);
  if (await page.$('.out-cell.picked')) throw new Error('the exercise did not start fresh — a cell is already picked');

  const skip = await page.$('.idk-btn');
  if (!skip) throw new Error('the outs exercise offers no way to say "I don\'t know"');
  await skip.click();
  await page.waitForTimeout(400);

  if (await page.$('.out-cell.wrong')) {
    throw new Error('an empty pick was marked as a wrong guess on the grid');
  }
  const missed = await page.$$eval('.out-cell.missed', (els) => els.length);
  if (missed === 0) throw new Error('an empty pick left nothing marked as missed — this hand has no real outs to test with');
  const verdict = await page.textContent('.practice .feedback .verdict').catch(() => '');
  if (!/didn't know/i.test(verdict)) throw new Error(`the skip verdict reads like a real guess: "${verdict}"`);
  console.log(`      ${missed} real outs shown as missed, none marked wrong, no guess pretended`);
});

await step('"I don\'t know" is offered, honest, and unaccredited on the drill and the range trainer', async () => {
  // Two more surfaces, one step: the main drill (a picked-option question)
  // and the range trainer (the reader\'s own ask, "wanneer callen ipv
  // raisen" — exactly where a genuine "I don\'t know" beats a guess).
  await page.goto(`${BASE}/#drill?module=hand-rankings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  if (!(await page.$('.idk-btn'))) throw new Error('the drill offers no "I don\'t know"');
  await page.click('.idk-btn');
  await page.waitForTimeout(300);
  if (await page.$('.option.wrong')) throw new Error('skipping the drill painted an option wrong');
  if (!(await page.$('.option.correct'))) throw new Error('skipping the drill did not reveal the right option');
  const drillClass = await page.$eval('.feedback', (e) => e.className);
  if (!/\bskip\b/.test(drillClass)) throw new Error(`the drill feedback is not toned as a skip: ${drillClass}`);

  await page.goto(`${BASE}/#ranges`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.click('.rung-row');
  await page.waitForTimeout(400);
  if (!(await page.$('.idk-btn'))) throw new Error('the range trainer offers no "I don\'t know"');
  await page.click('.idk-btn');
  await page.waitForTimeout(350);
  const boxClass = await page.$eval('.verdict-box', (e) => e.className);
  if (!/\bskip\b/.test(boxClass)) throw new Error(`the range trainer feedback is not toned as a skip: ${boxClass}`);
  if (await page.$('.ask-option.wrong')) throw new Error('skipping the range trainer painted an option wrong');
  console.log('      neither surface painted a red guess or credited a skip');
});

await step('numeric drills make you produce the number, not pick it', async () => {
  // MDF is the clean case: every question has a number for an answer, so the
  // entry box must always be there and the options must not.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#drill?module=mdf`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const input = await page.$('.drill-entry-input');
  if (!input) throw new Error('a numeric drill still offers a list to pick from');
  if (await page.$('.option')) throw new Error('the options were on screen before the answer was given');

  // Read the right answer off the question, then give a deliberately wrong one.
  const q = await page.$eval('.question', (n) => n.textContent);
  const [, pot, bet] = /pot is (\d+) and your opponent bets (\d+)/.exec(q) || [];
  if (!pot) throw new Error(`could not read the numbers out of: "${q}"`);
  await input.fill('1');
  await page.click('.drill-entry button');
  await page.waitForTimeout(300);
  const wrong = await page.$('.feedback.wrong');
  if (!wrong) throw new Error('a wrong typed answer was not marked wrong');
  if (!/you said 1%/i.test(await wrong.textContent())) {
    throw new Error('the feedback did not quote back what was typed');
  }
  // And the options appear afterwards so the right number is visible.
  if (!(await page.$('.option.correct'))) throw new Error('the right answer was never shown');

  // Now the right one, on a fresh question.
  await page.click('button.btn.primary');
  await page.waitForTimeout(400);
  const q2 = await page.$eval('.question', (n) => n.textContent);
  const m = /pot is (\d+) and your opponent bets (\d+)/.exec(q2);
  const mdf = Math.round((Number(m[1]) / (Number(m[1]) + Number(m[2]))) * 100);
  await (await page.$('.drill-entry-input')).fill(String(mdf));
  await page.click('.drill-entry button');
  await page.waitForTimeout(300);
  if (!(await page.$('.feedback.correct'))) {
    throw new Error(`typing the right answer (${mdf}%) was graded wrong`);
  }
  console.log(`      typed ${mdf}% and it graded correct`);
});

await step('Enter answers the question and shows the result, the way the button does', async () => {
  // One keypress used to do two things: the input submitted the answer, and
  // the same event bubbled to the screen handler, where Enter means "next
  // question". Submitting flips the lock inside that call, so the guard no
  // longer held by the time the event arrived and the reader was thrown onto
  // the next question without ever seeing whether they were right.
  const readState = () => page.evaluate(() => ({
    question: document.querySelector('.question')?.textContent || null,
    feedback: document.querySelector('.feedback')?.textContent.trim() || null,
    rightAnswerShown: !!document.querySelector('.option.correct'),
  }));

  const answerWith = async (how) => {
    await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${BASE}/#drill?module=mdf`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const before = await readState();
    await page.fill('.drill-entry-input', '33');
    if (how === 'enter') await page.press('.drill-entry-input', 'Enter');
    else await page.click('.drill-entry button', { timeout: 2000 });
    await page.waitForTimeout(350);
    return { before, after: await readState() };
  };

  const clicked = await answerWith('click');
  const entered = await answerWith('enter');

  for (const [how, run] of [['the button', clicked], ['Enter', entered]]) {
    if (!run.after.feedback) throw new Error(`${how} produced no feedback at all`);
    if (!run.after.rightAnswerShown) throw new Error(`${how} did not show the right answer`);
    if (run.after.question !== run.before.question) {
      throw new Error(`${how} skipped to the next question instead of showing the result`);
    }
  }

  // And a second Enter is still how you move on once you have read it. The
  // question's text alone cannot tell: MDF questions come in about fifty
  // pot-and-bet pairs, so the next one is sometimes worded exactly like the
  // last. A new question is one with the result gone and an empty answer box.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const next = await page.evaluate(() => ({
    question: document.querySelector('.question')?.textContent || null,
    feedback: !!document.querySelector('.feedback'),
    entry: document.querySelector('.drill-entry-input')?.value ?? null,
  }));
  if (!next.question || next.feedback || next.entry !== '') {
    throw new Error('a second Enter no longer advances to the next question');
  }
  console.log('      Enter and the button both grade in place; Enter again moves on');
});

await step('preflop teaches what a hand is worth, and grades the number', async () => {
  // The gap this closes: every preflop question used to be multiple choice
  // about what to DO. Not one of them asked what the hand was worth, so the
  // percentages were only ever read in an explanation after a different
  // question had been answered.
  //
  // The expected answer is worked out here from the app's own data rather
  // than read off the screen, so a drill that grades against the wrong
  // number fails instead of agreeing with itself.
  const { VS_RANGE } = await import('../src/js/data/rangeEquity.js');
  const { equityVs } = await import('../src/js/core/equity.js');
  const { expandHandKey } = await import('../src/js/core/cards.js');
  const { makeRng } = await import('../src/js/core/rng.js');
  const seats = { 'Under the Gun': 'UTG', Hijack: 'HJ', Cutoff: 'CO', Button: 'BTN' };

  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#drill?module=preflop`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // Both kinds have to be seen: which one comes up is random, and a step
  // that stops at the first two would pass without ever grading the other.
  const seen = { allIn: 0, range: 0 };
  let asked = 0;
  let sample = '';
  for (let i = 0; i < 40 && (!seen.allIn || !seen.range); i++) {
    const question = await page.$eval('.question', (n) => n.textContent).catch(() => '');
    asked++;
    let expected = null;
    let kind = null;

    const allIn = /All-in before the flop: (\S+) against (\S+)\./.exec(question);
    const vsRange = /You hold (\S+)\..*?Now (.+?) raises/.exec(question);
    if (allIn) {
      const rng = makeRng(1);
      const a = expandHandKey(allIn[1]);
      const b = expandHandKey(allIn[2]).find((h) => !h.some((c) => a[0].includes(c)));
      expected = Math.round(equityVs(a[0], [b], [], { trials: 40000, rng }) * 100);
      kind = 'allIn';
    } else if (vsRange && seats[vsRange[2]]) {
      expected = Math.round(VS_RANGE[seats[vsRange[2]]][vsRange[1]] * 100);
      kind = 'range';
    }

    if (expected != null) {
      // Percentage questions are a choice off a scale, not an empty box:
      // there is no way to derive the number until the shapes are known, and
      // typing one you cannot derive is guessing.
      if (await page.$('.drill-entry-input')) {
        throw new Error('an equity question demanded a typed answer at this level');
      }
      // Each option renders its keyboard number in a .key span, so the
      // label has to be read past it — "1" + "47%" parses as 147.
      const labels = await page.$$eval('.option', (nodes) => nodes.map(
        (n) => [...n.querySelectorAll('span')].filter((x) => !x.classList.contains('key'))
          .map((x) => x.textContent).join(' ').trim(),
      ));
      const values = labels.map((l) => parseFloat((/(\d+)\s*%/.exec(l) || [])[1]));
      if (values.some((v) => Number.isNaN(v))) throw new Error(`options are not percentages: ${labels.join(' | ')}`);
      const sorted = values.every((v, k) => k === 0 || values[k - 1] <= v);
      if (!sorted) throw new Error(`options are not in order: ${values.join(', ')}`);

      const best = values.reduce((a, b) => (Math.abs(b - expected) < Math.abs(a - expected) ? b : a));
      if (Math.abs(best - expected) > 5) {
        throw new Error(`computed ${expected}% but no option is near it: ${values.join(', ')}`);
      }
      await page.click(`.option >> nth=${values.indexOf(best)}`, { timeout: 2000 });
      await page.waitForTimeout(250);
      const feedback = await page.$eval('.feedback', (n) => n.textContent).catch(() => '');
      if (!(await page.$('.feedback.correct'))) {
        throw new Error(`independently computed ${expected}% and the drill called it wrong: ${feedback.slice(0, 140)}`);
      }
      if (!/%/.test(feedback)) throw new Error(`no percentage in the explanation: ${feedback.slice(0, 120)}`);
      sample = feedback;
      seen[kind]++;
    } else {
      // Every other preflop question is multiple choice too. It still has to
      // be answered, or the drill never moves on — and a click that waits for
      // a button which is not there costs half a minute of the suite each time.
      await page.click('.option', { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(150);
    }
    // Next question, or the next block of ten when a session runs out.
    await page.click('button.btn.primary', { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(280);
    if (!(await page.$('.question'))) {
      await page.goto(`${BASE}/#drill?module=preflop`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
    }
  }

  if (!seen.allIn) throw new Error(`asked ${asked} preflop questions and none asked what an all-in is worth`);
  if (!seen.range) throw new Error(`asked ${asked} preflop questions and none asked what a hand is worth against a range`);
  console.log(`      graded ${seen.allIn} all-in and ${seen.range} vs-range questions against independently computed numbers`);
  console.log(`      e.g. ${sample.replace(/\s+/g, ' ').slice(0, 110)}…`);
});

await step('a preflop drill has somewhere to look, and a looked-up answer is not credited', async () => {
  // Position asks where the big-blind defending range stops, twenty times a
  // session, and the lesson explained only why it is wide. The Charts tab is
  // a different screen and leaving mid-session abandons it, so there was
  // nowhere to look: being asked without ever being told is guessing with a
  // score attached.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    raw.drills = {};
    for (const [id, n] of [['hand-rankings', 26], ['pot-odds', 39]]) raw.drills[id] = { attempts: n, correct: n - 3 };
    raw.walkthroughs = ['hand-rankings', 'pot-odds'];
    raw.xp = 3000;
    raw.handsPlayed = 60;
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  // Reload before the hash change: a hash-only navigation keeps the app's
  // in-memory profile, which still holds whatever earlier steps recorded
  // (a table hand graded as a position decision, say) and writes it back
  // over this fixture on the next save — which read as two attempts for one.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#drill?module=position`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  const look = await page.$('button:has-text("Show me the chart")');
  if (!look) throw new Error('a preflop question offers nowhere to look the chart up');
  await look.click();
  await page.waitForTimeout(250);

  // Two shapes are correct here, and this used to insist on the first. A
  // question that names the seat you are in gets that seat's grid — which is
  // strictly more use than five columns, and is what makes the three-betting
  // charts reachable at all. A question that does not name a seat is asking
  // you to compare seats, and the five-column table says that better.
  const sheet = await page.evaluate(() => {
    const table = document.querySelector('.cheat-table');
    if (table) {
      return {
        kind: 'columns',
        rows: table.querySelectorAll('tbody tr').length,
        seats: [...table.querySelectorAll('thead th')].map((n) => n.textContent),
      };
    }
    const grid = document.querySelector('.range-grid');
    if (!grid) return null;
    return {
      kind: 'grid',
      rows: grid.querySelectorAll('.range-cell').length,
      caption: (document.querySelector('.chart-caption') || {}).textContent || '',
    };
  });
  if (!sheet) throw new Error('the chart button showed no chart');
  if (sheet.kind === 'columns') {
    if (sheet.rows < 4) throw new Error(`only ${sheet.rows} rows of chart`);
    for (const seat of ['UTG', 'CO', 'BTN']) {
      if (!sheet.seats.includes(seat)) throw new Error(`the sheet is missing ${seat}: ${sheet.seats.join(' ')}`);
    }
  } else {
    if (sheet.rows !== 169) throw new Error(`the grid has ${sheet.rows} cells, not 169`);
    if (!sheet.caption.trim()) throw new Error('the grid does not say which range it is');
  }

  // Answering after looking still teaches, but it is not evidence of recall,
  // so it must not be banked as a correct answer.
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).drills.position || { attempts: 0, correct: 0 });
  await page.click('.option.correct, .option', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(400);
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).drills.position || { attempts: 0, correct: 0 });

  if (after.attempts !== before.attempts + 1) {
    throw new Error(`the attempt was not recorded: ${before.attempts} → ${after.attempts}`);
  }
  if (after.correct !== before.correct) {
    throw new Error('an answer read off the chart was banked as one you knew');
  }
  console.log(`      chart offered (${sheet.kind}, ${sheet.rows}), and the peeked answer scored ${after.correct - before.correct}`);
});

await step('a pot-odds question offers the shortcut, not a chart', async () => {
  // The fast method lived in one lesson step and nowhere else: the worked
  // examples all divided, and the only thing to reach for mid-question was a
  // preflop grid that prices nothing. Reaching for help here has to produce
  // the routine you would actually run at a table.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#drill?module=pot-odds`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  if (await page.$('button:has-text("Show me the chart")')) {
    throw new Error('a pot-odds question offers a preflop chart');
  }
  const look = await page.$('button:has-text("Show me the method")');
  if (!look) throw new Error('a pot-odds question offers nowhere to look the method up');
  await look.click();
  await page.waitForTimeout(250);

  const card = await page.evaluate(() => {
    const sheet = document.querySelector('.cheat-sheet');
    if (!sheet) return null;
    return {
      steps: sheet.querySelectorAll('.cheat-steps li').length,
      rows: [...sheet.querySelectorAll('.cheat-table tbody tr')]
        .map((tr) => [...tr.children].map((c) => c.textContent.trim())),
      text: sheet.textContent.replace(/\s+/g, ' '),
    };
  });
  if (!card) throw new Error('the method button showed no method');
  if (card.steps !== 3) throw new Error(`the counting routine is ${card.steps} steps, not 3`);
  if (!/divide/i.test(card.text)) throw new Error('the card never says what it is instead of');

  // The five rungs, with the numbers the lesson tells you to memorise.
  const expected = [['¼ pot', '6', '17%'], ['⅓ pot', '5', '20%'], ['½ pot', '4', '25%'],
    ['¾ pot', '3.3', '30%'], ['pot', '3', '33%']];
  if (card.rows.length !== expected.length) {
    throw new Error(`the ladder has ${card.rows.length} rungs, not ${expected.length}`);
  }
  expected.forEach(([size, calls, need], i) => {
    const got = card.rows[i];
    if (got[0] !== size || got[1] !== calls || got[2] !== need) {
      throw new Error(`rung ${i + 1} reads ${got.join(' / ')}, expected ${size} / ${calls} / ${need}`);
    }
  });
  console.log(`      ${card.steps} steps and ${card.rows.length} rungs, ${card.rows.map((r) => r.join('=')).join(' ')}`);
});

await step('a lesson page draws the whole climb, with a number on every rung', async () => {
  // The reader's words: "I do not know how much of what I have to do to get
  // to Solid or Mastered." The tile named the next bar in six words and the
  // lesson page named none of it, so the shape — three rungs, which one you
  // are on, what each asks — existed only in the source.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    raw.drills = { outs: { attempts: 22, correct: 16 } };   // 73%, a real mid-climb record
    raw.walkthroughs = [];
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#learn?module=outs`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const ladder = await page.evaluate(() => {
    const rungs = [...document.querySelectorAll('.rung')];
    if (!rungs.length) return null;
    return {
      count: rungs.length,
      here: rungs.filter((n) => n.classList.contains('rung-here')).length,
      text: rungs.map((n) => n.textContent.replace(/\s+/g, ' ')),
    };
  });
  if (!ladder) throw new Error('the lesson page shows no ladder at all');
  if (ladder.count !== 3) throw new Error(`${ladder.count} rungs, expected Learning/Solid/Mastered`);
  if (ladder.here !== 1) throw new Error(`${ladder.here} rungs marked as where you stand, expected exactly 1`);

  const all = ladder.text.join(' ');
  for (const [what, re] of [
    ['the Solid bar', /12 of your last 15/],
    ['the Mastered bar', /27 of your last 30/],
    ['the lesson requirement', /Finish the guided lesson/i],
    ['a run you can act on', /\d+ right answers in a row/],
    ['where you stand on a rung', /\d+ \/ 12/],
  ]) {
    if (!re.test(all)) throw new Error(`the ladder never states ${what}: ${all.slice(0, 200)}`);
  }

  // A migrated save has totals but no record of how the answers went. It must
  // not read as an empty window beside a tile quoting a percentage.
  if (/0 \/ 12/.test(all)) throw new Error(`a 22-answer record shows as nothing: ${all.slice(0, 200)}`);
  console.log(`      ${ladder.count} rungs, one marked, e.g. ${ladder.text[1].slice(0, 96)}…`);
});

await step('the levels screen names the skills that have gone cold', async () => {
  // The rank row said "2 of these have slipped" and pointed at twelve lesson
  // pages. The app knew which two.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    // Mastered on the record, cold on recent answers: the last 30 are poor,
    // and `best` carries what was earned before that.
    raw.drills = {
      'hand-rankings': { attempts: 60, correct: 44, best: 'mastered', recent: '0'.repeat(20) + '1'.repeat(10) },
      'pot-odds': { attempts: 60, correct: 52, best: 'mastered', recent: '1'.repeat(30) },
    };
    raw.walkthroughs = ['hand-rankings', 'pot-odds'];
    // Deliberately no xp or handsPlayed: the panel does not depend on rank,
    // and these steps share one profile — an inflated hand count here is a
    // failure three steps later, in a test about something else.
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#levels`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const panel = await page.evaluate(() => {
    const head = [...document.querySelectorAll('.panel')]
      .find((n) => /gone cold|weggezakt/i.test(n.querySelector('h3')?.textContent || ''));
    return head ? head.textContent.replace(/\s+/g, ' ') : null;
  });
  if (!panel) throw new Error('no panel names the skills that have gone cold');
  if (!/Hand Rankings/.test(panel)) throw new Error(`the cold skill is not named: ${panel}`);
  if (/Pot Odds/.test(panel)) throw new Error(`a skill still in form was listed as cold: ${panel}`);
  if (!/\d+ right answers? back/i.test(panel)) throw new Error(`no way back is offered: ${panel}`);

  // The row is a <button>, and its class carried no styling — so it rendered
  // as a white browser default on a dark page. Check it is painted, not just
  // present.
  const tone = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.panel')]
      .find((n) => /gone cold|weggezakt/i.test(n.querySelector('h3')?.textContent || ''))
      .querySelector('.ladder-row');
    const bg = getComputedStyle(row).backgroundColor;
    const [r, g, b, a = '1'] = (bg.match(/[\d.]+/g) || ['255', '255', '255']);
    return { bg, light: Number(a) > 0.1 && (0.299 * +r + 0.587 * +g + 0.114 * +b) > 140 };
  });
  if (tone.light) throw new Error(`the cold row is painted light on a dark page: ${tone.bg}`);
  console.log(`      ${panel.slice(0, 110)}…`);
});

await step('the table asks for a read before it hands back the buttons', async () => {
  // The table already built the opponent's range and priced the hero against
  // it, silently. The range is the answer to a question nobody was ever
  // asked, so the reader was graded on a call they had no way to reason
  // about. The MDF lesson is heads up to the river facing a bet — where the
  // read is the decision.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    raw.drills = raw.drills || {};
    delete raw.drills.exploit;      // so the attempt this records is visible
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.goto(`${BASE}/#play?lesson=mdf`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  // Play hands until a river read is asked for. Bounded, and a miss is a
  // failure: on this table it has to come up.
  let asked = null;
  const deadline = Date.now() + 70000;
  while (Date.now() < deadline && !asked) {
    if (await page.$('.read-bands .btn')) {
      asked = await page.textContent('.read-ask');
      break;
    }
    const next = await page.$('.action-bar .btn.primary');
    const act = (await page.$('.action-buttons .btn.success'))
      || (await page.$('.action-buttons .btn:not(.danger):not(.primary)'))
      || (await page.$('.action-buttons .btn.danger'));
    await (next || act)?.click().catch(() => {});
    await page.waitForTimeout(260);
  }
  if (!asked) throw new Error('played to the river heads-up and was never asked for a read');
  if (!/what share is air/i.test(asked)) throw new Error(`the question is not the read: ${asked}`);
  if (await page.$('.action-buttons .btn')) {
    throw new Error('the action buttons are still there — the read is skippable');
  }

  await page.click('.read-bands .btn');
  await page.waitForTimeout(350);
  const said = await page.textContent('.read-said').catch(() => null);
  if (!said || !/air/i.test(said)) throw new Error(`no verdict on the read: ${said}`);
  if (!await page.$('.action-buttons .btn')) throw new Error('the buttons did not come back');

  // And it counts as evidence about reading players, like any other decision.
  const attempts = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).drills.exploit || {}).attempts || 0);
  if (attempts < 1) throw new Error('the read was not recorded against Reading Players');
  console.log(`      asked, answered, recorded (${attempts} attempt) — "${said.replace(/\s+/g, ' ').slice(0, 76)}…"`);
});

await step('"I don\'t know" is honest at the read-ask, and does not crash the reader back into a guess', async () => {
  // The read-ask is the one place in the app where the sentinel's shape
  // actually matters: the "you said {said}%" line builds a template literal
  // directly out of whatever was picked. A Symbol sentinel throws the moment
  // that happens; this proves the string sentinel this app actually uses
  // does not, in the one browser that can tell.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    raw.drills = raw.drills || {};
    delete raw.drills.exploit;
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  // The previous step leaves its hand dangling on purpose — read answered,
  // hero action never taken, so its own assertions stay about the read. A
  // goto that only changes the hash does not tear that session down, and
  // this step's own search loop can land a click on ITS leftover action
  // button, recording a real attempt against 'exploit' before this step's
  // own read is even asked. A reload forces a genuinely fresh profile and
  // table, same fix as the outs step below needed for the same reason.
  await page.goto(`${BASE}/#play?lesson=mdf`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  let asked = false;
  const deadline = Date.now() + 70000;
  while (Date.now() < deadline && !asked) {
    if (await page.$('.idk-btn')) { asked = true; break; }
    const next = await page.$('.action-bar .btn.primary');
    const act = (await page.$('.action-buttons .btn.success'))
      || (await page.$('.action-buttons .btn:not(.danger):not(.primary)'))
      || (await page.$('.action-buttons .btn.danger'));
    await (next || act)?.click().catch(() => {});
    await page.waitForTimeout(260);
  }
  if (!asked) throw new Error('played to the river heads-up and never saw the "I don\'t know" option on a read');

  const before = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).drills.exploit || {}).attempts || 0);

  await page.click('.idk-btn');
  await page.waitForTimeout(350);

  const said = await page.textContent('.read-said').catch(() => null);
  if (!said) throw new Error('clicking "I don\'t know" produced no verdict at all');
  if (!/air/i.test(said)) throw new Error(`the honest air percentage is missing from the verdict: ${said}`);
  if (/__idk__/.test(said)) throw new Error(`the raw sentinel leaked into the reader-facing text: ${said}`);
  if (!await page.$('.action-buttons .btn')) throw new Error('the buttons did not come back after a skip');

  const after = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).drills.exploit || {}).attempts || 0);
  if (after !== before + 1) throw new Error(`a skip was not recorded as an attempt: ${before} -> ${after}`);
  const correctAfter = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).drills.exploit || {}).correct || 0);
  console.log(`      skipped honestly, verdict shown, recorded as attempt ${after} (${correctAfter} correct so far)`);
});

await step('opponents notice how you play, and say so', async () => {
  // The wiring no unit test can reach: the reader's folds reach the session
  // memory, the memory reaches the table, the table reaches botAction and the
  // coach. Slow — it takes a dozen spots facing a bet before anyone is
  // entitled to a conclusion — but silence here is a table that quietly got
  // harder, which is the opposite of the lesson.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    raw.xp = 30000;
    raw.handsPlayed = 5000;
    raw.walkthroughs = ['hand-rankings', 'pot-odds', 'outs', 'preflop', 'position',
      'cbet', 'mdf', 'bluffing', 'spr', 'exploit'];
    raw.drills = {};
    for (const id of raw.walkthroughs) {
      raw.drills[id] = { attempts: 40, correct: 39, best: 'mastered', recent: '1'.repeat(30) };
    }
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  // Fold to everything. The most exploitable way to play, and the one an
  // observant opponent should punish.
  const deadline = Date.now() + 150000;
  let notice = null;
  while (Date.now() < deadline && !notice) {
    const band = await page.$('.read-bands .btn');
    if (band) { await band.click().catch(() => {}); await page.waitForTimeout(150); continue; }
    const fold = await page.$('.action-buttons .btn.danger');
    const other = (await page.$('.action-buttons .btn')) || (await page.$('.action-bar .btn.primary'));
    await (fold || other)?.click().catch(() => {});
    await page.waitForTimeout(220);
    notice = await page.evaluate(() => {
      const n = [...document.querySelectorAll('.notice')]
        .find((el) => /noticed how you play|gezien hoe jij speelt/i.test(el.textContent));
      return n ? n.textContent.replace(/\s+/g, ' ') : null;
    });
  }
  if (!notice) throw new Error('folded to everything as a Pro and nobody ever noticed');
  if (!/folded to \d+%/.test(notice)) throw new Error(`the notice does not say what it saw: ${notice}`);
  if (!/bluffing you more often/i.test(notice)) throw new Error(`it does not say what changed: ${notice}`);
  if (/Stan/.test(notice)) throw new Error(`the calling station is not supposed to notice: ${notice}`);
  console.log(`      ${notice.slice(0, 116)}…`);

  // These steps share one profile, and this one needs a Pro's hand count to
  // exist at all. Put it back, or a later test about crediting ten hands
  // counts five thousand and fails about something it is not testing.
  //
  // Leave the table first and reload: the screen holds a live profile object
  // that writes itself back on the next save, straight over the reset.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    raw.handsPlayed = 0;
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const left = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).handsPlayed);
  if (left !== 0) throw new Error(`the fixture did not clean up after itself: ${left} hands left`);
});

await step('the drill lets you check your answer against the chart', async () => {
  // "als ik antwoord heb gegeven kan ik het spiekbriefje/chart helaas niet
  // meer zien, dus ik kan het antwoord ook niet meer controleren" — it was
  // withheld on purpose, reasoning that the answer was already on screen.
  // Knowing the answer covers one hand; seeing where it sits on the grid is
  // the shape, which is the part that carries to the next hand.
  // Questions are drawn at random, so this hunts for the shapes it wants
  // rather than assuming three in a row will contain them. The first version
  // demanded a ringed hand across any three questions and failed on the run
  // where all three happened to be seat-comparison questions.
  let checked = 0;
  let grids = 0;
  let ringed = 0;
  for (let attempt = 0; attempt < 40 && (checked < 3 || ringed < 1); attempt++) {
    const module = attempt % 2 ? 'position' : 'preflop';
    await page.goto(`${BASE}/#drill?module=${module}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(450);
    const option = await page.$('.option:not([disabled])');
    if (!option) continue;
    await option.click();
    await page.waitForTimeout(300);

    const review = await page.$('button:has-text("Check it against")');
    if (!review) continue;           // equity questions have no chart behind them
    await review.click();
    await page.waitForTimeout(220);

    const caption = await page.$('.chart-caption');
    if (caption) {
      grids++;
      const text = (await caption.textContent()).trim();
      const seatBadge = await page.$('.badge.gold');
      const seat = seatBadge ? (await seatBadge.textContent()) : '';
      // The chart has to be for the seat the question puts you in. It used to
      // show big-blind defence to anyone facing a raise, so the three-betting
      // charts were reachable from nowhere at all.
      if (/big blind/i.test(seat) && !/big blind/i.test(text)) {
        throw new Error(`in the big blind and shown "${text}"`);
      }
      // Ring the hand when there is a hand. The boundary questions name a
      // seat but deal no cards — "how far down the suited jacks do you go"
      // is about the row, not about a holding — so demanding a ring on every
      // seat chart failed on a question that was behaving correctly.
      const dealt = await page.$$eval('.spot-hole .card', (els) => els.length);
      const marked = await page.$$eval('.range-cell.you', (els) => els.length);
      if (dealt && marked !== 1) throw new Error(`"${text}" dealt a hand and ringed ${marked} cells`);
      if (!dealt && marked) throw new Error(`"${text}" ringed a hand it never dealt`);
      ringed += marked;
    }
    checked++;
  }
  if (checked < 3) throw new Error(`only ${checked} questions offered a chart to check against`);
  if (!grids) throw new Error('no question ever produced a seat chart to check against');
  console.log(`      ${checked} questions checked, ${grids} of them a seat chart, hand ringed on ${ringed}`);
});

await step('the chart is reachable at the table, without leaving it', async () => {
  // "tijdens het spelen de chart kan klikken en inzien" — the table had a
  // peek button, but it handed over your own equity, which is the answer
  // rather than the reference. The chart and the price ladder live here now.
  await page.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  for (const label of ['Deal me in', 'Deal in', 'Deal']) {
    const button = await page.$(`button:has-text("${label}")`);
    if (button) { await button.click(); break; }
  }
  await page.waitForTimeout(2500);

  // textContent waits for a selector that may never appear — the hero's seat
  // plate has no position label in every layout — so ask, don't wait.
  const textOf = async (selector) => {
    const node = await page.$(selector);
    return node ? (await node.textContent()) || '' : '';
  };

  const open = await page.$('button:has-text("Open the reference")');
  if (!open) throw new Error('there is no way to open the chart at the table');
  await open.click();
  await page.waitForTimeout(350);

  const grid = await page.$$eval('.reference-drawer .range-grid', (els) => els.length);
  if (!grid) throw new Error('the reference opened without a chart in it');
  const ringed = await page.$$eval('.reference-drawer .range-cell.you', (els) => els.length);
  if (ringed !== 1) throw new Error(`${ringed} cells are ringed as the hand you hold`);

  // The chart has to be the one for the seat you are in, not a fixed one.
  const caption = await textOf('.reference-drawer .chart-caption');
  const seat = (await textOf('.seat.hero .seat-pos')).trim();
  // The seat plate says BTN; the caption says Button. Same seat, different
  // register — the first version of this check compared them directly and
  // failed on a chart that was perfectly correct.
  const SEAT_NAMES = {
    UTG: 'under the gun', HJ: 'hijack', CO: 'cutoff',
    BTN: 'button', SB: 'small blind', BB: 'big blind',
  };
  const expected = SEAT_NAMES[seat.toUpperCase()];
  if (expected && !caption.toLowerCase().includes(expected) && !/big blind/i.test(caption)) {
    throw new Error(`sitting in the ${seat} and shown "${caption}"`);
  }
  if (!(await page.$('.reference-drawer .chart-legend'))) throw new Error('the chart has no legend');

  // ...and the price ladder is the other tab, derived rather than typed.
  const tabs = await page.$$('.reference-tab');
  if (tabs.length < 2) throw new Error(`the drawer has ${tabs.length} tab(s)`);
  await tabs[tabs.length - 1].click();
  await page.waitForTimeout(250);
  const rows = await page.$$eval('.reference-drawer .cheat-table tbody tr', (els) => els.length);
  if (rows < 4) throw new Error(`the price ladder has ${rows} rows`);

  // Looking is free; being handed the answer still is not.
  const body = await textOf('.reference-drawer');
  if (!/costs you nothing|kost je niets/.test(body)) {
    throw new Error('the reference does not say it is free to look at');
  }
  // Asking for the element beats scraping a panel whose class the first
  // version of this guessed at.
  const stuck = await page.$('button:has-text("I am stuck")');
  if (!stuck) throw new Error('the answer button disappeared along with the reference');
  console.log(`      chart for the ${seat || 'hero'} seat, legend, ${rows}-row price ladder, free to look at`);
});

await step('the range trainer takes the chart away one rung at a time', async () => {
  // The reader asked for a preflop-only drill they may use the chart with,
  // "tot de chart ranges in mn hoofd zitten". A drill that simply allows the
  // chart never gets there — you get very good at reading a grid. So the
  // support is designed to come off, and this walks all three rungs.
  await page.goto(`${BASE}/#ranges`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const rungs = await page.$$eval('.rung-row', (els) => els.length);
  if (rungs !== 8) throw new Error(`the ladder has ${rungs} checkpoints, not 8`);
  const locked = await page.$$eval('.rung-row.shut', (els) => els.length);
  if (locked !== 1) throw new Error(`${locked} checkpoints are locked; the exam alone should be`);

  // Rung one: the chart is on screen before you answer.
  await page.click('.rung-row');
  await page.waitForTimeout(400);
  const withChart = await page.$$eval('.range-grid', (els) => els.length);
  if (!withChart) throw new Error('the first rung does not show the chart');
  const options = await page.$$eval('.ask-option', (els) => els.map((e) => e.textContent.trim()));
  if (!options.length || options.length > 3) throw new Error(`asked with ${options.length} options`);

  // A seat name is a phrase you have to have been taught; a seat two to the
  // left of the button is something you can see. And "88" says nothing about
  // suits, which for every non-pair is the whole question.
  if (!(await page.$('.ask-table .felt'))) throw new Error('the question does not draw the table');
  const seats = await page.$$eval('.ask-table .seat-pos', (els) =>
    els.map((e) => e.textContent.trim()).filter(Boolean));
  if (seats.length !== 6) throw new Error(`the table shows ${seats.length} named seats`);
  const cards = await page.$$eval('.hand-row .card', (els) => els.length);
  if (cards !== 2) throw new Error(`the hand is shown as ${cards} cards`);
  // The cards alone. Printing "32o" beside them does the reading for you, and
  // reading it is the skill — the chart below is labelled in notation, so
  // finding your hand on it is the translation exercise, every question.
  if (await page.$('.hand-row .hand-big, .hand-row .hand-note')) {
    throw new Error('the hand is spelled out beside its own cards');
  }
  // A real table marks all three seats that the order runs from.
  const markers = await page.$$eval('.ask-table .table-marker',
    (els) => els.map((e) => e.textContent.trim()).sort().join(','));
  if (markers !== 'BB,D,SB') throw new Error(`the table is marked [${markers}], not the dealer and both blinds`);

  await page.click('.ask-option');
  await page.waitForTimeout(300);
  const ringed = await page.$$eval('.range-cell.you', (els) => els.length);
  if (ringed !== 1) throw new Error(`${ringed} cells are ringed as the hand you were asked about`);
  const verdict = await page.textContent('.verdict-box');
  if (!verdict.trim()) throw new Error('an answer produced no verdict');

  // Rung two: the chart is behind a button, and a peek is not credited.
  await page.evaluate(() => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.ranges = { 'open:UTG': { stage: 1, cleared: false, runs: 1 } };
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#ranges`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.click('.rung-row');
  await page.waitForTimeout(400);
  if (await page.$$eval('.range-grid', (els) => els.length)) {
    throw new Error('the second rung shows the chart before it is asked for');
  }
  // A plain '.btn.ghost' selector stopped being unique on this screen the
  // moment the reader could also skip the question outright — both buttons
  // carry that class. Text is the stable handle now.
  await page.click('button:has-text("Show me the chart")');
  await page.waitForTimeout(250);
  if (!(await page.$$eval('.range-grid', (els) => els.length))) {
    throw new Error('peeking did not produce the chart');
  }
  const warned = await page.textContent('.panel');
  if (!/not be counted|telt niet mee/.test(warned)) {
    throw new Error('a peek is not marked as uncredited');
  }

  // Rung three: no chart, and a clock.
  await page.evaluate(() => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.ranges = { 'open:UTG': { stage: 2, cleared: false, runs: 2 } };
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#ranges`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.click('.rung-row');
  await page.waitForTimeout(400);
  if (!(await page.$$eval('.clock-bar', (els) => els.length))) {
    throw new Error('the unaided rung is not timed');
  }
  if (await page.$$eval('.range-grid', (els) => els.length)) {
    throw new Error('the unaided rung shows the chart');
  }
  // ".btn.ghost" is no longer unique to the peek button — "I don't know" is
  // meant to stay available here, on purpose, since the unaided rung is
  // exactly where an honest skip matters most. What must not survive onto
  // this rung is the CHART peek specifically.
  if (await page.$('button:has-text("Show me the chart")')) {
    throw new Error('the unaided rung still offers a peek');
  }
  if (!(await page.$('.idk-btn'))) throw new Error('the unaided rung dropped the "I don\'t know" button');

  // Handing a spot back should not require a screenshot.
  await page.click('.ask-option');
  await page.waitForTimeout(300);
  const copy = (await page.$('button:has-text("Copy")')) || (await page.$('button:has-text("Kopieer")'));
  if (!copy) throw new Error('the trainer cannot copy a question out');

  // Leave no fixture behind: a later step counts what this profile knows.
  await page.evaluate(() => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    delete raw.ranges;
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log('      8 checkpoints, chart shown then hidden then gone, clock on the last rung');
});

await step('a checkpoint with every rung passed says what is still missing, and counts it the right way round', async () => {
  // "0 van 8 in je hoofd, maar ik heb under the gun 3x gedaan — wanneer is
  // het 1 van de 8?" All three pips lit and nothing on the row said why:
  // the edge of the range had not all come up yet. Only the summary after a
  // clock run mentioned it, and it had the number backwards — the hands
  // already seen, reported as the hands still missing.
  const seeded = await page.evaluate(async () => {
    const { edgePoolFor } = await import('/src/js/trainers/rangeTrainer.js');
    const { CHECKPOINTS } = await import('/src/js/data/rangeLadder.js');
    const pool = edgePoolFor(CHECKPOINTS.find((c) => c.key === 'open:UTG'));
    const hands = Object.fromEntries(pool.slice(0, 20).map((h) => [h, '1']));
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.ranges = { 'open:UTG': { stage: 3, cleared: false, runs: 3, peeks: 0, hands } };
    localStorage.setItem(key, JSON.stringify(raw));
    return { total: pool.length, seen: 20 };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#ranges`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const toGo = seeded.total - seeded.seen;
  const note = await page.$eval('.rung-row .rung-note', (e) => e.textContent.trim());
  if (!note.includes(String(toGo))) {
    throw new Error(`all three rungs passed with ${toGo} edge hands unseen, and the row reads "${note}"`);
  }

  // Play the clock rung for real, right every time, so the run passes and
  // the summary has to explain why that still is not "in your head".
  await page.click('.rung-row');
  await page.waitForTimeout(400);
  const RANKS = '23456789TJQKA';
  for (let i = 0; i < 15; i++) {
    await page.waitForSelector('.ask-option:not([disabled])', { timeout: 10000 });
    const [a, b] = await page.$$eval('.hand-row .card', (els) => els.map((e) => ({
      rank: e.querySelector('.rank').textContent.trim(),
      suit: e.querySelector('.suit').textContent.trim(),
    })));
    const [hi, lo] = RANKS.indexOf(a.rank) >= RANKS.indexOf(b.rank) ? [a, b] : [b, a];
    const hand = hi.rank === lo.rank ? hi.rank + lo.rank : hi.rank + lo.rank + (a.suit === b.suit ? 's' : 'o');
    const raise = await page.evaluate(async (h) => {
      const { CHARTS } = await import('/src/js/data/ranges.js');
      return CHARTS.rfi.UTG.has(h);
    }, hand);
    await page.click(`.ask-option:has-text("${raise ? 'Raise' : 'Fold'}")`);
    await page.click('button.btn.primary.lg.block');
  }
  await page.waitForTimeout(300);
  const after = await page.evaluate(async () => {
    const { edgePoolFor } = await import('/src/js/trainers/rangeTrainer.js');
    const { CHECKPOINTS } = await import('/src/js/data/rangeLadder.js');
    const pool = edgePoolFor(CHECKPOINTS.find((c) => c.key === 'open:UTG'));
    const hands = JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).ranges['open:UTG'].hands || {};
    return { total: pool.length, seen: pool.filter((h) => h in hands).length };
  });
  const missing = after.total - after.seen;
  const summary = (await page.textContent('.panel')).replace(/\s+/g, ' ');
  if (!summary.includes(`${missing} of ${after.total}`) && !summary.includes(`${missing} van ${after.total}`)) {
    throw new Error(`${missing} of ${after.total} edge hands are still unseen, and the summary reads "${summary}"`);
  }

  await page.evaluate(() => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    delete raw.ranges;
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log(`      the row said ${toGo} to go; one clock run later the summary said ${missing} of ${after.total}`);
});

await step('the room you play in is a choice, and it survives a reload', async () => {
  // "Kots groen" — one palette imposed on every screen. The picker is the
  // answer, so it has to do three things here: open, actually repaint, and
  // still be repainted after a reload without a frame of the old colours.
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // The picker lives in the ledger now, with the other switches.
  await page.click('.ledger-button');
  await page.waitForSelector('.ledger .theme-panel', { state: 'attached', timeout: 3000 });
  const closed = await page.evaluate(() => document.querySelector('.theme-panel').hidden);
  if (!closed) throw new Error('the picker starts open');

  await page.click('.theme-button');
  await page.waitForTimeout(150);
  const rooms = await page.$$eval('.theme-option', (els) => els.map((e) => e.textContent.slice(0, 40)));
  if (rooms.length !== 4) throw new Error(`the picker offers ${rooms.length} rooms, not 4`);

  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('.theme-option:last-child');   // Daylight, the light one
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    // The felt is the biggest surface in the app; a theme that leaves it
    // alone has not really changed anything.
    ink: getComputedStyle(document.body).color,
  }));
  if (after.theme !== 'daylight') throw new Error(`picked daylight, got ${after.theme}`);
  if (after.bg === before) throw new Error(`the ground did not repaint: still ${before}`);

  // A light room means dark ink. If this still reads as near-white, the
  // tokens are being ignored and only the attribute moved.
  const lightness = (after.ink.match(/\d+/g) || []).slice(0, 3).reduce((a, b) => a + +b, 0) / 3;
  if (lightness > 120) throw new Error(`daylight is still painting light ink: ${after.ink}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const kept = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (kept !== 'daylight') throw new Error(`the choice did not survive a reload: ${kept}`);

  // Put it back so the screens that follow are shot in the default room.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    raw.settings = { ...(raw.settings || {}), theme: 'midnight' };
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log(`      four rooms offered, daylight repainted ${before} → ${after.bg}, kept across a reload`);
});

await step('the first visit says where you are and what the game is', async () => {
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    delete raw.seenPrologue;
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const text = await page.textContent('.prologue').catch(() => '');
  if (!/1890/.test(text) || !/Commodore/.test(text)) throw new Error(`no prologue on a first visit: ${text.slice(0, 80)}`);
  await page.click('.prologue .btn.primary');
  await page.waitForTimeout(400);
  if (await page.$('.prologue')) throw new Error('casting off did not put the prologue away');
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).seenPrologue);
  if (!seen) throw new Error('the prologue will come back on every visit');
});

await step('the front door is the river, with you on it', async () => {
  // The reader's verdict on the whole app: "it is still the same game." It
  // was not a game — a grid of modules with a progress bar has nowhere to be
  // and nobody to beat. The front door is a river of stops now, each a real
  // stake with somebody who owns it, and the climb is money.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    raw.bankroll = 412;
    raw.stakeKey = 'nl10';
    raw.seenPrologue = true;
    // Moored at the Ferry, having been as far as Cotton Row: the road is open
    // that far, so what keeps the next city shut is the purse.
    raw.career = { venue: 'nl10', best: 'nl25', busted: 1, staked: 20, beaten: ['nl2'] };
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const river = await page.evaluate(() => ({
    stops: document.querySelectorAll('.river-map .map-stop').length,
    landmarks: document.querySelectorAll('.river-map .landmark').length,
    here: [...document.querySelectorAll('.map-stop.is-here')].map((n) => n.textContent),
    shut: document.querySelectorAll('.map-stop.is-shut').length,
    taken: document.querySelectorAll('.map-stop.taken').length,
    cotton: document.querySelector('.map-stop[data-key="nl25"]')?.textContent || '',
    card: document.querySelector('.here-card')?.textContent.replace(/\s+/g, ' ') || '',
    purse: document.querySelector('.purse')?.textContent || '',
    boat: !!document.querySelector('.your-boat'),
  }));
  if (river.stops !== 8 || river.landmarks !== 8) throw new Error(`${river.stops} stops and ${river.landmarks} landmarks on the river, expected 8`);
  if (river.here.length !== 1 || !/The Ferry/.test(river.here[0])) throw new Error(`you are at: ${river.here.join(', ') || 'nowhere'}`);
  if (river.shut < 1) throw new Error('every stop is open, so the climb costs nothing');
  if (river.taken !== 1) throw new Error(`${river.taken} stops marked as taken, expected 1`);
  if (!/NL25/.test(river.cotton) || !/\$750/.test(river.cotton)) throw new Error(`the next stops do not say what they take: ${river.cotton}`);
  if (!/The Ferry/.test(river.card) || !/NL10/.test(river.card) || !/Hollis/.test(river.card)) {
    throw new Error(`the stop you are at is not described: ${river.card.slice(0, 120)}`);
  }
  if (!/\$412/.test(river.purse)) throw new Error(`the purse is not on the rail: ${river.purse}`);
  if (!river.boat) throw new Error('your boat is not on the water');
  // And the training did not disappear; it stopped being the front door.
  if (!await page.$('.study-line')) throw new Error('there is no way back to the lessons');

  // A stop you cannot afford yet still tells you who is there and what it takes.
  await page.click('.map-stop[data-key="nl25"]');
  await page.waitForTimeout(500);
  if (!/stop\?at=nl25/.test(page.url())) throw new Error(`tapping Cotton Row went to ${page.url()}`);
  const shut = (await page.textContent('#screen')).replace(/\s+/g, ' ');
  if (!/Evangeline/.test(shut)) throw new Error('nobody owns the table at Cotton Row');
  if (!/\$750/.test(shut) || !await page.$('.stop-actions.shut')) throw new Error('a shut stop does not say what it takes');
  if (!/Study first/.test(shut)) throw new Error('the stop does not point at the lesson that beats its boss');
});

await step('every place is on the chart, and no sign covers another', async () => {
  // The reader asked for the lessons, the charts and the tables to be part
  // of the map rather than a menu beside it. Every place is a sign on the
  // chart, each takes you where it says, and on a desktop or a phone no sign
  // sits on top of another.
  const signs = () => page.evaluate(() => {
    const plates = [...document.querySelectorAll('.river-map .map-stop, .river-map .map-place')];
    const boxes = plates.map((n) => ({ name: n.querySelector('.map-name, .map-place-name')?.textContent, r: n.getBoundingClientRect() }));
    const hits = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r;
        const b = boxes[j].r;
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) hits.push(`${boxes[i].name} / ${boxes[j].name}`);
      }
    }
    const scroller = document.querySelector('.map-scroller').getBoundingClientRect();
    const here = document.querySelector('.map-stop.is-here').getBoundingClientRect();
    return {
      count: plates.length,
      places: document.querySelectorAll('.river-map .place').length,
      hits,
      hereInView: here.left >= scroller.left - 1 && here.right <= scroller.right + 1,
    };
  });
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const seen = await signs();
    if (seen.count !== 16 || seen.places !== 8) throw new Error(`${seen.count} signs and ${seen.places} places at ${w}px, expected 16 and 8`);
    if (seen.hits.length) throw new Error(`signs on top of each other at ${w}px: ${seen.hits.join(', ')}`);
    // On a phone the chart is wider than the screen; it opens on your boat.
    if (!seen.hereInView) throw new Error(`the stop you are at is scrolled out of sight at ${w}px`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  // Dutch names run longer than the English ones; the signs have to fit
  // either way. Switched back in a finally, so a failure here does not leave
  // every later step reading Dutch.
  const switchTo = async (lang) => {
    await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.click('.ledger-button');
    await page.waitForTimeout(250);
    const chip = await page.$(`.lang-chip:not(.active):has-text("${lang}")`);
    if (chip) { await chip.click(); await page.waitForTimeout(400); }
  };
  try {
    await switchTo('NL');
    await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const dutch = await signs();
    if (dutch.hits.length) throw new Error(`Dutch signs on top of each other: ${dutch.hits.join(', ')}`);
  } finally {
    await switchTo('EN');
  }
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  for (const [place, route] of [['school', 'train'], ['pilothouse', 'ranges'], ['tradingpost', 'store'], ['saloon', 'play']]) {
    await page.click(`.map-place.place-${place}`);
    await page.waitForTimeout(400);
    if (!new RegExp(`#${route}\\b`).test(page.url())) throw new Error(`the ${place} sign went to ${page.url()}`);
    await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
  }
});

await step('a stop seats you across from the one who owns it, and takes the seat out of the purse', async () => {
  await page.goto(`${BASE}/#stop?at=nl10`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const bubble = await page.textContent('.bubble');
  if (!/crossings/.test(bubble)) throw new Error(`Hollis does not say hello: ${bubble}`);
  await page.click('.stop-actions .btn.primary');
  await page.waitForTimeout(800);
  if (!/play\?mode=grind/.test(page.url())) throw new Error(`taking a seat went to ${page.url()}`);
  const table = await page.evaluate(() => ({
    place: document.querySelector('.table-place')?.textContent,
    boss: document.querySelector('.seat.boss .seat-name')?.textContent || '',
    faces: document.querySelectorAll('.seat-face').length,
    speech: document.querySelector('.seat-speech')?.textContent || '',
    purse: document.querySelector('.purse')?.textContent || '',
    back: !!document.querySelector('#topbar .crest.back'),
  }));
  if (table.place !== 'The Ferry') throw new Error(`the table is at ${table.place}`);
  if (!/Hollis/.test(table.boss)) throw new Error(`the owner is not at the table: ${table.boss}`);
  if (table.faces !== 5) throw new Error(`${table.faces} faces at a six-handed table`);
  if (!/crossings/.test(table.speech)) throw new Error('the owner sat there without a word');
  if (!table.back) throw new Error('there is no way back to the river from the table');
  await page.waitForTimeout(1500);
  const purse = await page.textContent('.purse');
  if (!/\$402/.test(purse)) throw new Error(`the seat was not paid for: ${purse}`);

  await page.click('button:has-text("Cash out")');
  await page.waitForTimeout(600);
  if (!/stop\?at=nl10&after=/.test(page.url())) throw new Error(`cashing out went to ${page.url()}`);
});

await step('the boat goes back upriver without losing how far it got', async () => {
  await page.goto(`${BASE}/#stop?at=nl5`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.click('.stop-actions .btn.primary');
  await page.waitForTimeout(300);
  // The trip is made on the map: the boat is seen steaming there first.
  if (!await page.$('.river-map .your-boat.sailing')) throw new Error('the boat never set off on the map');
  const career = await page.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).career);
  if (career.venue !== 'nl5') throw new Error(`travelled to ${career.venue}`);
  // The front door put the boat at the Ferry, having been as far as Cotton Row.
  if (career.best !== 'nl25') throw new Error(`the furthest stop dropped to ${career.best}`);
  await page.waitForFunction(() => /stop\?at=nl5/.test(location.hash), null, { timeout: 8000 })
    .catch(() => { throw new Error('the boat never tied up at Fisher\'s Rest'); });
  await page.waitForTimeout(200);
  if (!await page.$('.scene-boat.arriving')) throw new Error('the boat did not arrive');
  // Put it back for the steps that follow.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1'));
    raw.career.venue = 'nl10';
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
});

await step('a graded question can be copied out as text', async () => {
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#drill?module=hand-rankings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  if (await page.$('button:has-text("Copy this question")')) {
    throw new Error('the copy button appeared before the question was answered');
  }
  await (await page.$('.option')).click();
  await page.waitForTimeout(300);

  // The clipboard is not reachable from a headless page without a permission
  // grant, so the fallback is what gets checked: the text has to be gettable
  // by hand when the copy itself fails.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('no clipboard here')) },
    });
  });
  await page.click('button:has-text("Copy this question")');
  await page.waitForTimeout(200);
  const text = await page.$eval('.copy-fallback', (n) => n.value || n.textContent);
  for (const want of ['Poker Trainer v', 'Q: ', 'Correct answer:', 'The game explained:']) {
    if (!text.includes(want)) throw new Error(`copied text is missing "${want}":\n${text}`);
  }
  if (/\*\*/.test(text)) throw new Error('copied text still carries ** markup');
  console.log(`      copied ${text.split('\n').length} lines`);
});

await step('jargon explains itself wherever it appears, in both languages', async () => {
  // Wrapped so that a failure here still hands the next step an English
  // app: leaving the language switched knocks over every check that
  // follows and buries the real failure under three fake ones.
  try {
    // The glossary was built on hand-written [[markup]], so it worked in the
    // lessons and nowhere else — a reader met "flush draw" in a drill with no
    // way to ask what it meant, which is exactly where they most need to.
    const seen = { en: 0, nl: 0 };
    for (const lang of ['en', 'nl']) {
      await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      // The language lives in the profile settings, so it is switched the way a
      // reader switches it — through the chip in the header.
      const wanted = lang.toUpperCase();
      await page.click('.ledger-button');
      await page.waitForTimeout(250);
      const chip = await page.$(`.lang-chip:not(.active):has-text("${wanted}")`);
      if (chip) { await chip.click(); await page.waitForTimeout(400); }

      for (const mod of ['outs', 'pot-odds', 'spr']) {
        await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
        await page.goto(`${BASE}/#drill?module=${mod}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        const entry = await page.$('.drill-entry-input');
        if (entry) { await entry.fill('1'); await page.click('.drill-entry button'); }
        else { await (await page.$('.option')).click(); }
        await page.waitForTimeout(300);
        seen[lang] += await page.$$eval('.term', (n) => n.length);

        // Budget: no single block may turn into a page of links.
        const worst = await page.$$eval('.question, .feedback > div',
          (blocks) => Math.max(0, ...blocks.map((b) => b.querySelectorAll('.term').length)));
        if (worst > 3) throw new Error(`${lang}/${mod}: one block auto-linked ${worst} terms`);

        // And a term must never be linked twice inside the same block.
        const dupes = await page.$$eval('.question, .feedback > div', (blocks) => blocks.filter((b) => {
          const words = [...b.querySelectorAll('.term')].map((x) => x.textContent.toLowerCase());
          return new Set(words).size !== words.length;
        }).length);
        if (dupes) throw new Error(`${lang}/${mod}: the same word was linked twice in one block`);
      }
    }
    if (!seen.en) throw new Error('no jargon was linked in English');
    if (!seen.nl) throw new Error('no jargon was linked in Dutch');
    console.log(`      linked ${seen.en} terms in English, ${seen.nl} in Dutch`);

    // Tapping one has to actually explain it.
    await page.click('.term');
    await page.waitForTimeout(250);
    const def = await page.$('.term-def');
    if (!def) throw new Error('tapping a term did not open a definition');
    if ((await def.textContent()).length < 40) throw new Error('the definition is empty');
  } finally {
    await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.click('.ledger-button');
    await page.waitForTimeout(250);
    const back = await page.$('.lang-chip:not(.active):has-text("EN")');
    if (back) { await back.click(); await page.waitForTimeout(300); }
    await page.keyboard.press('Escape');
  }
});

await step('when only the lesson is left, it says so where the button is', async () => {
  // A module at 50/52 and 96% is past both of Mastered's numbers, so the only
  // thing left is one pass through the guided lesson. The tile named it as a
  // noun — "Mastered: the guided lesson" — which reads as a category rather
  // than a thing to do, and the lesson page offered "Teach me this" and
  // "Skip to drills" as equal options. So the reader kept drilling a module
  // that no amount of drilling could move.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    raw.drills = { 'hand-rankings': { attempts: 52, correct: 50 } };
    raw.walkthroughs = [];
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const tile = await page.evaluate(() => {
    const found = [...document.querySelectorAll('.module-tile')]
      .find((n) => /Hand Rankings/i.test(n.querySelector('.name')?.textContent || ''));
    return found ? found.textContent.replace(/\s+/g, ' ') : null;
  });
  if (!tile) throw new Error('no tile for Hand Rankings');
  if (!/finish the guided lesson/i.test(tile)) {
    throw new Error(`the tile does not say what to do: ${tile}`);
  }

  // And the page you land on says it beside the button that does it.
  await page.goto(`${BASE}/#learn?module=hand-rankings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const note = await page.$eval('.notice', (n) => n.textContent.replace(/\s+/g, ' ')).catch(() => null);
  if (!note || !/only thing left/i.test(note)) {
    throw new Error(`the lesson page does not flag the last requirement: ${note}`);
  }

  // The requirement names a thing; a button has to carry that name, or the
  // reader cannot tell which of them it means. The page already shows a
  // summary and key points, which read like a lesson in their own right.
  const labels = await page.$$eval('.screen button', (ns) => ns.map((n) => n.textContent.trim()));
  if (!labels.some((label) => /guided lesson/i.test(label))) {
    throw new Error(`no button is named after the requirement: ${labels.join(' | ')}`);
  }
  // And it says what it is, since the name alone is a riddle.
  const shape = await page.$$eval('.faint', (ns) => ns.map((n) => n.textContent).find((tx) => /step/i.test(tx)) || null);
  if (!shape || !/\d/.test(shape)) {
    throw new Error(`the page never says what the guided lesson consists of: ${shape}`);
  }

  // Once the lesson is done it must stop nagging.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1'));
    raw.walkthroughs = ['hand-rankings'];
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const after = await page.$eval('.notice', (n) => n.textContent).catch(() => null);
  if (after && /only thing left/i.test(after)) {
    throw new Error('the note is still there after the lesson was finished');
  }
  console.log('      tile and lesson page both name the last requirement, and it clears');
});

await step('a tile says what is still missing, not just what the target is', async () => {
  // 9 out of 10 is 90%, and Solid asks for 75% — so a tile reading "90%"
  // beside "Solid at 15 questions at 75%" looks like a bar already cleared.
  // The half that is short is the count, and working that out meant
  // subtracting one number on the tile from another.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    // Ten answers at 90% on Outs & Equity, plus just enough elsewhere to
    // reach Minnow — Outs & Equity is locked until then.
    raw.drills = { outs: { attempts: 10, correct: 9 }, 'hand-rankings': { attempts: 20, correct: 18 } };
    raw.walkthroughs = ['hand-rankings'];
    raw.xp = 600;
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const tile = await page.evaluate(() => {
    const found = [...document.querySelectorAll('.module-tile')]
      .find((n) => /Outs/i.test(n.querySelector('.name')?.textContent || ''));
    return found ? found.textContent.replace(/\s+/g, ' ') : null;
  });
  if (!tile) throw new Error('no tile for Outs & Equity');
  if (!/9\/10/.test(tile)) throw new Error(`the tile does not show the record: ${tile}`);
  // 9 of the last 10 right, and Solid wants 12 of its 15-answer window — so
  // the run is five, not three: the window has to be full before it can be
  // judged, and two of those five are questions nobody has asked yet. The
  // tile has to carry that figure, not the target with the subtraction left
  // to the reader.
  if (!/5 right answers in a row/i.test(tile)) {
    throw new Error(`the tile never says how many more are needed: ${tile}`);
  }
  console.log(`      tile reads: ${tile.slice(0, 120)}`);
});

await step('the home screen names one module and the grid marks the same one', async () => {
  // Reported: the banner named a module, the grid showed two tiles both
  // reading "Learning", and nothing said which one was meant or why.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const marked = await page.$$eval('.module-tile.next-up .name', (n) => n.map((x) => x.textContent.trim()));
  if (marked.length !== 1) throw new Error(`expected exactly one marked tile, got ${marked.length}`);

  const banner = await page.$eval('.panel', (p) => p.textContent);
  const named = await page.$eval('.panel .btn.primary.lg', (b) => b.textContent);
  if (!named.includes(marked[0])) {
    throw new Error(`the banner points at "${named}" but the grid marks "${marked[0]}"`);
  }

  // And it has to say on what grounds, not just which.
  const why = await page.$$eval('.panel .faint', (n) => n.map((x) => x.textContent.trim()));
  if (!why.some((line) => line.length > 40 && /\b(yet|tried|questions|lesson|accuracy|mastered)\b/i.test(line))) {
    throw new Error(`no reason given for the recommendation; saw: ${JSON.stringify(why)}`);
  }
  console.log(`      points at ${marked[0]}, and says why`);
});

await step('no screen prints a percentage it has no sample for', async () => {
  // The same fault as the "3/3" tile, hunted across every screen that shows a
  // rate: the headline accuracy tile had no evidence bar at all while the
  // module tiles under it had one, and the calibration rows showed "100% of
  // 1" directly above a verdict that waits for fifteen answers.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    raw.drills = { 'hand-rankings': { attempts: 3, correct: 3 } };
    raw.calibration = { sure: { attempts: 1, correct: 1 }, guess: { attempts: 2, correct: 2 } };
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const faults = [];
  for (const [route, selector, what, least] of [
    ['#train', '.stat', 'the training stat tiles', 4],
    ['#stats', '.stat, .calib-value', 'the progress tiles and calibration rows', 5],
  ]) {
    // The reload above is what makes the seeded profile real: going straight
    // from #train to #stats is only a fragment navigation, so the app keeps
    // the profile it already holds and never re-reads storage — which is why
    // the first version of this check was measuring an untouched profile.
    await page.evaluate((hash) => { window.location.hash = hash; }, route);
    await page.waitForTimeout(500);
    const texts = await page.$$eval(selector, (ns) => ns.map((n) => n.innerText.trim()));
    // A selector that matches nothing passes this test for free, which is
    // exactly how the first version of it passed while both faults were
    // still in place. Fail loudly instead.
    if (texts.length < least) {
      throw new Error(`"${selector}" matched ${texts.length} elements on ${route} — the check is not looking at anything`);
    }
    // Three answers and one calibration entry cannot produce a percentage
    // anywhere. Achievements and rank counts are not rates, so only "%" is
    // the thing being hunted here.
    for (const text of texts) {
      if (/\d+(\.\d+)?%/.test(text)) faults.push(`${what}: "${text.replace(/\n/g, ' · ')}"`);
    }
  }
  if (faults.length) throw new Error(`a rate was shown without a sample:\n      ${faults.join('\n      ')}`);
  console.log('      3 answers and 3 calibration entries produced no percentages');
});

await step('a lesson is played, not answered', async () => {
  // Four lessons covering the three shapes: one you act on every hand
  // (preflop), one that waits for a tagged decision (cbet), one that plays
  // everything and asks you to read your hand (hand-rankings), and one whose
  // spot is rarest (bluffing).
  for (const [id, seats] of [['preflop', 6], ['cbet', 2], ['hand-rankings', 2], ['bluffing', 2]]) {
    await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${BASE}/#play?lesson=${id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.felt', { timeout: 8000 });

    const seen = await page.$$eval('.seat', (n) => n.length);
    if (seen !== seats) throw new Error(`${id}: expected ${seats} seats, got ${seen}`);
    const note = await page.textContent('.lesson-note');
    if (!note || note.length < 30) throw new Error(`${id}: the table does not say what it simplified`);

    await page.click('button.btn.primary.lg');           // Deal me in
    // A lesson that waits for a tagged spot searches synchronously and is
    // there at once; one where every decision is yours still has to wait for
    // the bots ahead of you to act at table speed.
    let asked = null;
    for (let i = 0; i < 40 && !asked; i++) {
      asked = await page.$('.spot-name') || await page.$('.practice-question');
      if (!asked) await page.waitForTimeout(400);
    }
    if (!asked) {
      const log = await page.$$eval('.log div', (n) => n.slice(-4).map((x) => x.textContent));
      throw new Error(`${id}: dealt but never asked the reader anything. Log: ${JSON.stringify(log)}`);
    }
    // And it must not have answered its own question on the way.
    const coach = await page.textContent('.coach');
    if (/\d+(\.\d+)?% *$/m.test(coach) && /equity/i.test(coach)) {
      throw new Error(`${id}: the coach gave the numbers away unasked`);
    }
  }
  console.log('      four lessons dealt straight to the reader\'s own decision');
});

await step('a lesson run ends in a report and is remembered afterwards', async () => {
  // The three properties that make a lesson out of a table: it ends, it is
  // marked, and what you got wrong is still there next time.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#play?lesson=pot-odds`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.felt', { timeout: 8000 });
  await page.click('button.btn.primary.lg');

  // Play the run out, always taking the first action offered.
  for (let i = 0; i < 400; i++) {
    if (await page.$('.run-report')) break;
    const opt = await page.$('.practice-option:not([disabled])');
    if (opt) { await opt.click(); await page.waitForTimeout(120); continue; }
    // A read comes before the buttons on any postflop street where one
    // opponent has bet, which inside a lesson is most of them.
    const band = await page.$('.read-bands .btn');
    if (band) { await band.click(); await page.waitForTimeout(120); continue; }
    const act = await page.$('.action-buttons button');
    if (act) { await act.click(); await page.waitForTimeout(120); continue; }
    const deal = await page.$('.action-bar button.btn.primary');
    if (deal) { await deal.click(); await page.waitForTimeout(160); continue; }
    await page.waitForTimeout(150);
  }

  const report = await page.$('.run-report');
  if (!report) throw new Error('ten spots did not produce a report');
  const text = await report.innerText();
  if (!/\d+ of 10/.test(text)) throw new Error(`the report does not say the score: "${text.slice(0, 80)}"`);

  const stored = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    return { run: (raw.lessonRuns || {})['pot-odds'] || null, hands: raw.handsPlayed || 0 };
  });
  if (!stored.run || stored.run.runs !== 1) {
    throw new Error(`the run was not filed: ${JSON.stringify(stored.run)}`);
  }
  // Finding ten spots deals well over a hundred hands, nearly all of them
  // played by the autopilot. Counting those would advance the rank, the
  // hands tile and the hand-count achievements on somebody else's play.
  if (stored.hands > 20) {
    throw new Error(`${stored.hands} hands credited for a ten-spot run — the autopilot's hands are being counted`);
  }

  // A report naming mistakes must leave something behind to warn about.
  const named = /\d+×/.test(text);
  if (named && !Object.keys(stored.run.weak || {}).length) {
    throw new Error('mistakes were reported and none were remembered');
  }

  // And the memory has to survive leaving the table entirely.
  if (named) {
    await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${BASE}/#play?lesson=pot-odds`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lesson-note', { timeout: 8000 });
    const warning = await page.$('.lesson-warning');
    if (!warning) throw new Error('a fresh visit did not warn about last time');
    console.log(`      run scored on ${stored.hands} hands, `
      + `${Object.keys(stored.run.weak).length} weak spot(s) carried over`);
  } else {
    console.log('      run scored with no mistakes to carry over');
  }
});

await step('the rank chip opens the ladder, and locked ranks stay locked', async () => {
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.click('.rank-chip');
  await page.waitForTimeout(400);
  const url = page.url();
  if (!/#levels/.test(url)) throw new Error(`rank chip went to ${url}`);

  const seen = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.panel')].map((p) => p.textContent).join(' ');
    return {
      ladder: /The ladder/.test(rows),
      locked: (rows.match(/Locked/gi) || []).length,
      next: /Next/.test(rows),
      // A locked rank must not spell out its requirements.
      leaks: /Skills Mastered/.test(rows)
        ? [...document.querySelectorAll('.panel')].filter((p) => /Locked/i.test(p.textContent)
            && /Skills at Solid/.test(p.textContent)).length
        : 0,
    };
  });
  if (!seen.ladder) throw new Error('the ladder did not render');
  if (seen.locked < 2) throw new Error(`expected several locked ranks, saw ${seen.locked}`);
  if (!seen.next) throw new Error('the next rank was not marked');

  // A rank already reached must open and show what it took — the thing the
  // first version of this screen had no way to do.
  const earned = await page.$$('button.ladder-row');
  if (!earned.length) throw new Error('no rank rows are pressable');
  const opened = await page.evaluate(() => {
    const row = [...document.querySelectorAll('button.ladder-row')]
      .find((r) => /Earned/i.test(r.textContent));
    if (!row) return 'no earned rank to press';
    const detail = [...row.children].find((c) => c.hasAttribute('hidden') || c.hidden);
    if (!detail) return 'an earned rank has no collapsed detail to open';
    const before = detail.hidden;
    row.click();
    const after = detail.hidden;
    row.click();
    if (before === after) return 'pressing an earned rank did not open it';
    if (detail.hidden !== before) return 'pressing it again did not close it';
    return null;
  });
  if (opened) throw new Error(opened);

  // Locked ranks must stay shut.
  const lockedPressable = await page.evaluate(() => [...document.querySelectorAll('.ladder-row')]
    .filter((r) => /Locked/i.test(r.textContent) && r.tagName === 'BUTTON').length);
  if (lockedPressable) throw new Error(`${lockedPressable} locked ranks are pressable`);
});

/* ---- pearls, the shelf, free play and Silas's notes ---- */

const seedFresh = async (extra = {}) => {
  await veteran(false);
  await page.evaluate((more) => {
    const base = { seenPrologue: true, settings: { theme: 'midnight', lang: 'en', sound: false, music: false } };
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify({ ...base, ...more }));
  }, extra);
  await page.reload({ waitUntil: 'domcontentloaded' });
};

await step('a new player owns the first chapter and has to play for the next', async () => {
  await seedFresh();
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.trail-stop', { timeout: 5000 });
  const trail = await page.evaluate(() => [...document.querySelectorAll('.trail-stop')].map((n) => n.className));
  if (/shelved|locked/.test(trail[0])) throw new Error('the first chapter is not open to a new player');
  if (!/shelved/.test(trail[1])) throw new Error(`chapter two should be on the shelf: ${trail[1]}`);
  const shelfLine = await page.textContent('.shelf-line');
  if (!/Pot Odds/.test(shelfLine) || !/more pearls/.test(shelfLine)) throw new Error(`the school does not say what the next chapter costs: ${shelfLine}`);

  // Every way into a chapter on the shelf lands on its price.
  for (const route of ['#learn?module=pot-odds', '#drill?module=pot-odds', '#walkthrough?module=pot-odds']) {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    if (!await page.$('.on-shelf .price-tag')) throw new Error(`${route} opened without being bought`);
    if (await page.$('.option')) throw new Error(`${route} asked a question from a chapter nobody owns`);
  }
  // The assay office serves nobody without the Pot Odds chapter.
  await page.goto(`${BASE}/#lab-run`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  if (await page.$('.lab-input, .action-buttons')) throw new Error('the Lab dealt a spot to a player without the chapter');
  // And the pilot house has nothing on its table but price tags.
  await page.goto(`${BASE}/#ranges`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  const shelved = await page.$$eval('.rung-row.on-shelf', (n) => n.length);
  if (shelved !== 7) throw new Error(`expected seven charts on the shelf, found ${shelved}`);
});

await step('pearls buy a chapter, and the chapter opens', async () => {
  await seedFresh({ economy: { version: 1, pearls: 75, earned: 75, spent: 0, owned: ['lesson:hand-rankings'] } });
  await page.goto(`${BASE}/#store`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.shelf-row', { timeout: 5000 });
  const chip = await page.textContent('#topbar .pearl-chip');
  if (!/75/.test(chip)) throw new Error(`the rail does not show the purse: ${chip}`);
  const row = await page.$('.shelf-row:has-text("Pot Odds") .buy-btn');
  if (!row) throw new Error('Pot Odds cannot be bought with 75 pearls in the purse');
  await row.click();
  await page.waitForTimeout(300);
  const purse = await page.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).economy);
  if (purse.pearls !== 15 || !purse.owned.includes('lesson:pot-odds')) throw new Error(`the purchase went wrong: ${JSON.stringify(purse)}`);
  await page.goto(`${BASE}/#drill?module=pot-odds`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  if (await page.$('.on-shelf')) throw new Error('the bought chapter is still on the shelf');
  if (!await page.$('.question')) throw new Error('the bought chapter asks no questions');
  // What the rank does not allow yet cannot be bought at any price.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1'));
    raw.economy.pearls = 5000;
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#store`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.shelf-row', { timeout: 5000 });
  if (await page.$('.shelf-row:has-text("Tournament ICM") .buy-btn')) throw new Error('a chapter above the rank was for sale');
});

await step('the table is free play: help is asked for, and costs the decision its pearl', async () => {
  await seedFresh({
    walkthroughs: ['hand-rankings', 'pot-odds'],
    economy: { version: 1, pearls: 0, earned: 0, spent: 0, owned: ['lesson:hand-rankings', 'lesson:pot-odds', 'pet:owl'] },
  });
  await page.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.felt', { timeout: 5000 });
  if (await page.$('.coach')) throw new Error('Silas is talking at a free-play table');
  await page.click('button:has-text("Deal me in")');
  await page.waitForSelector('.help-btn:not([disabled])', { timeout: 15000 });
  const tags = await page.$$eval('.seat .style-tag', (n) => n.length);
  if (tags) throw new Error(`${tags} opponents wear their style on their seat without the hound`);
  await page.click('.help-btn');
  await page.waitForSelector('.help-drawer', { timeout: 3000 });
  const help = await page.textContent('.help-drawer');
  if (!/decision/.test(help)) throw new Error('Silas says nothing when asked');
  if (!/Hoot/.test(help)) throw new Error('the owl did not come to the table');
  if (!/Your equity/.test(help)) throw new Error('the owl did not do the sum');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).economy.pearls);
  const act = await page.$('.action-buttons .btn:has-text("Fold")') || await page.$('.action-buttons .btn:has-text("Check")');
  await act.click();
  await page.waitForTimeout(200);
  if (await page.$('.help-drawer')) throw new Error('the help stayed open for the next decision');
  if (await page.$('.verdict-box')) throw new Error('free play graded the decision out loud');
  // Play the hand out, and a few more.
  for (let i = 0, hands = 0; i < 300 && hands < 4; i++) {
    const deal = await page.$('button:has-text("Deal next hand")');
    if (deal) { hands++; await deal.click(); await page.waitForTimeout(100); continue; }
    const next = await page.$('.action-buttons .btn:has-text("Check")') || await page.$('.action-buttons .btn:has-text("Fold")');
    if (next) await next.click().catch(() => {});
    await page.waitForTimeout(120);
  }
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).economy);
  if (after.pearls <= before) throw new Error(`four hands paid nothing: ${before} → ${after.pearls}`);
  console.log(`      the purse went ${before} → ${after.pearls} over the sitting`);
});

await step('getting up leaves Silas\'s notes, folded until they are opened', async () => {
  await page.click('button:has-text("Leave table")');
  await page.waitForFunction(() => /#report/.test(location.hash), null, { timeout: 5000 })
    .catch(() => { throw new Error(`leaving went to ${page.url()}`); });
  await page.waitForSelector('.report-pearls', { timeout: 3000 });
  if (await page.$('.notes')) throw new Error('the notes were open before anybody asked');
  await page.click('.notes-envelope');
  await page.waitForSelector('.notes', { timeout: 3000 });
  const notes = await page.textContent('.notes');
  if (!/Every skill you were tested on/.test(notes)) throw new Error(`the notes judge nothing: ${notes.slice(0, 120)}`);
  if (!/made with help/.test(notes)) throw new Error('the helped decision is not set apart in the notes');
  const kept = await page.evaluate(() => (JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).reports || []).length);
  if (kept !== 1) throw new Error(`expected one set of notes kept, found ${kept}`);
});

await veteran(true);
await page.reload({ waitUntil: 'domcontentloaded' });

await step('the boatyard sells a bigger boat, and it takes more of the crew to the table', async () => {
  // The reader asked whether better boats could be bought. They can, with
  // pearls — and a bigger one carries more companions, so the owl and the
  // cat both come to the table instead of one of them waiting at the landing.
  await seedFresh({
    bankroll: 400,
    walkthroughs: ['pot-odds', 'preflop'],
    career: { venue: 'nl5', best: 'nl5', busted: 0, staked: 0, beaten: [] },
    economy: {
      version: 3, pearls: 400, earned: 400, spent: 0, boat: 'rowboat', crew: ['owl', 'cat'],
      owned: ['lesson:hand-rankings', 'lesson:pot-odds', 'lesson:preflop', 'pet:owl', 'pet:cat'],
    },
  });
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const sign = await page.$('.map-place.place-boatyard');
  if (!sign) throw new Error('there is no boatyard on the map');
  if (!/can-buy/.test(await sign.getAttribute('class'))) throw new Error('the boatyard sign does not light up for a purse that can buy a boat');
  await sign.click();
  await page.waitForTimeout(500);
  if (!/#boatyard/.test(page.url())) throw new Error(`the boatyard sign went to ${page.url()}`);
  const before = await page.evaluate(() => ({
    aboard: document.querySelectorAll('.crew-row.aboard').length,
    ashore: document.querySelectorAll('.crew-row.ashore').length,
    sailing: document.querySelector('.yard-boat.sailing .yard-boat-title')?.textContent || '',
  }));
  if (before.aboard !== 1 || before.ashore !== 1) throw new Error(`a rowboat has ${before.aboard} aboard and ${before.ashore} ashore, expected 1 and 1`);
  if (!/rowboat/.test(before.sailing)) throw new Error(`sailing ${before.sailing} before buying anything`);
  // Nothing on the shelves only for show: every fitting does something.
  const fittings = await page.$$eval('.yard-upgrade', (n) => n.map((x) => x.textContent));
  if (fittings.length !== 2 || fittings.some((f) => /paint|flag|lantern/i.test(f))) throw new Error(`the fittings shelf holds: ${fittings.join(' | ')}`);

  // The launch is sold only further down the river than Fisher's Rest.
  const launch = await page.$('.yard-boat:has-text("A steam launch") .buy-btn');
  if (launch) throw new Error('the launch is for sale to somebody who has only reached Fisher\'s Rest');
  await page.click('.yard-boat:has-text("A sailing skiff") .buy-btn');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({
    aboard: document.querySelectorAll('.crew-row.aboard').length,
    sailing: document.querySelector('.yard-boat.sailing .yard-boat-title')?.textContent || '',
    saved: JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).economy,
    bankroll: JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).bankroll,
  }));
  if (!/skiff/.test(after.sailing)) throw new Error(`bought the skiff but sailing ${after.sailing}`);
  if (after.aboard !== 2) throw new Error(`${after.aboard} aboard the skiff, expected both companions`);
  if (after.saved.pearls !== 250) throw new Error(`the purse holds ${after.saved.pearls} after a 150-pearl skiff, expected 250`);
  if (after.bankroll !== 400) throw new Error(`the bankroll moved to ${after.bankroll}: boats are paid in pearls`);

  // Both of them are at the table now.
  await page.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.companion-tray', { timeout: 5000 });
  const pets = await page.$$eval('.tray-pet:not(.empty)', (n) => n.length);
  if (pets !== 2) throw new Error(`${pets} companions at the table, expected the two aboard`);
  // And every opponent carries a bounty you can see, the way the keys sit on
  // the players in Governor of Poker.
  const bounties = await page.$$eval('.seat:not(.hero) .seat-bounty', (n) => n.map((x) => x.textContent.trim()));
  if (bounties.length !== 5 || bounties.some((b) => b !== '5')) throw new Error(`the practice table's bounties read: ${bounties.join(', ')}`);

  // And the river shows the boat you sail, with its crew.
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const card = await page.evaluate(() => ({
    name: document.querySelector('.boat-card .boat-name')?.textContent || '',
    faces: document.querySelectorAll('.boat-card .berth.taken').length,
  }));
  if (!/skiff/.test(card.name) || card.faces !== 2) throw new Error(`the river shows ${card.name} with ${card.faces} aboard`);
});

await step('on a phone, the cards under the map stack in order and scroll with the page', async () => {
  // Reported from a phone: scrolling past the map, the boat card slid over
  // the card for the stop you are moored at. The boat's column had kept a
  // rule from the old layout that pinned it while the page scrolled, and
  // put it above the stop's card. And an empty berth drew as a tall oval.
  await page.setViewportSize({ width: 390, height: 844 });
  try {
    await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const below = await page.evaluate(() => {
      const top = (sel) => document.querySelector(sel).getBoundingClientRect().top + window.scrollY;
      const pinned = [...document.querySelectorAll('.river-below, .river-below *')]
        .filter((n) => ['sticky', 'fixed'].includes(getComputedStyle(n).position)).map((n) => n.className);
      const ring = document.querySelector('.boat-card .berth.open, .boat-card .berth.taken').getBoundingClientRect();
      return { here: top('.here-card'), boat: top('.boat-card'), study: top('.study-line'), pinned, ring: [ring.width, ring.height] };
    });
    if (below.pinned.length) throw new Error(`pinned under the map: ${below.pinned.join(', ')}`);
    if (!(below.here < below.boat && below.boat < below.study)) {
      throw new Error(`the cards stack out of order: stop at ${below.here}, boat at ${below.boat}, study line at ${below.study}`);
    }
    if (Math.abs(below.ring[0] - below.ring[1]) > 1) throw new Error(`a berth draws ${below.ring[0]} by ${below.ring[1]}, not round`);
  } finally {
    await page.setViewportSize({ width: 1280, height: 900 });
  }
});

await step('the Catch Book is on the map, and a spot played right lands its fish', async () => {
  // Start from an empty book, so the first catch is a first.
  await page.evaluate(async () => {
    const { Profile } = await import('/src/js/state/profile.js');
    const p = Profile.load();
    p.data.catchBook = {};
    p.save();
  });
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.map-place.place-tackle', { timeout: 5000 });
  const plate = (await page.textContent('.map-place.place-tackle')).replace(/\s+/g, ' ').trim();
  if (!/0 of 13 fish caught/.test(plate)) throw new Error(`the map plate reads "${plate}"`);
  await page.click('.map-place.place-tackle');
  await page.waitForSelector('.catchbook', { timeout: 5000 });
  const cards = await page.$$eval('.catch-card', (n) => n.length);
  const shadows = await page.$$eval('.catch-card .fish-art.unknown', (n) => n.length);
  if (cards !== 13 || shadows !== 13) throw new Error(`${cards} pages, ${shadows} of them shadows, in an empty book`);
  const waters = await page.$$eval('.catch-water h2', (n) => n.map((x) => x.textContent.trim()));
  if (waters.join('|') !== 'The Shallows|The Channel|Deep Water|The Delta|Legends') throw new Error(`waters: ${waters}`);

  // Fold rubbish under the gun at the practice table until a good fold
  // lands a Patient Minnow.
  await page.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.felt', { timeout: 5000 });
  await page.click('button:has-text("Deal me in")');
  const book = () => page.evaluate(async () => {
    const { Profile } = await import('/src/js/state/profile.js');
    return Profile.load().data.catchBook;
  });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline && !(await book()).minnow) {
    const bar = await page.textContent('.action-bar').catch(() => '');
    if (/Deal next hand/.test(bar)) { await page.click('button:has-text("Deal next hand")').catch(() => {}); await page.waitForTimeout(250); continue; }
    if (/out of chips/i.test(bar)) { const b = await page.$('.action-bar .btn.primary'); if (b) await b.click().catch(() => {}); continue; }
    const band = await page.$('.read-bands .btn');
    if (band) { await band.click().catch(() => {}); continue; }
    const btn = (await page.$('.action-buttons .btn.danger')) || (await page.$('.action-buttons .btn.success'));
    if (btn) await btn.click().catch(() => {});
    await page.waitForTimeout(200);
  }
  const caught = await book();
  if (!caught.minnow) throw new Error('a minute and a half of good folds landed no minnow');
  if (!(caught.minnow.best >= 0.5) || caught.minnow.where !== 'The Saloon') throw new Error(`the catch was logged wrong: ${JSON.stringify(caught.minnow)}`);

  await page.goto(`${BASE}/#catchbook`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.catch-card.caught', { timeout: 5000 });
  const name = (await page.textContent('.catch-card.caught .catch-name-text')).trim();
  if (name !== 'Patient Minnow') throw new Error(`the book shows ${name} as caught`);
  console.log(`      13 shadows in an empty book; a good fold landed a ${caught.minnow.best} lb minnow, and the book shows it`);
});

await step('the lessons and the charts are places on the map, and there are no tabs', async () => {
  // The reader asked for the lessons and the ranges to be part of the map
  // rather than two tabs. The school is School Creek, with every chapter a
  // stop on the water; the pilot house is a channel with every chart a mark
  // on it; each runs out into the Long River, and the rail's crest is the
  // way back from anywhere.
  if (await page.$('.dock, .dock-item')) throw new Error('the tabs are still there');
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.click('.map-place.place-school');
  await page.waitForTimeout(500);
  const creek = await page.evaluate(() => ({
    route: location.hash,
    stops: document.querySelectorAll('.creek-trail > .trail-stop').length,
    water: document.querySelectorAll('.creek-trail > .trail-stop > .creek-bend').length,
    head: !!document.querySelector('.creek-head .creek-spring'),
    mouth: !!document.querySelector('.creek-mouth .creek-home'),
    back: document.querySelector('#topbar .crest.back')?.textContent || '',
  }));
  if (!/#train/.test(creek.route)) throw new Error(`the school sign went to ${creek.route}`);
  if (creek.stops !== 12 || creek.water !== 12) throw new Error(`${creek.stops} chapters and ${creek.water} bends of water on the creek, expected 12 of each`);
  if (!creek.head || !creek.mouth) throw new Error('the creek has no spring or no mouth');
  if (!/river/i.test(creek.back)) throw new Error(`the rail offers no way back to the river: "${creek.back}"`);
  await page.click('.creek-home');
  await page.waitForTimeout(400);
  if (!/#home/.test(page.url())) throw new Error(`the creek's mouth went to ${page.url()}`);

  await page.click('.map-place.place-pilothouse');
  await page.waitForTimeout(500);
  const channel = await page.evaluate(() => ({
    route: location.hash,
    marks: document.querySelectorAll('.creek-trail > .channel-stop .rung-row').length,
    water: document.querySelectorAll('.creek-trail > .channel-stop > .creek-bend').length,
  }));
  if (!/#ranges/.test(channel.route)) throw new Error(`the pilot house sign went to ${channel.route}`);
  if (channel.marks !== 8 || channel.water !== 8) throw new Error(`${channel.marks} charts and ${channel.water} bends on the channel, expected 8 of each`);
  await page.click('#topbar .crest');
  await page.waitForTimeout(400);
  if (!/#home/.test(page.url())) throw new Error(`the crest went to ${page.url()}`);
});

await step('the music has three styles, picked in the ledger, soft by default', async () => {
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.click('.ledger-button');
  await page.waitForTimeout(250);
  const musicSwitch = page.locator('.switch', { hasText: 'Music' });
  const wasOn = (await musicSwitch.getAttribute('aria-checked')) === 'true';
  if (!wasOn) { await musicSwitch.click(); await page.waitForTimeout(200); }
  const names = await page.$$eval('.music-style-name', (n) => n.map((x) => x.textContent.trim()));
  if (names.join('|') !== 'Soft piano|Honky-tonk|Calm water') throw new Error(`styles offered: ${names}`);
  const style = () => page.evaluate(async () => {
    const { Profile } = await import('/src/js/state/profile.js');
    const { audioState } = await import('/src/js/audio/engine.js');
    return { saved: Profile.load().settings.musicStyle, engine: audioState().style,
      checked: document.querySelector('.music-style[aria-checked="true"] .music-style-name').textContent };
  });
  const before = await style();
  if (before.checked !== 'Soft piano' || before.engine !== 'soft') throw new Error(`default is not the soft piano: ${JSON.stringify(before)}`);
  await page.click('.music-style:has-text("Honky-tonk")');
  await page.waitForTimeout(200);
  const after = await style();
  if (after.saved !== 'honky' || after.engine !== 'honky' || after.checked !== 'Honky-tonk') {
    throw new Error(`picking the upright did not take: ${JSON.stringify(after)}`);
  }
  await page.click('.music-style:has-text("Soft piano")');
  await page.waitForTimeout(200);
  // With the music off there is nothing to pick a style for.
  await page.locator('.switch', { hasText: 'Music' }).click();
  await page.waitForTimeout(200);
  if (await page.$('.music-styles')) throw new Error('the style picker stays with the music off');
  if (wasOn) { await page.locator('.switch', { hasText: 'Music' }).click(); await page.waitForTimeout(200); }
  await page.keyboard.press('Escape');
  console.log(`      offered ${names.join(', ')}; the choice is saved and reaches the engine`);
});

await step('the language switch turns the whole app Dutch and persists', async () => {
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const englishBack = (await page.textContent('#topbar .crest')).trim();
  if (!/The river/.test(englishBack)) throw new Error(`expected the way back to read "The river", got ${englishBack}`);

  await page.click('.ledger-button');
  await page.waitForTimeout(250);
  const englishNav = await page.$$eval('.ledger-item .ledger-label', (n) => n.map((x) => x.textContent.trim()));
  if (!englishNav.includes('Lessons')) throw new Error(`expected English nav, got ${englishNav}`);
  await page.click('.lang-chip:not(.active)');
  await page.waitForTimeout(400);

  const dutchNav = await page.$$eval('.ledger-item .ledger-label', (n) => n.map((x) => x.textContent.trim()));
  if (!dutchNav.includes('Lessen')) throw new Error(`nav did not switch: ${dutchNav}`);
  const dutchBack = (await page.textContent('#topbar .crest')).trim();
  if (!/De rivier/.test(dutchBack)) throw new Error(`the way back is still English: ${dutchBack}`);
  const ledger = await page.textContent('.ledger');
  if (!/Instellingen/.test(ledger) || !/Muziek/.test(ledger)) throw new Error('the ledger is still English');
  await page.keyboard.press('Escape');

  // A lesson is the real test: it is the largest body of text in the app.
  await page.goto(`${BASE}/#walkthrough?module=pot-odds`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const lesson = await page.textContent('.lesson-body');
  if (!/pot odds/i.test(lesson) && !/prijs/i.test(lesson)) {
    throw new Error('lesson body looks wrong');
  }
  if (/What question are we actually asking/.test(await page.textContent('body'))) {
    throw new Error('the lesson is still rendering English');
  }

  // Poker vocabulary must survive the switch untranslated.
  const glossaryText = await (async () => {
    await page.goto(`${BASE}/#glossary`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    return page.textContent('body');
  })();
  for (const term of ['Flush draw', 'Gutshot', 'Pot odds']) {
    if (!glossaryText.includes(term)) throw new Error(`jargon "${term}" was translated away`);
  }

  // And it survives a reload, because it lives in the profile.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.click('.ledger-button');
  await page.waitForTimeout(250);
  const stillDutch = await page.$eval('.lang-chip.active', (n) => n.textContent);
  if (!/NL/.test(stillDutch)) throw new Error(`language did not persist: ${stillDutch}`);

  // Put it back so later steps see the app they expect.
  await page.click('.lang-chip:not(.active)');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
});

await step('no screen is half in English when the app is in Dutch', async () => {
  // Rendered twice, once per language, and compared. Checking the Dutch text
  // against the translation table would answer the wrong question: once a
  // string is translated the reader never sees the English, so what matters
  // is text that comes out the same in both — which is text that never
  // reached t(). Randomly dealt content differs between renders anyway, so
  // what this actually measures is the fixed chrome of every screen.
  const routes = [
    '#home', '#stop?at=nl10', '#stop?at=nl50', '#train', '#learn?module=pot-odds', '#boatyard',
    '#lab-run', '#review', '#charts?chart=BTN', '#glossary', '#stats',
    '#levels', '#gauntlet', '#drill?module=outs', '#walkthrough?module=pot-odds',
    '#ranges', '#ranges-run', '#ranges-weak', '#store', '#report',
  ];

  // domcontentloaded rather than networkidle: the app fires an update check
  // at raw.githubusercontent.com on every load, and in a sandbox without
  // egress that request never settles.
  const textOf = async (route, lang) => {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (code) => {
      const i18n = await import('/src/js/i18n/index.js');
      const { Profile } = await import('/src/js/state/profile.js');
      i18n.setLang(code);
      Profile.load().updateSettings({ lang: code });
    }, lang);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    // Render once more with t() recording, so the check can tell a line that
    // was never translated from one deliberately left as it is.
    await page.evaluate(async (target) => {
      const i18n = await import('/src/js/i18n/index.js');
      const keys = new Set();
      i18n.recordKeys(keys);
      location.hash = '#glossary';
      await new Promise((r) => setTimeout(r, 120));
      location.hash = target;
      await new Promise((r) => setTimeout(r, 220));
      i18n.recordKeys(null);
      window.__keys = [...keys];
    }, route);
    return page.evaluate(() => {
      const seen = new Set();
      for (const node of document.querySelectorAll('#screen *')) {
        // A glossary chip is a word lifted out of a sentence this check
        // already covers, and the jargon inside it is deliberately English in
        // both languages. Reading it as a line of its own would report "pot
        // odds" as untranslated every time the auto-linker marks one.
        if (node.classList.contains('term')) continue;
        for (const child of node.childNodes) {
          if (child.nodeType !== 3) continue;
          const text = child.textContent.trim();
          if (text) seen.add(text);
        }
      }
      return [...seen];
    });
  };

  const untranslated = [];
  for (const route of routes) {
    const en = await textOf(route, 'en');
    const nl = new Set(await textOf(route, 'nl'));
    const same = en.filter((text) => nl.has(text));
    const suspects = await page.evaluate(async (list) => {
      const i18n = await import('/src/js/i18n/index.js');
      const { NL } = await import('/src/js/i18n/nl.js');
      // Some text is deliberately the same in both languages — rank names,
      // "Call", "Pot Odds" — and some of it arrives already stitched to an
      // emoji or a number, so looking the whole line up in the table says
      // nothing. window.__keys holds what t() was actually asked for during
      // this render, so a line explained by a translated key is finished.
      const settled = (window.__keys || [])
        .filter((key) => NL[key])
        .map((key) => new RegExp(`^${key
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\\\{\w+\\\}/g, '[\\s\\S]*?')}`));
      return list.filter((text) => i18n.needsTranslation(text)
        && !i18n.KEEP_ENGLISH.has(text)
        && !NL[text]
        && /[a-z]{3}/.test(text)
        && /\s/.test(text)                // single words are usually jargon or data
        && !settled.some((re) => re.test(text)));
    }, same);
    if (suspects.length) untranslated.push(`${route}: ${suspects.slice(0, 6).join(' | ')}`);
  }

  await page.evaluate(async () => {
    const i18n = await import('/src/js/i18n/index.js');
    const { Profile } = await import('/src/js/state/profile.js');
    i18n.setLang('en');
    Profile.load().updateSettings({ lang: 'en' });
  });

  if (untranslated.length) {
    throw new Error(`English left on ${untranslated.length} screen(s):\n      ${untranslated.join('\n      ')}`);
  }
  console.log(`      ${routes.length} screens checked in both languages`);
});

await step('the table is playable on an iPad on its side, a phone, and a phone on its side', async () => {
  // A reader on an iPad in landscape (about 1000 x 585 under Safari's bars)
  // got a felt 290px across with the seat plates piled on top of each other:
  // the felt was shrunk to fit the height and the plates were not. These are
  // the screens a table has to work on, checked with a hand dealt.
  const report = [];
  for (const [w, h] of [[1000, 585], [1180, 740], [390, 844], [844, 340]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.felt', { timeout: 5000 });
    await page.click('button:has-text("Deal me in")');
    await page.waitForSelector('.action-buttons button', { timeout: 20000 });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const felt = document.querySelector('.felt').getBoundingClientRect();
      const plates = [...document.querySelectorAll('.seat .seat-plate')].map((n) => n.getBoundingClientRect());
      let hits = 0;
      for (let i = 0; i < plates.length; i++) {
        for (let j = i + 1; j < plates.length; j++) {
          const a = plates[i];
          const b = plates[j];
          if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) hits++;
        }
      }
      const fold = document.querySelector('.action-buttons .btn.danger, .action-buttons button').getBoundingClientRect();
      return { feltW: Math.round(felt.width), hits, foldOnScreen: fold.bottom <= innerHeight && fold.top >= 0 };
    });
    report.push(`${w}x${h}: felt ${m.feltW}px`);
    if (m.hits) throw new Error(`${m.hits} seat plates on top of each other at ${w}x${h}`);
    if (m.feltW < (w > 700 ? 420 : 300)) throw new Error(`the felt is ${m.feltW}px across at ${w}x${h}`);
    if (!m.foldOnScreen) throw new Error(`the buttons are off the screen at ${w}x${h}`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  console.log(`      ${report.join(', ')}; no plates overlap, the buttons in view`);
});

await step('the table deals the next hand by itself, and a switch turns that off', async () => {
  // At a table you are playing, the next hand comes out on its own after a
  // beat to see how the last one ended. It ships on, it can be switched off
  // right where the Deal button is, and the choice is kept.
  await veteran(false);
  await page.evaluate(() => {
    localStorage.setItem('e2e.autodeal', '1');
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.settings = { ...(raw.settings || {}), liveCoach: false };
    delete raw.settings.autoDeal;           // a save from before the switch existed
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.felt', { timeout: 5000 });

  const bar = () => page.textContent('.action-bar').then((x) => x.replace(/\s+/g, ' ').trim()).catch(() => '');
  const chip = () => page.$eval('.auto-deal-chip', (n) => ({ text: n.textContent.trim(), on: n.getAttribute('aria-checked') }));
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).settings.autoDeal);
  const playToEnd = async () => {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      if (/Deal next hand/.test(await bar())) return;
      if (/out of chips/i.test(await bar())) {
        const topUp = await page.$('.action-bar .btn.primary');
        if (topUp) await topUp.click().catch(() => {});
        continue;
      }
      const band = await page.$('.read-bands .btn');
      if (band) { await band.click().catch(() => {}); continue; }
      const btn = (await page.$('.action-buttons .btn.danger'))
        || (await page.$('.action-buttons .btn:not(.primary):not(.danger)'));
      if (btn) await btn.click().catch(() => {});
      await page.waitForTimeout(150);
    }
    throw new Error('a hand never finished');
  };
  const dealtByItself = async (ms) => {
    const t0 = Date.now();
    while (/Deal next hand/.test(await bar()) && Date.now() - t0 < ms) await page.waitForTimeout(100);
    return { dealt: !/Deal next hand/.test(await bar()), after: Date.now() - t0 };
  };

  // On for a save that never had the switch, and the first hand is still yours to ask for.
  const first = await chip();
  if (first.on !== 'true' || !/on/.test(first.text)) throw new Error(`the switch is not on by default: ${JSON.stringify(first)}`);
  if (!/Deal me in/.test(await bar())) throw new Error('the first hand was not left to the player');
  await page.click('button:has-text("Deal me in")');

  // A hand ends: the count runs, the button fills, and the next hand comes by itself.
  await playToEnd();
  const note = await page.$eval('.auto-deal-count', (n) => n.textContent);
  if (!/Next hand in \d+s/.test(note)) throw new Error(`the countdown reads "${note}"`);
  if (!(await page.$('.deal-button.counting .deal-fill'))) throw new Error('the Deal button does not fill as it counts');
  const auto = await dealtByItself(9000);
  if (!auto.dealt) throw new Error('nine seconds after the hand, the next one had not been dealt');
  if (auto.after < 1000) throw new Error(`the next hand came after ${auto.after}ms, before the result could be read`);

  // Switched off during the countdown, nothing is dealt however long we wait.
  await playToEnd();
  await page.click('.auto-deal-chip');
  const off = await chip();
  if (off.on !== 'false' || !/off/.test(off.text)) throw new Error(`the switch did not turn off: ${JSON.stringify(off)}`);
  if (await page.$('.auto-deal-count')) throw new Error('the countdown kept running after the switch was turned off');
  await page.waitForTimeout(5000);
  if (!/Deal next hand/.test(await bar())) throw new Error('a hand was dealt with auto-deal switched off');
  if ((await saved()) !== false) throw new Error('turning it off was not saved');

  // Switched back on between hands, it starts counting at once.
  await page.click('.auto-deal-chip');
  if (!(await page.$('.auto-deal-count'))) throw new Error('turning it on between hands did not start the countdown');
  const again = await dealtByItself(9000);
  if (!again.dealt) throw new Error('the next hand was not dealt after turning auto-deal back on');

  // Off, and kept: a reload still has it off, on the bar before the first hand.
  await playToEnd();
  await page.click('.auto-deal-chip');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auto-deal-chip', { timeout: 5000 });
  const kept = await chip();
  if (kept.on !== 'false') throw new Error(`the choice was not kept across a reload: ${JSON.stringify(kept)}`);

  // A lesson table is a chapter, not a game: no switch, nothing dealt for you.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#play?lesson=hand-rankings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.felt', { timeout: 5000 });
  if (await page.$('.auto-deal-chip')) throw new Error('a lesson table offers auto-deal');

  // Back to the way every other step runs: by hand.
  await page.evaluate(() => {
    localStorage.setItem('e2e.autodeal', '0');
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.settings = { ...(raw.settings || {}), autoDeal: false };
    delete raw.settings.liveCoach;          // the veteran seeding puts Silas back
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await veteran(true);
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log(`      on by default; the next hand came after ${auto.after}ms; off stays off for 5s; back on deals again; the choice survives a reload`);
});

await step('the practice table can be dealt for you against one, or against two', async () => {
  // Free play was always six-handed. It can be dealt for a heads-up game or a
  // three-handed one now, the other players sit round the oval rather than on
  // one side of it, and the choice is kept when the game is switched.
  await veteran(false);
  await page.evaluate(() => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.settings = { ...(raw.settings || {}), liveCoach: false };
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.size-switch', { timeout: 5000 });

  const look = () => page.evaluate(() => {
    const plates = [...document.querySelectorAll('.seat .seat-plate')].map((n) => n.getBoundingClientRect());
    let hits = 0;
    for (let i = 0; i < plates.length; i++) {
      for (let j = i + 1; j < plates.length; j++) {
        const a = plates[i];
        const b = plates[j];
        if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) hits++;
      }
    }
    return {
      seats: document.querySelectorAll('.seat').length,
      slots: [...document.querySelectorAll('.seat')].map((n) => n.dataset.slot).join(','),
      pressed: [...document.querySelectorAll('.size-switch .btn[aria-pressed="true"]')].map((n) => n.getAttribute('aria-label')).join(),
      badge: document.querySelector('.scene-stake').textContent.trim(),
      hits,
    };
  });

  const names = await page.$$eval('.size-switch .btn', (n) => n.map((x) => x.getAttribute('aria-label')));
  if (names.join('|') !== 'Full table|3 players|Heads-up') throw new Error(`sizes offered: ${names}`);
  const full = await look();
  if (full.seats !== 6 || full.pressed !== 'Full table') throw new Error(`the default is not a full table: ${JSON.stringify(full)}`);

  await page.click('.size-switch .btn[aria-label="Heads-up"]');
  await page.waitForSelector('.seat', { timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll('.seat').length === 2, null, { timeout: 5000 });
  const headsUp = await look();
  if (headsUp.slots !== '0,3') throw new Error(`heads-up is not you against somebody straight across: ${JSON.stringify(headsUp)}`);
  if (headsUp.pressed !== 'Heads-up' || !/Heads-up/.test(headsUp.badge)) throw new Error(`the table does not say it is heads-up: ${JSON.stringify(headsUp)}`);

  // A hand is dealt and can be played to the end.
  await page.click('button:has-text("Deal me in")');
  await page.waitForSelector('.action-buttons button', { timeout: 20000 });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (/Deal next hand/.test(await page.textContent('.action-bar'))) break;
    const btn = (await page.$('.action-buttons .btn.success'))
      || (await page.$('.action-buttons .btn:not(.primary):not(.danger)'))
      || (await page.$('.action-buttons .btn.danger'));
    if (btn) await btn.click().catch(() => {});
    await page.waitForTimeout(150);
  }
  if (!/Deal next hand/.test(await page.textContent('.action-bar'))) throw new Error('a heads-up hand never finished');
  const line = await page.textContent('.action-bar');
  if (/won 0 chips|lost 0 chips/.test(line)) throw new Error(`a hand that came to nothing says "${line.replace(/\s+/g, ' ').trim().slice(0, 100)}"`);

  // Three-handed: either side of the top. The game switch keeps the size.
  await page.click('.size-switch .btn[aria-label="3 players"]');
  await page.waitForFunction(() => document.querySelectorAll('.seat').length === 3, null, { timeout: 5000 });
  const three = await look();
  if (three.slots !== '0,2,4') throw new Error(`three-handed seats are at ${three.slots}`);
  if (three.hits) throw new Error(`${three.hits} seat plates on top of each other three-handed`);
  await page.click('button.btn.sm:has-text("PLO")');
  await page.waitForFunction(() => document.querySelectorAll('.seat').length === 3, null, { timeout: 5000 });
  await page.click('button:has-text("Deal me in")');
  await page.waitForSelector('.action-buttons button', { timeout: 20000 });
  const plo = await page.$$eval('.seat.hero .card', (n) => n.length);
  if (plo !== 4) throw new Error(`switching to PLO dropped the table size or the game: ${plo} cards`);

  // A lesson table that is heads-up draws the same way.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#play?lesson=hand-rankings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.felt', { timeout: 5000 });
  const lesson = await look();
  if (lesson.slots !== '0,3') throw new Error(`a heads-up lesson table seats them at ${lesson.slots}`);
  if (await page.$('.size-switch')) throw new Error('a lesson table offers a table size');

  // On a phone the chips say 6 / 3 / HU, and the buttons are still on screen.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#play?seats=3`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.size-switch', { timeout: 5000 });
  const short = await page.$$eval('.size-switch .btn', (n) => n.map((x) => {
    const visible = (el) => getComputedStyle(el).display !== 'none';
    return [...x.children].filter(visible).map((c) => c.textContent).join('');
  }));
  if (short.join('|') !== '6|3|HU') throw new Error(`phone chips read ${short}`);
  await page.click('button:has-text("Deal me in")');
  await page.waitForSelector('.action-buttons button', { timeout: 20000 });
  const fold = await page.$eval('.action-buttons button', (n) => n.getBoundingClientRect().bottom <= innerHeight);
  if (!fold) throw new Error('on a phone the buttons are off the screen with the size chips in the header');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.settings = { ...(raw.settings || {}) };
    delete raw.settings.liveCoach;          // the veteran seeding puts Silas back
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await veteran(true);
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log('      full table by default; heads-up 0,3 and three-handed 0,2,4; PLO keeps the size; chips read 6/3/HU on a phone');
});

await step('the road says what to do next, a city at a time', async () => {
  // A player with nothing done, in a browser of their own so the veteran the
  // other steps run as is left alone. The road is a short list per city: the
  // map points at the next thing, every later city is shut with the name of
  // the one that opens it, and finishing a city opens the next.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const fresh = await ctx.newPage();
  fresh.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  fresh.on('console', (m) => { if (m.type() === 'error' && !/raw\.githubusercontent|ERR_CONNECTION|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const text = async (sel) => (await fresh.textContent(sel).catch(() => '') || '').replace(/\s+/g, ' ').trim();
  const seed = (patch) => fresh.evaluate((p) => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...raw, ...p, settings: { ...(raw.settings || {}), sound: false, music: false, ...(p.settings || {}) } }));
  }, patch);
  try {
    await fresh.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await seed({ settings: { autoDeal: false } });
    await fresh.reload({ waitUntil: 'domcontentloaded' });
    await fresh.waitForSelector('.prologue', { timeout: 5000 });
    if (!/a city at a time/.test(await text('.prologue'))) throw new Error('the prologue does not say how the river is travelled');
    await fresh.click('.prologue .btn');
    await fresh.waitForSelector('.road-banner', { timeout: 5000 });

    // The banner: the city, how far through, and the one thing to do.
    const banner = await text('.road-banner');
    if (!/Mud Landing/.test(banner) || !/0 \/ 4/.test(banner)) throw new Error(`the banner reads "${banner}"`);
    if (!/Read the Hand Rankings lesson/.test(banner)) throw new Error(`the first thing is not Hand Rankings: "${banner}"`);

    // The map: the school is next, and every city after the first is shut and says what opens it.
    const next = await fresh.$$eval('.map-stop.is-next, .map-place.is-next', (n) => n.map((x) => x.textContent.trim()));
    if (next.length !== 1 || !/Silas/.test(next[0]) || !/Next/.test(next[0])) throw new Error(`what is next on the map: ${JSON.stringify(next)}`);
    const locked = await fresh.$$eval('.map-stop.is-locked', (n) => n.map((x) => x.querySelector('.map-status').textContent.trim()));
    if (locked.length !== 7) throw new Error(`${locked.length} cities shut on a new player's map, expected 7`);
    if (locked[0] !== "After Mud Landing" || locked[1] !== "After Fisher's Rest") throw new Error(`the shut cities say: ${locked}`);
    const here = await text('.map-stop.is-here');
    if (!/Mud Landing/.test(here)) throw new Error(`you are not at the first city: ${here}`);

    // The list under the map: four things here, the first is the one to do, the hard ones say why.
    const goals = await fresh.$$eval('.road-panel .road-list > .road-goals .road-goal', (n) => n.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    if (goals.length !== 4) throw new Error(`${goals.length} things to do in the first city: ${goals.join(' | ')}`);
    if (!/Pot Odds/.test(goals[1]) || !/Costs 60 pearls/.test(goals[1])) throw new Error(`the second lesson does not say it costs pearls: ${goals[1]}`);
    if (!/0 of 25/.test(goals[2])) throw new Error(`hands at the table do not start at 0 of 25: ${goals[2]}`);

    // The banner's button goes where it says.
    await fresh.click('.road-banner .btn');
    await fresh.waitForFunction(() => /walkthrough/.test(location.hash), null, { timeout: 5000 });
    if (!/module=hand-rankings/.test(await fresh.evaluate(() => location.hash))) throw new Error('the banner went somewhere other than Hand Rankings');

    // A shut city says so on its own screen, and offers no way in.
    await fresh.goto(`${BASE}/#stop?at=nl5`, { waitUntil: 'domcontentloaded' });
    await fresh.waitForSelector('.road-stop', { timeout: 5000 });
    const shut = await text('.stop-actions');
    if (!/opens when Mud Landing is finished/.test(shut)) throw new Error(`a shut city says: ${shut}`);
    if (await fresh.$('.stop-actions .btn:has-text("Steam down")')) throw new Error('a shut city offers a way in');
    if (await fresh.$('.road-stop .road-goal .btn')) throw new Error('a shut city has buttons on its list');

    // Playing at the table counts, hand by hand.
    await fresh.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await fresh.waitForSelector('.here-actions .btn.primary', { timeout: 5000 });
    await fresh.click('.here-actions .btn.primary');
    await fresh.waitForSelector('.felt', { timeout: 5000 });
    await fresh.click('button:has-text("Deal me in")');
    let finished = 0;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline && finished < 2) {
      const bar = (await fresh.textContent('.action-bar').catch(() => '')) || '';
      if (/Deal next hand/.test(bar)) {
        finished++;
        if (finished >= 2) break;
        await fresh.click('button:has-text("Deal next hand")');
        continue;
      }
      const btn = (await fresh.$('.action-buttons .btn.danger'))
        || (await fresh.$('.action-buttons .btn:not(.primary):not(.danger)'));
      if (btn) await btn.click().catch(() => {});
      await fresh.waitForTimeout(150);
    }
    const played = await fresh.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).career.played);
    if (played.nl2 !== 2) throw new Error(`two hands at Mud Landing were counted as ${JSON.stringify(played)}`);

    // Finish the first city and the second opens, the third stays shut.
    await fresh.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await fresh.waitForSelector('.road-banner', { timeout: 5000 });
    await seed({
      walkthroughs: ['hand-rankings', 'pot-odds'],
      economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: ['lesson:hand-rankings', 'lesson:pot-odds'] },
      career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: ['nl2'], played: { nl2: 30 } },
    });
    await fresh.reload({ waitUntil: 'domcontentloaded' });
    await fresh.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await fresh.waitForSelector('.road-banner', { timeout: 5000 });
    const second = await text('.road-banner');
    if (!/Fisher's Rest/.test(second)) throw new Error(`with the first city finished the banner still reads "${second}"`);
    const after = await fresh.$$eval('.map-stop.is-locked', (n) => n.map((x) => x.querySelector('.map-name').textContent.trim()));
    if (after.length !== 6 || after.includes("Fisher's Rest") || !after.includes('The Ferry')) throw new Error(`after the first city, shut: ${after}`);
    const strip = await fresh.$$eval('.road-node', (n) => n.map((x) => x.className.match(/is-(\w+)/)[1]));
    if (strip.join() !== 'done,current,locked,locked,locked,locked,locked,locked') throw new Error(`the strip reads ${strip}`);

    // Tapping a later city shows what it will ask, without a way in.
    await fresh.click('.road-node:nth-child(3)');
    const ahead = await text('.road-head');
    if (!/The Ferry/.test(ahead) || !/Opens when Fisher's Rest is finished/.test(ahead)) throw new Error(`a city further on reads "${ahead}"`);
    if (await fresh.$('.road-body .road-goal .btn')) throw new Error('a city that is not open has buttons on its list');
    await fresh.click('.road-node:nth-child(1)');
    if (!/Finished/.test(await text('.road-head'))) throw new Error('a city that is done does not say so');

    // And it speaks Dutch.
    await seed({ settings: { lang: 'nl' } });
    await fresh.reload({ waitUntil: 'domcontentloaded' });
    await fresh.waitForSelector('.road-banner', { timeout: 5000 });
    const dutch = await text('.road-banner');
    if (!/De Weg/.test(dutch) || /The Road/.test(dutch)) throw new Error(`the banner in Dutch reads "${dutch}"`);
    const list = await text('.road-panel');
    if (/\b(Read the|Play \d+ hands|Take .* from)\b/.test(list)) throw new Error(`the list is still English in Dutch: ${list.slice(0, 160)}`);
    console.log('      Mud Landing 0 / 4 and Hand Rankings next; seven cities shut with what opens them; the table counts hands; finishing a city opens the next; Dutch');
  } finally {
    await ctx.close();
  }
});

await step('the stop has three tables with numbers, and the Rival sits at one of them and remembers', async () => {
  // Every stop offers three games and says how many players see the flop, how
  // many pots are raised and how big they are; the owner is at one of them.
  // From the second city on a Rival sits at one of the three some visits, and
  // keeps count of how you fold between sittings.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const lob = await ctx.newPage();
  lob.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  lob.on('console', (m) => { if (m.type() === 'error' && !/raw\.githubusercontent|ERR_CONNECTION|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const text = async (sel) => (await lob.textContent(sel).catch(() => '') || '').replace(/\s+/g, ' ').trim();
  const profile = () => lob.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')));
  const seed = (patch) => lob.evaluate((p) => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...raw, ...p, settings: { ...(raw.settings || {}), sound: false, music: false, autoDeal: false, ...(p.settings || {}) } }));
  }, patch);
  const career = (sittings) => ({ venue: 'nl5', best: 'nl5', busted: 0, staked: 0, beaten: ['nl2'], played: { nl2: 40, nl5: 10 }, sittings });
  try {
    await lob.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const { withRival, without } = await lob.evaluate(async () => {
      const m = await import('/src/js/state/lobby.js');
      const stop = (await import('/src/js/data/venues.js')).VENUES[1];
      let withRival = null;
      let without = null;
      for (let s = 0; s < 60 && (withRival === null || without === null); s++) {
        if (m.lobbyFor(stop, s).rival) { if (withRival === null) withRival = s; } else if (without === null) without = s;
      }
      return { withRival, without };
    });
    if (withRival === null || without === null) throw new Error(`no lobby with and without the Rival in sixty sittings: ${withRival} ${without}`);

    // A visit without her: three tables, one with the owner, three numbers on each.
    await seed({ walkthroughs: ['hand-rankings', 'pot-odds'], career: career(without) });
    await lob.reload({ waitUntil: 'domcontentloaded' });
    await lob.goto(`${BASE}/#stop?at=nl5`, { waitUntil: 'domcontentloaded' });
    await lob.waitForSelector('.lobby-card', { timeout: 5000 });
    if ((await lob.$$('.lobby-card')).length !== 3) throw new Error('the lobby is not three tables');
    if ((await lob.$$('.lobby-card.owner')).length !== 1) throw new Error('there is not exactly one owner\'s table');
    const stats = await lob.$$eval('.lobby-card .lobby-stat .v', (n) => n.map((x) => x.textContent.trim()));
    if (stats.length !== 9 || !stats.slice(0, 2).every((v) => /^\d+%$/.test(v)) || !/^\d+ bb$/.test(stats[2])) throw new Error(`the lobby numbers read ${stats}`);
    if (await lob.$('.lobby-tag.rival')) throw new Error('the Rival is at a table she is not at');
    if (await lob.$('.rival-block')) throw new Error('a Rival nobody has met is on the screen');
    const owner = await text('.lobby-card.owner');
    if (!/Owner: Tilly/.test(owner) || !/The owner's table/.test(owner) || !/beat Tilly in a duel/.test(owner)) throw new Error(`the owner's table reads "${owner}"`);
    const sides = await lob.$$eval('.lobby-card:not(.owner) h4', (n) => n.map((x) => x.textContent.trim()));
    if (sides.join() !== 'The back room,The corner game') throw new Error(`the side games are ${sides}`);

    // Sit at a side game: its own name over the felt, five others, and the sitting is counted when you leave.
    await lob.click('.lobby-card:not(.owner) .btn');
    await lob.waitForSelector('.felt', { timeout: 5000 });
    const head = await text('.table-head');
    if (!/The back room|The corner game/.test(head) || /Tilly's table/.test(head)) throw new Error(`a side game's header reads "${head}"`);
    if ((await lob.$$('.felt .seat')).length !== 6) throw new Error('a side game is not six-handed');
    await lob.click('button:has-text("Deal me in")');
    await lob.waitForSelector('.action-buttons button', { timeout: 20000 });
    // One hand to the end, so there is something for Silas to write down.
    const handDone = Date.now() + 60000;
    while (Date.now() < handDone && !/Deal next hand/.test((await lob.textContent('.action-bar').catch(() => '')) || '')) {
      const btn = (await lob.$('.action-buttons .btn.danger')) || (await lob.$('.action-buttons .btn:not(.primary):not(.danger)'));
      if (btn) await btn.click().catch(() => {});
      await lob.waitForTimeout(120);
    }
    await lob.click('.table-head button:has-text("Cash out")');
    await lob.waitForSelector('.stop-screen', { timeout: 8000 });
    if ((await profile()).career.sittings !== without + 1) throw new Error('a finished sitting was not counted');

    // Silas says how the table was chosen.
    await lob.click('.stop-notes');
    await lob.waitForSelector('.notes-envelope', { timeout: 5000 });
    await lob.click('.notes-envelope');
    await lob.waitForSelector('.notes-choice', { timeout: 5000 });
    if (!/of the 3 tables/.test(await text('.notes-choice'))) throw new Error(`the table choice reads "${await text('.notes-choice')}"`);

    // A visit with her: she is tagged at one table, and the screen has her card.
    await seed({ career: career(withRival) });
    await lob.reload({ waitUntil: 'domcontentloaded' });
    await lob.goto(`${BASE}/#stop?at=nl5`, { waitUntil: 'domcontentloaded' });
    await lob.waitForSelector('.lobby-card', { timeout: 5000 });
    const tags = await lob.$$eval('.lobby-tag.rival', (n) => n.map((x) => x.textContent.trim()));
    if (tags.join() !== 'Nell is here') throw new Error(`the Rival tag reads ${tags}`);
    const tease = await text('.rival-block');
    if (!/Nell Corbin/.test(tease) || !/not a regular/.test(tease)) throw new Error(`the Rival's card before you have met reads "${tease}"`);
    if ((await lob.$$('.lobby-card .lobby-face.rival')).length !== 1) throw new Error('the Rival is not in exactly one seat');

    // Sit with her: she introduces herself once, her name is on a seat, and she counts.
    await lob.click('.lobby-card:has(.lobby-tag.rival) .btn');
    await lob.waitForSelector('.felt', { timeout: 5000 });
    if (!/Nell/.test(await text('.felt'))) throw new Error('nobody at the table is called Nell');
    await lob.click('button:has-text("Deal me in")');
    await lob.waitForSelector('.toast', { timeout: 8000 });
    if (!/Nell Corbin sits down/.test(await text('#toasts'))) throw new Error(`the toast reads "${await text('#toasts')}"`);
    const deadline = Date.now() + 90000;
    let faced = 0;
    while (Date.now() < deadline && faced < 3) {
      const bar = (await lob.textContent('.action-bar').catch(() => '')) || '';
      if (/Deal next hand/.test(bar)) { await lob.click('button:has-text("Deal next hand")').catch(() => {}); }
      else {
        const btn = (await lob.$('.action-buttons .btn.danger')) || (await lob.$('.action-buttons .btn:not(.primary):not(.danger)'));
        if (btn) await btn.click().catch(() => {});
      }
      faced = ((await profile()).rival || { memory: { facedBet: 0 } }).memory.facedBet;
      await lob.waitForTimeout(120);
    }
    const saved = (await profile()).rival;
    if (saved.met !== 1 || saved.memory.facedBet < 3) throw new Error(`the Rival has met you ${saved.met} times and counted ${saved.memory.facedBet} bets`);
    await lob.click('.table-head button:has-text("Cash out")');
    await lob.waitForSelector('.rival-block', { timeout: 8000 });
    const after = await text('.rival-block');
    if (!/Still watching you/.test(after) || !/mix it up/.test(after)) throw new Error(`the Rival's card after a sitting reads "${after}"`);

    // And her card speaks Dutch.
    await seed({ settings: { lang: 'nl' } });
    await lob.reload({ waitUntil: 'domcontentloaded' });
    await lob.waitForSelector('.rival-block', { timeout: 5000 });
    const dutch = await text('.rival-block');
    if (!/Nog een zwerver/.test(dutch) || /watching|drifter/.test(dutch)) throw new Error(`the Rival's card in Dutch reads "${dutch}"`);
    console.log(`      three tables with numbers, the owner at one; a side game counts a sitting and Silas ranks the choice; Nell is tagged at one table, introduces herself and counted ${saved.memory.facedBet} bets; Dutch`);
  } finally {
    await ctx.close();
  }
});

await step('Silas posts contracts, today\'s question keeps a streak, and a stranger passes through', async () => {
  // Three contracts on the map, drawn from the reader's own skills and paid
  // when done at a table; three questions a day that count once and keep a
  // streak; and a stranger at a side game for a few sittings, met once.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const post = await ctx.newPage();
  post.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  post.on('console', (m) => { if (m.type() === 'error' && !/raw\.githubusercontent|ERR_CONNECTION|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const text = async (sel) => (await post.textContent(sel).catch(() => '') || '').replace(/\s+/g, ' ').trim();
  const profile = () => post.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')));
  const seed = (patch) => post.evaluate((p) => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...raw, ...p, settings: { ...(raw.settings || {}), sound: false, music: false, autoDeal: true, ...(p.settings || {}) } }));
  }, patch);
  const OWNED = ['hand-rankings', 'pot-odds', 'outs', 'preflop', 'position', 'cbet'].map((id) => `lesson:${id}`);
  const WALKED = ['hand-rankings', 'pot-odds', 'outs', 'preflop', 'position', 'cbet'];
  try {
    await post.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await seed({
      seenPrologue: true,
      walkthroughs: WALKED,
      economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: OWNED },
      career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: [], played: { nl2: 5 } },
    });
    await post.reload({ waitUntil: 'domcontentloaded' });
    await post.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await post.waitForSelector('.contracts-card', { timeout: 8000 });

    // Three contracts, each with a purse; today's question is waiting.
    const rows = await post.$$eval('.contracts .contract', (n) => n.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    if (rows.length !== 3) throw new Error(`${rows.length} contracts posted: ${rows.join(' | ')}`);
    if (!rows.every((r) => /Make|Play|Land/.test(r) && /0 of/.test(r))) throw new Error(`the contracts read ${rows.join(' | ')}`);
    const daily = await text('.daily-card');
    if (!/Today's question/.test(daily) || !/Answer today's three/.test(daily) || !/0\s*day/.test(daily)) throw new Error(`today's question reads "${daily}"`);

    // Answer today's three: they count once, the streak starts, and a second go pays nothing.
    const before = (await profile()).economy.pearls;
    await post.click('.daily-card .btn.primary');
    await post.waitForSelector('.options .option', { timeout: 8000 });
    if (!/Today's question/.test(await text('.book-bar'))) throw new Error('the set does not say it is today\'s');
    for (let i = 0; i < 3; i++) {
      await post.waitForSelector('.options .option:not([disabled])', { timeout: 8000 });
      await post.click('.options .option:not([disabled]) >> nth=0');
      await post.waitForSelector('.options .option[disabled]', { timeout: 5000 });
      await post.keyboard.press('Enter');
      await post.waitForTimeout(150);
    }
    await post.waitForSelector('.daily-prize', { timeout: 8000 });
    const prize = await text('.daily-prize');
    if (!/1 days in a row|1 day/.test(prize) && !/for today's set\. 1 days/.test(prize)) throw new Error(`the day's prize reads "${prize}"`);
    const after = await profile();
    if (after.daily.streak !== 1 || after.daily.days !== 1 || !(after.economy.pearls > before)) throw new Error(`the day was kept as ${JSON.stringify(after.daily)}, pearls ${before} → ${after.economy.pearls}`);
    await post.click('.result-head ~ * button:has-text("Back to the river"), button:has-text("Back to the river")');
    await post.waitForSelector('.daily-card', { timeout: 5000 });
    if (!/Done for today/.test(await text('.daily-card'))) throw new Error('the card does not say today is done');
    await post.click('.daily-card .btn.primary');
    await post.waitForSelector('.options .option', { timeout: 8000 });
    for (let i = 0; i < 3; i++) {
      await post.click('.options .option:not([disabled]) >> nth=0');
      await post.keyboard.press('Enter');
      await post.waitForTimeout(150);
    }
    await post.waitForSelector('.daily-prize', { timeout: 8000 });
    if (!/pays nothing/.test(await text('.daily-prize'))) throw new Error(`a second go the same day reads "${await text('.daily-prize')}"`);
    if ((await profile()).daily.days !== 1) throw new Error('a second go the same day counted');

    // A contract is done at a table: a sound preflop decision, and the purse is paid.
    await seed({ contracts: { active: [{ id: 't0', kind: 'sound', skill: 'preflop', need: 1, have: 0, reward: 30 }], issued: 7, done: 0 } });
    await post.reload({ waitUntil: 'domcontentloaded' });
    await post.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
    await post.waitForSelector('.felt', { timeout: 5000 });
    const pearlsBefore = (await profile()).economy.pearls;
    await post.click('button:has-text("Deal me in")');
    const until = Date.now() + 120000;
    while (Date.now() < until && (await profile()).contracts.done < 1) {
      const bar = (await post.textContent('.action-bar').catch(() => '')) || '';
      if (/Deal next hand/.test(bar)) await post.click('button:has-text("Deal next hand")').catch(() => {});
      else {
        const read = await post.$('.read-bands .btn');
        const btn = read || (await post.$('.action-buttons .btn.danger')) || (await post.$('.action-buttons .btn:not(.primary):not(.danger)'));
        if (btn) await btn.click().catch(() => {});
      }
      await post.waitForTimeout(150);
    }
    const paid = await profile();
    if (paid.contracts.done < 1) throw new Error('a sound preflop decision never finished the contract');
    if (!(paid.economy.pearls >= pearlsBefore + 30)) throw new Error(`the contract paid ${paid.economy.pearls - pearlsBefore} pearls, not 30 or more`);
    if (paid.contracts.active.length !== 3) throw new Error(`${paid.contracts.active.length} contracts on the board after one was finished`);

    // A stranger at a side game: tagged in the lobby, met once as a scene, and the card says how to beat them.
    await post.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    const found = await post.evaluate(async () => {
      const m = await import('/src/js/state/lobby.js');
      const stop = (await import('/src/js/data/venues.js')).VENUES[3];
      for (let s = 0; s < 120; s++) {
        const l = m.lobbyFor(stop, s);
        if (l.wanderer) return { s, key: l.wanderer.key, table: l.wanderer.table };
      }
      return null;
    });
    if (!found) throw new Error('no stranger in a hundred and twenty sittings at the fourth stop');
    await seed({
      walkthroughs: [...WALKED, 'mdf'],
      economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: OWNED },
      career: { venue: 'nl25', best: 'nl25', busted: 0, staked: 0, beaten: ['nl2', 'nl5', 'nl10'], played: { nl2: 60, nl5: 60, nl10: 60 }, sittings: found.s },
      bankroll: 2000,
    });
    await post.reload({ waitUntil: 'domcontentloaded' });
    await post.goto(`${BASE}/#stop?at=nl25`, { waitUntil: 'domcontentloaded' });
    await post.waitForSelector('.lobby-card', { timeout: 8000 });
    const tag = await post.$$eval('.lobby-tag.wanderer', (n) => n.map((x) => x.textContent.trim()));
    if (tag.length !== 1 || !/is here/.test(tag[0])) throw new Error(`the stranger's tag reads ${tag}`);
    const card = await text('.wanderer-block');
    if (!/Passing through/.test(card) || !/How to beat/.test(card) || !/twice an owner/.test(card)) throw new Error(`the stranger's card reads "${card}"`);
    await post.click(`.lobby-card:has(.lobby-tag.wanderer) .btn`);
    await post.waitForSelector('.felt', { timeout: 5000 });
    await post.click('button:has-text("Deal me in")');
    await post.waitForSelector('.toast', { timeout: 8000 });
    if (!/sits down/.test(await text('#toasts'))) throw new Error(`the scene reads "${await text('#toasts')}"`);
    const saved = await profile();
    if (!saved.scenes || !saved.scenes[`wanderer-${found.key}`]) throw new Error('the stranger\'s scene was not marked as seen');

    // And all of it in Dutch.
    await seed({ settings: { lang: 'nl' } });
    await post.reload({ waitUntil: 'domcontentloaded' });
    await post.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await post.waitForSelector('.contracts-card', { timeout: 8000 });
    const dutch = await text('.post-panel');
    if (!/opdrachten/i.test(dutch) || /Jobs from|Answer today/.test(dutch)) throw new Error(`the post panel in Dutch reads "${dutch.slice(0, 200)}"`);
    console.log(`      three contracts, one paid at a table; today's three counted once, streak 1, second go paid nothing; ${found.key} met as a scene at ${found.table}; Dutch`);
  } finally {
    await ctx.close();
  }
});

await step('a Regatta: six players, the entry paid up front, the top three paid, and a way out', async () => {
  // A sit-and-go at a stop: the entry comes out of the bankroll before the
  // first card, the blinds climb, players go out and are placed, it ends when
  // the reader is out or has everything, and a prize goes back in.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const reg = await ctx.newPage();
  reg.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  reg.on('console', (m) => { if (m.type() === 'error' && !/raw\.githubusercontent|ERR_CONNECTION|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const text = async (sel) => (await reg.textContent(sel).catch(() => '') || '').replace(/\s+/g, ' ').trim();
  const profile = () => reg.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')));
  const seed = (patch) => reg.evaluate((p) => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...raw, ...p, settings: { ...(raw.settings || {}), sound: false, music: false, autoDeal: true, ...(p.settings || {}) } }));
  }, patch);
  try {
    await reg.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await reg.evaluate(() => localStorage.removeItem('poker-trainer.profile.v1'));
    await reg.reload({ waitUntil: 'domcontentloaded' });
    await seed({
      seenPrologue: true,
      walkthroughs: ['hand-rankings', 'pot-odds', 'outs', 'preflop', 'position'],
      economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: ['hand-rankings', 'pot-odds', 'outs', 'preflop', 'position'].map((id) => `lesson:${id}`) },
      career: { venue: 'nl10', best: 'nl10', busted: 0, staked: 0, beaten: ['nl2', 'nl5'], played: { nl2: 40, nl5: 60, nl10: 5 } },
      bankroll: 1000,
    });
    await reg.reload({ waitUntil: 'domcontentloaded' });
    await reg.goto(`${BASE}/#stop?at=nl10`, { waitUntil: 'domcontentloaded' });
    await reg.waitForSelector('.regatta-block', { timeout: 8000 });
    const block = await text('.regatta-block');
    if (!/Six players/.test(block) || !/Entry\s*\$10\.00/.test(block) || !/First\s*\$30\.00/.test(block) || !/Third\s*\$12\.00/.test(block)) throw new Error(`the Regatta block reads "${block}"`);

    // Enter and withdraw before a card is dealt: nothing was played, so the entry comes back.
    const before = (await profile()).bankroll;
    await reg.click('.regatta-block .btn.primary');
    await reg.waitForSelector('.felt', { timeout: 8000 });
    const paid = (await profile()).bankroll;
    if (Math.abs(before - paid - 10) > 0.001) throw new Error(`the entry took ${before - paid}, not 10`);
    const clock = await text('.match-banner');
    if (!/Blinds 25 \/ 50/.test(clock) || !/Level 1 of 11/.test(clock) || !/6 of 6 left/.test(clock)) throw new Error(`the Regatta banner reads "${clock}"`);
    if ((await reg.$$('.felt .seat')).length !== 6) throw new Error('a Regatta is not six-handed');
    if (!/Regatta at The Ferry/.test(await text('.table-head'))) throw new Error(`the header reads "${await text('.table-head')}"`);
    await reg.click('.table-head button:has-text("Withdraw")');
    await reg.waitForSelector('.stop-screen', { timeout: 8000 });
    const refunded = await profile();
    if (Math.abs(refunded.bankroll - before) > 0.001) throw new Error(`withdrawing before a deal left the bankroll at ${refunded.bankroll}, not ${before}`);
    if (refunded.career.regattas && refunded.career.regattas.nl10) throw new Error('an entry never dealt was counted');

    // Play one to the end by shoving: out, or the last one standing.
    await reg.waitForSelector('.regatta-block .btn.primary', { timeout: 5000 });
    await reg.click('.regatta-block .btn.primary');
    await reg.waitForSelector('.felt', { timeout: 8000 });
    await reg.click('button:has-text("Deal me in")');
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline && !(await reg.$('.regatta-result'))) {
      const bar = (await reg.textContent('.action-bar').catch(() => '')) || '';
      if (/Deal next hand/.test(bar)) { await reg.click('button:has-text("Deal next hand")').catch(() => {}); await reg.waitForTimeout(120); continue; }
      const allIn = await reg.$('.size-presets .size-btn:last-child');
      if (allIn) {
        await allIn.click().catch(() => {});
        const go = await reg.$('.action-buttons .btn.primary');
        if (go) await go.click().catch(() => {});
      } else {
        const btn = (await reg.$('.action-buttons .btn.success')) || (await reg.$('.action-buttons .btn:not(.primary):not(.danger)'));
        if (btn) await btn.click().catch(() => {});
      }
      await reg.waitForTimeout(120);
    }
    if (!(await reg.$('.regatta-result'))) throw new Error('the Regatta never finished');
    const result = await text('.regatta-result');
    if (!/You (won the Regatta|finished)/.test(result) || !/entry/.test(result) || !/Prizes: \$30\.00 \/ \$18\.00 \/ \$12\.00/.test(result)) throw new Error(`the result reads "${result}"`);
    const saved = await profile();
    const rec = saved.career.regattas.nl10;
    if (rec.entered !== 1 || !(rec.best >= 1 && rec.best <= 6)) throw new Error(`the record is ${JSON.stringify(rec)}`);
    const expected = before - 10 + (rec.best <= 3 ? [30, 18, 12][rec.best - 1] : 0);
    if (Math.abs(saved.bankroll - expected) > 0.01) throw new Error(`finishing ${rec.best} left the bankroll at ${saved.bankroll}, expected ${expected}`);
    if (Math.abs(rec.net - (expected - before)) > 0.01) throw new Error(`the net is ${rec.net}, expected ${expected - before}`);

    // Getting up in the middle gives up the entry: a try at no place.
    await reg.click('.regatta-result .btn.primary');
    await reg.waitForSelector('.felt', { timeout: 8000 });
    await reg.click('button:has-text("Deal me in")');
    await reg.waitForSelector('.action-buttons button', { timeout: 20000 });
    const mid = (await profile()).bankroll;
    await reg.click('.table-head button:has-text("Withdraw")');
    await reg.waitForSelector('.stop-screen', { timeout: 8000 });
    const left = await profile();
    if (left.career.regattas.nl10.entered !== 2 || left.career.regattas.nl10.best !== rec.best) throw new Error(`a withdrawal left ${JSON.stringify(left.career.regattas.nl10)}`);
    if (Math.abs(left.bankroll - mid) > 0.001) throw new Error('withdrawing mid-game moved the bankroll again');

    // And in Dutch.
    await seed({ settings: { lang: 'nl' } });
    await reg.reload({ waitUntil: 'domcontentloaded' });
    await reg.waitForSelector('.regatta-block', { timeout: 8000 });
    const dutch = await text('.regatta-block');
    if (!/De Regatta/.test(dutch) || /Six players|Entry/.test(dutch)) throw new Error(`the Regatta block in Dutch reads "${dutch.slice(0, 160)}"`);
    console.log(`      entry $10 paid and refunded before a deal; finished ${rec.best} of 6 (net ${rec.net}); a withdrawal gave up the entry; Dutch`);
  } finally {
    await ctx.close();
  }
});

/** Play hands of a duel by shoving or calling until `n` have been dealt, or it ends; says whether the log saw the blinds rise. */
async function playOutHands(page, n) {
  let dealt = 0;
  let rose = false;
  const deadline = Date.now() + 120000;
  let lastBar = '';
  while (Date.now() < deadline && dealt < n) {
    if (await page.$('.duel-result')) break;
    const bar = ((await page.textContent('.action-bar').catch(() => '')) || '');
    if (/Deal next hand|Deal me in/.test(bar)) {
      if (bar !== lastBar) { dealt++; lastBar = bar; }
      if (dealt >= n) break;
      const deal = await page.$('button:has-text("Deal next hand"), button:has-text("Deal me in")');
      if (deal) await deal.click().catch(() => {});
      await page.waitForTimeout(150);
      lastBar = '';
      continue;
    }
    // A cautious hand: call or check, so the match runs long enough to see the clock move.
    const btn = (await page.$('.action-buttons .btn.success')) || (await page.$('.action-buttons .btn:not(.primary):not(.danger)'));
    if (btn) await btn.click().catch(() => {});
    await page.waitForTimeout(100);
  }
  const clock = ((await page.textContent('.match-banner').catch(() => '')) || '');
  rose = /Level [2-8] of 8/.test(clock) || (await page.$('.duel-result')) !== null;
  return { dealt, rose };
}

await step('a duel with the owner of a table: the blinds climb, it ends, the stars say why', async () => {
  // Once a city's lessons and hands are done its owner will play you heads-up
  // for the table. Before that they will not, and say what is left. The match
  // has a blind clock, ends when somebody has every chip, scores the play and
  // not just the result, and can be fought again for the stars.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const duel = await ctx.newPage();
  duel.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  duel.on('console', (m) => { if (m.type() === 'error' && !/raw\.githubusercontent|ERR_CONNECTION|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const text = async (sel) => (await duel.textContent(sel).catch(() => '') || '').replace(/\s+/g, ' ').trim();
  const profile = () => duel.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')));
  const seed = (patch) => duel.evaluate((p) => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...raw, ...p, settings: { ...(raw.settings || {}), sound: false, music: false, ...(p.settings || {}) } }));
  }, patch);
  const READY = {
    walkthroughs: ['hand-rankings', 'pot-odds'],
    economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: ['lesson:hand-rankings', 'lesson:pot-odds'] },
    career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: [], played: { nl2: 30 } },
  };
  /** Shove, or call, or check, until the duel's result is up. Returns the panel's text. */
  const playOut = async () => {
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      if (await duel.$('.duel-result')) return text('.duel-result');
      const bar = (await duel.textContent('.action-bar').catch(() => '')) || '';
      if (/Deal next hand|Deal me in/.test(bar)) {
        const deal = await duel.$('button:has-text("Deal next hand"), button:has-text("Deal me in")');
        if (deal) await deal.click().catch(() => {});
        await duel.waitForTimeout(150);
        continue;
      }
      const allIn = await duel.$('.size-presets .size-btn:last-child');
      if (allIn) {
        await allIn.click().catch(() => {});
        const go = await duel.$('.action-buttons .btn.primary');
        if (go) await go.click().catch(() => {});
      } else {
        const btn = (await duel.$('.action-buttons .btn.success')) || (await duel.$('.action-buttons .btn:not(.primary):not(.danger)'));
        if (btn) await btn.click().catch(() => {});
      }
      await duel.waitForTimeout(120);
    }
    throw new Error('the duel never finished');
  };
  try {
    await duel.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await seed({ settings: { autoDeal: true }, ...READY });
    await duel.reload({ waitUntil: 'domcontentloaded' });
    await duel.goto(`${BASE}/#stop?at=nl2`, { waitUntil: 'domcontentloaded' });
    await duel.waitForSelector('.stop-screen', { timeout: 5000 });

    // The first visit tells you what the place is like, once.
    await duel.waitForSelector('.story-card', { timeout: 5000 });
    if (!/Mud Landing/.test(await text('.story-card'))) throw new Error(`the arrival scene reads "${await text('.story-card')}"`);
    await duel.reload({ waitUntil: 'domcontentloaded' });
    await duel.waitForSelector('.stop-screen', { timeout: 5000 });
    if (await duel.$('.story-card')) throw new Error('the arrival scene is told every time');

    // With the city done the owner offers a duel; before that they do not.
    const block = await text('.duel-block');
    if (!/Duel Wade/.test(block) || !/Challenge Wade/.test(block)) throw new Error(`the duel block reads "${block}"`);
    if (!/Win it and the table is yours/.test(block)) throw new Error(`a duel for the table does not say what it wins: ${block}`);
    await seed({ career: { ...READY.career, played: { nl2: 3 } } });
    await duel.reload({ waitUntil: 'domcontentloaded' });
    await duel.waitForSelector('.duel-block', { timeout: 5000 });
    const shut = await text('.duel-block');
    if (!/will not duel a stranger/.test(shut) || !/Play 25 hands/.test(shut)) throw new Error(`before the hands are played: "${shut}"`);
    if (await duel.$('.duel-block .btn')) throw new Error('a stranger was offered a duel');
    await duel.goto(`${BASE}/#play?mode=duel&at=nl2`, { waitUntil: 'domcontentloaded' });
    await duel.waitForSelector('.panel h1', { timeout: 5000 });
    if (!/Not yet/.test(await text('.screen'))) throw new Error('the table dealt a duel to a stranger');
    await seed({ career: READY.career });
    await duel.reload({ waitUntil: 'domcontentloaded' });

    // Challenge them: two seats, a blind clock, the owner's opening line.
    await duel.goto(`${BASE}/#stop?at=nl2`, { waitUntil: 'domcontentloaded' });
    await duel.waitForSelector('.duel-block .btn.primary', { timeout: 5000 });
    await duel.click('.duel-block .btn.primary');
    await duel.waitForSelector('.felt', { timeout: 5000 });
    const head = await text('.table-head');
    if (!/Wade's duel/.test(head) || !/Heads-up, to the last chip/.test(head) || !/Forfeit/.test(head)) throw new Error(`the duel header reads "${head}"`);
    const clock = await text('.match-banner');
    if (!/Blinds 1 \/ 2/.test(clock) || !/Level 1 of 8/.test(clock) || !/in 8 hands/.test(clock)) throw new Error(`the blind clock reads "${clock}"`);
    const seats = await duel.$$eval('.felt .seat', (n) => n.length);
    if (seats !== 2) throw new Error(`${seats} seats at a duel`);
    if (await duel.$('.size-chips-switch, .variant-switch')) throw new Error('a duel can be switched to another game');
    await duel.click('button:has-text("Deal me in")');
    await duel.waitForSelector('.action-buttons button', { timeout: 20000 });

    // The blinds go up on the clock, and say so in the log.
    const first = await playOutHands(duel, 9);
    if (!first.rose) throw new Error('nine hands in and the blinds had not gone up');
    if (!/Level 2 of 8/.test(await text('.match-banner')) && !(await duel.$('.duel-result'))) throw new Error(`after eight hands the clock reads "${await text('.match-banner')}"`);

    // Shove it out. A coin flip a hand, so a few goes if the first is lost.
    let result = await playOut();
    let tries = 1;
    while (!/won the duel|You took the table|You won the duel/.test(result) || /Wade won/.test(result)) {
      if (tries >= 8) throw new Error(`eight duels and no win: ${result}`);
      if (!/Wade won the duel/.test(result)) throw new Error(`the result reads "${result}"`);
      if (!/Lost the stack/.test(result)) throw new Error(`a loss does not say what the stars were for: ${result}`);
      if ((await duel.$$('.duel-star.on')).length !== 0) throw new Error('a lost duel earned stars');
      await duel.click('.duel-result .btn.primary');
      await duel.waitForSelector('.felt', { timeout: 5000 });
      await duel.click('button:has-text("Deal me in")');
      result = await playOut();
      tries++;
    }
    const stars = (await duel.$$('.duel-star.on')).length;
    if (stars < 1 || stars > 3) throw new Error(`${stars} stars for a win`);
    if (!/You took the table/.test(result)) throw new Error(`the first win does not take the table: ${result}`);
    if (!/decisions/.test(result)) throw new Error(`the result does not say what the stars were for: ${result}`);
    if (!/Paid/.test(result)) throw new Error(`a first win pays nothing: ${result}`);

    // Kept: a try for every duel, one win, the best stars, and the table taken.
    const saved = await profile();
    const rec = saved.career.duels.nl2;
    if (rec.tries !== tries || rec.wins !== 1 || rec.stars !== stars) throw new Error(`the record is ${JSON.stringify(rec)} after ${tries} duels and ${stars} stars`);
    if (!saved.career.beaten.includes('nl2')) throw new Error('winning the duel did not take the table');

    // Back at the stop: the owner's last word, the keepsake, and a rematch for the stars.
    await duel.click('.duel-result .btn.ghost');
    await duel.waitForSelector('.stop-screen', { timeout: 5000 });
    await duel.waitForSelector('.took-scrim', { timeout: 5000 });
    await duel.click('.took .btn.primary');
    await duel.waitForSelector('.duel-block .star-row', { timeout: 5000 });
    const after = await text('.duel-block');
    if (!/Rematch Wade/.test(after) || !new RegExp(`${tries > 1 ? tries : 1} won of ${tries}|1 won of ${tries}`).test(after)) throw new Error(`after the duel the block reads "${after}"`);

    // Getting up in the middle of one is a loss, with no stars.
    const before = (await profile()).career.duels.nl2;
    await duel.click('.duel-block .btn.primary');
    await duel.waitForSelector('.felt', { timeout: 5000 });
    await duel.click('button:has-text("Deal me in")');
    await duel.waitForSelector('.action-buttons button', { timeout: 20000 });
    await duel.click('.table-head button:has-text("Forfeit")');
    await duel.waitForSelector('.stop-screen', { timeout: 5000 });
    const forfeited = (await profile()).career.duels.nl2;
    if (forfeited.tries !== before.tries + 1 || forfeited.wins !== before.wins || forfeited.stars !== before.stars) {
      throw new Error(`a forfeit left ${JSON.stringify(forfeited)} after ${JSON.stringify(before)}`);
    }

    // And it all speaks Dutch.
    await seed({ settings: { lang: 'nl' } });
    await duel.reload({ waitUntil: 'domcontentloaded' });
    await duel.waitForSelector('.duel-block', { timeout: 5000 });
    const dutch = await text('.duel-block');
    if (!/Duel met Wade/.test(dutch) || /Rematch|stars/.test(dutch)) throw new Error(`the duel block in Dutch reads "${dutch}"`);
    console.log(`      the first visit tells the story once; a stranger is refused; Wade's blinds climb 1/2 → 2/4; a win took the table on duel ${tries} with ${stars} star${stars === 1 ? '' : 's'}; a forfeit counted as a loss; Dutch`);
  } finally {
    await ctx.close();
  }
});

await step('layout holds up on phone and tablet viewports', async () => {
  // iPad first, then iPhone, then desktop — the order this actually gets
  // used in. Checks the three things that break on touch and are invisible
  // on a desktop: content wider than the screen, tap targets under Apple's
  // 44px guidance, and inputs under 16px (which make iOS zoom the page on
  // focus and never zoom back).
  const viewports = [
    ['iPhone SE', 375, 667],
    ['iPhone 15', 393, 852],
    ['iPad portrait', 820, 1180],
    ['iPad landscape', 1180, 820],
  ];
  const routes = ['#home', '#stop?at=nl10', '#play', '#lab-run', '#review', '#walkthrough?module=pot-odds',
    '#charts?chart=BTN', '#stats',
    // The lesson table adds two panels above the felt and a report below it,
    // and it is the screen this app is now mostly used on.
    '#play?lesson=pot-odds', '#play?lesson=preflop'];
  const faults = [];

  for (const [name, w, h] of viewports) {
    await page.setViewportSize({ width: w, height: h });
    for (const route of routes) {
      await page.goto(`${BASE}/${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(320);
      const bad = await page.evaluate((vw) => {
        const out = [];
        const de = document.documentElement;
        if (de.scrollWidth - de.clientWidth > 1) out.push(`overflows by ${de.scrollWidth - de.clientWidth}px`);
        for (const sel of ['.felt', '.range-grid-scroll', '.topbar', '.action-buttons']) {
          for (const elem of document.querySelectorAll(sel)) {
            // A scroll container is *supposed* to hold wider content — that is
            // what makes it scrollable. Only unreachable overflow is a fault.
            const scrolls = /auto|scroll/.test(getComputedStyle(elem).overflowX);
            if (!scrolls && elem.scrollWidth > elem.clientWidth + 2) {
              out.push(`${sel} content is cut off with no way to scroll to it`);
            }
          }
        }
        for (const input of document.querySelectorAll('input:not([type=range]), textarea')) {
          const fs = parseFloat(getComputedStyle(input).fontSize);
          if (fs && fs < 16) out.push(`input at ${fs}px would trigger iOS zoom`);
        }
        void vw;
        return [...new Set(out)];
      }, w);
      for (const b of bad) faults.push(`${name} ${route}: ${b}`);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  if (faults.length) throw new Error(faults.join('; '));
});

console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors.slice(0, 12)) console.log(`  ! ${e}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
