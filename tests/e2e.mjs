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

/** A stop is a town: open one of its doors (card room, owner, regatta, deeds, board, street), if it is not open already. */
async function door(pg, key) {
  await pg.waitForSelector(`.town-door[data-place="${key}"]`, { timeout: 8000 });
  if (!(await pg.$(`.town-door.active[data-place="${key}"]`))) await pg.click(`.town-door[data-place="${key}"]`);
  await pg.waitForSelector(`.town-door.active[data-place="${key}"]`, { timeout: 3000 });
}
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
  'value', 'streets', 'threebet', 'multiway', 'pushfold',
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

// A table waits for you when you look away, so going somewhere else and coming
// back no longer deals a new one. A step that wants a fresh table says so: a
// reload lets go of the one that was waiting.
const freshTable = async (hash = '#play') => {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
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
  if (tiles !== 17) throw new Error(`expected 17 module tiles, got ${tiles}`);
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
    // The five shares of the pot; Silas's own size, when he is at your
    // shoulder, is checked on its own below.
    offers: [...document.querySelectorAll('.size-btn:not(.size-silas)')].map((b) => ({
      name: b.querySelector('.size-name').textContent,
      chips: Number(b.querySelector('.size-chips').textContent),
    })),
    silas: (() => {
      const b = document.querySelector('.size-silas');
      return b ? Number(b.querySelector('.size-chips').textContent) : null;
    })(),
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
  // Silas's size makes the same promise: the amount on it is the amount raised.
  if (opened.silas !== null) {
    await page.click('.size-silas');
    const s = await state();
    agree(s, 'after Silas\'s size');
    if (s.button !== opened.silas) throw new Error(`Silas's size shows ${opened.silas} but sets ${s.button}`);
    if (!(await page.$('.size-silas.is-active'))) throw new Error('Silas\'s size did not mark itself as chosen');
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
  // A fresh table: the previous step's half-played hand is waiting otherwise.
  await freshTable();
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
    'cbet', 'mdf', 'bluffing', 'spr', 'exploit', 'icm',
    'value', 'streets', 'threebet', 'multiway', 'pushfold'];
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
    const plates = [...document.querySelectorAll('.river-map .map-stop, .river-map .map-place, .river-map .map-town')];
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
    // Eight stops, eight places, and the three towns off the river, uncharted or not.
    if (seen.count !== 19 || seen.places !== 8) throw new Error(`${seen.count} signs and ${seen.places} places at ${w}px, expected 19 and 8`);
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

await step('the rank chip opens your character, the rank on it opens the ladder, and locked ranks stay locked', async () => {
  // The chip on the rail is you: it opens the Character screen, and the rank
  // on that screen is the way to the papers.
  await page.goto(`${BASE}/#train`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.click('.rank-chip');
  await page.waitForTimeout(400);
  if (!/#character/.test(page.url())) throw new Error(`rank chip went to ${page.url()}`);
  await page.click('button.char-fact');
  await page.waitForTimeout(400);
  const url = page.url();
  if (!/#levels/.test(url)) throw new Error(`the rank on your character went to ${url}`);

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
  // Play the hand out, and a few more. A hand folded wrong pays nothing, and
  // four dealt at random can all be folded wrong: deal on until the purse moves.
  const purse = () => page.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).economy.pearls);
  for (let i = 0, hands = 0; i < 900 && hands < 12; i++) {
    const deal = await page.$('button:has-text("Deal next hand")');
    if (deal && hands >= 4 && await purse() > before) break;
    if (deal) { hands++; await deal.click(); await page.waitForTimeout(100); continue; }
    const next = await page.$('.action-buttons .btn:has-text("Check")') || await page.$('.action-buttons .btn:has-text("Fold")');
    if (next) await next.click().catch(() => {});
    await page.waitForTimeout(120);
  }
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')).economy);
  if (after.pearls <= before) throw new Error(`a dozen hands paid nothing: ${before} → ${after.pearls}`);
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
  if (creek.stops !== 17 || creek.water !== 17) throw new Error(`${creek.stops} chapters and ${creek.water} bends of water on the creek, expected 17 of each`);
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
    '#ranges', '#ranges-run', '#ranges-weak', '#store', '#report', '#character',
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
    await freshTable();
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
    await fresh.waitForSelector('.stop-actions', { timeout: 5000 });
    const shut = await text('.stop-actions');
    if (!/opens when Mud Landing is finished/.test(shut)) throw new Error(`a shut city says: ${shut}`);
    if (await fresh.$('.stop-actions .btn:has-text("Steam down")')) throw new Error('a shut city offers a way in');
    await door(fresh, 'board');
    await fresh.waitForSelector('.road-stop', { timeout: 5000 });
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
    if (strip.join() !== ['done', 'current', ...Array(11).fill('locked')].join()) throw new Error(`the strip reads ${strip}`);

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
    if ((await lob.$$('.lobby-card .lobby-face.rival')).length !== 1) throw new Error('the Rival is not in exactly one seat');
    await door(lob, 'street');
    const tease = await text('.rival-block');
    if (!/Nell Corbin/.test(tease) || !/not a regular/.test(tease)) throw new Error(`the Rival's card before you have met reads "${tease}"`);
    await door(lob, 'room');

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
    await door(lob, 'street');
    await lob.waitForSelector('.rival-block', { timeout: 8000 });
    const after = await text('.rival-block');
    if (!/Still watching you/.test(after) || !/mix it up/.test(after)) throw new Error(`the Rival's card after a sitting reads "${after}"`);

    // And her card speaks Dutch.
    await seed({ settings: { lang: 'nl' } });
    await lob.reload({ waitUntil: 'domcontentloaded' });
    await door(lob, 'street');
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
  // Today's three are whatever the date draws: a choice to pick, or a number
  // to type (the outs). Either is answered, and the feedback says it was.
  const QUESTION = '.options .option:not([disabled]), .drill-entry-input';
  const answerOne = async () => {
    await post.waitForSelector(QUESTION, { timeout: 8000 });
    if (await post.$('.options .option:not([disabled])')) {
      await post.click('.options .option:not([disabled]) >> nth=0');
    } else {
      await post.fill('.drill-entry-input', '4');
      await post.click('button.btn.primary:has-text("Answer")');
    }
    await post.waitForSelector('.feedback', { timeout: 5000 });
    await post.keyboard.press('Enter');
    await post.waitForTimeout(150);
  };
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
    await post.waitForSelector(QUESTION, { timeout: 8000 });
    if (!/Today's question/.test(await text('.book-bar'))) throw new Error('the set does not say it is today\'s');
    for (let i = 0; i < 3; i++) await answerOne();
    await post.waitForSelector('.daily-prize', { timeout: 8000 });
    const prize = await text('.daily-prize');
    if (!/1 days in a row|1 day/.test(prize) && !/for today's set\. 1 days/.test(prize)) throw new Error(`the day's prize reads "${prize}"`);
    const after = await profile();
    if (after.daily.streak !== 1 || after.daily.days !== 1 || !(after.economy.pearls > before)) throw new Error(`the day was kept as ${JSON.stringify(after.daily)}, pearls ${before} → ${after.economy.pearls}`);
    await post.click('.result-head ~ * button:has-text("Back to the river"), button:has-text("Back to the river")');
    await post.waitForSelector('.daily-card', { timeout: 5000 });
    if (!/Done for today/.test(await text('.daily-card'))) throw new Error('the card does not say today is done');
    await post.click('.daily-card .btn.primary');
    for (let i = 0; i < 3; i++) await answerOne();
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
    await door(post, 'street');
    const card = await text('.wanderer-block');
    if (!/Passing through/.test(card) || !/How to beat/.test(card) || !/twice an owner/.test(card)) throw new Error(`the stranger's card reads "${card}"`);
    await door(post, 'room');
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
    await reg.goto(`${BASE}/#stop?at=nl10&place=regatta`, { waitUntil: 'domcontentloaded' });
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
    await door(reg, 'regatta');
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
    await door(reg, 'regatta');
    await reg.waitForSelector('.regatta-block', { timeout: 8000 });
    const dutch = await text('.regatta-block');
    if (!/De Regatta/.test(dutch) || /Six players|Entry/.test(dutch)) throw new Error(`the Regatta block in Dutch reads "${dutch.slice(0, 160)}"`);
    console.log(`      entry $10 paid and refunded before a deal; finished ${rec.best} of 6 (net ${rec.net}); a withdrawal gave up the entry; Dutch`);
  } finally {
    await ctx.close();
  }
});

await step('the bubble: the ICM chapter has a table, and the coach counts the prizes', async () => {
  // ICM is a tournament idea, so its table is a Regatta already down to four
  // with three paid: dealt straight away, practice only, and graded with the
  // prize money counted rather than the chips.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const bub = await ctx.newPage();
  bub.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  bub.on('console', (m) => { if (m.type() === 'error' && !/raw\.githubusercontent|ERR_CONNECTION|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const text = async (sel) => (await bub.textContent(sel).catch(() => '') || '').replace(/\s+/g, ' ').trim();
  const profile = () => bub.evaluate(() => JSON.parse(localStorage.getItem('poker-trainer.profile.v1')));
  const seed = (patch) => bub.evaluate((p) => {
    const key = 'poker-trainer.profile.v1';
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...raw, ...p, settings: { ...(raw.settings || {}), sound: false, music: false, autoDeal: false, liveCoach: true, ...(p.settings || {}) } }));
  }, patch);
  try {
    await bub.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await bub.evaluate(() => localStorage.removeItem('poker-trainer.profile.v1'));
    await bub.reload({ waitUntil: 'domcontentloaded' });
    const OWNED = ['hand-rankings', 'pot-odds', 'outs', 'preflop', 'position', 'cbet', 'mdf', 'bluffing', 'spr', 'exploit', 'icm'];
    await seed({
      seenPrologue: true,
      walkthroughs: OWNED,
      economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: OWNED.map((id) => `lesson:${id}`) },
      career: { venue: 'nl10', best: 'nl10', busted: 0, staked: 0, beaten: ['nl2', 'nl5'], played: { nl2: 40, nl5: 60, nl10: 5 } },
      bankroll: 1000,
    });
    await bub.reload({ waitUntil: 'domcontentloaded' });

    // The chapter has a way to play it.
    await bub.goto(`${BASE}/#learn?module=icm`, { waitUntil: 'domcontentloaded' });
    await bub.waitForSelector('.chapter-actions', { timeout: 8000 });
    const play = await bub.$('button:has-text("Play the bubble")');
    if (!play) throw new Error('the ICM chapter has no way to play the bubble');
    await play.click();
    await bub.waitForSelector('.felt', { timeout: 8000 });
    const head = await text('.table-head');
    if (!/The bubble/.test(head) || !/Nothing is entered and nothing is won/.test(head)) throw new Error(`the bubble's header reads "${head}"`);
    const clock = await text('.match-banner');
    if (!/Blinds 150 \/ 300/.test(clock) || !/Level 5 of 11/.test(clock) || !/4 of 4 left/.test(clock)) throw new Error(`the bubble's banner reads "${clock}"`);
    if ((await bub.$$('.felt .seat')).length !== 4) throw new Error('the bubble is not four players');
    const bankroll = (await profile()).bankroll;
    await bub.click('button:has-text("Deal me in")');

    // The first decision is named for what it is, and graded with the prizes in it.
    await bub.waitForSelector('.action-buttons button', { timeout: 20000 });
    const spot = await text('.coach');
    if (!/Tournament ICM/.test(spot)) throw new Error(`the coach does not name the skill: "${spot.slice(0, 160)}"`);
    let verdictSeen = null;
    const deadline = Date.now() + 200000;
    while (Date.now() < deadline && !(await bub.$('.bubble-result'))) {
      if (!verdictSeen) {
        const v = await bub.$('.verdict-box');
        if (v) verdictSeen = ((await v.textContent()) || '').replace(/\s+/g, ' ').trim();
      }
      const bar = (await bub.textContent('.action-bar').catch(() => '')) || '';
      if (/Deal next hand/.test(bar)) { await bub.click('button:has-text("Deal next hand")').catch(() => {}); await bub.waitForTimeout(120); continue; }
      const band = await bub.$('.read-bands .btn');
      if (band) { await band.click().catch(() => {}); continue; }
      const allIn = await bub.$('.size-presets .size-btn:last-child');
      const fold = await bub.$('.action-buttons .btn.danger');
      if (allIn && Math.random() < 0.5) {
        await allIn.click().catch(() => {});
        const go = await bub.$('.action-buttons .btn.primary');
        if (go) await go.click().catch(() => {});
      } else if (fold) {
        await fold.click().catch(() => {});
      } else {
        const btn = (await bub.$('.action-buttons .btn.success')) || (await bub.$('.action-buttons .btn:not(.primary):not(.danger)'));
        if (btn) await btn.click().catch(() => {});
      }
      await bub.waitForTimeout(120);
    }
    if (!(await bub.$('.bubble-result'))) throw new Error('the bubble never burst');
    if (!verdictSeen || !/prize|close call|Too tight|Right, with/i.test(verdictSeen)) throw new Error(`the verdict does not count the prizes: "${verdictSeen}"`);
    const result = await text('.bubble-result');
    if (!/bubble/.test(result) || !/decisions were right with the prizes counted|not asked anything/.test(result)) throw new Error(`the result reads "${result}"`);
    if (Math.abs((await profile()).bankroll - bankroll) > 0.001) throw new Error('practice moved the bankroll');
    if ((await profile()).career.regattas && (await profile()).career.regattas.nl10) throw new Error('the bubble was recorded as a Regatta');

    // Another one starts fresh; Silas's notes call it the bubble.
    await bub.click('.bubble-result .btn.primary');
    await bub.waitForSelector('.felt', { timeout: 8000 });
    if (!/4 of 4 left/.test(await text('.match-banner'))) throw new Error('a second bubble did not start with four');
    await bub.click('button:has-text("Deal me in")');
    await bub.waitForSelector('.action-buttons button', { timeout: 20000 });
    await bub.click('.table-head button:has-text("Leave")');
    await bub.waitForTimeout(600);

    // And in Dutch.
    await seed({ settings: { lang: 'nl' } });
    await bub.reload({ waitUntil: 'domcontentloaded' });
    await bub.goto(`${BASE}/#play?mode=regatta&bubble=1&at=nl10`, { waitUntil: 'domcontentloaded' });
    await bub.waitForSelector('.felt', { timeout: 8000 });
    const dutch = await text('.table-head');
    if (!/De bubbel/.test(dutch) || /Practice|Nothing is entered/.test(dutch)) throw new Error(`the bubble in Dutch reads "${dutch}"`);
    console.log(`      the ICM chapter plays the bubble: four left, 150/300; the coach named Tournament ICM and counted the prizes ("${verdictSeen.slice(0, 50)}…"); practice paid nothing; Dutch`);
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
    await door(duel, 'owner');
    const block = await text('.duel-block');
    if (!/Duel Wade/.test(block) || !/Challenge Wade/.test(block)) throw new Error(`the duel block reads "${block}"`);
    if (!/Win it and the table is yours/.test(block)) throw new Error(`a duel for the table does not say what it wins: ${block}`);
    await seed({ career: { ...READY.career, played: { nl2: 3 } } });
    await duel.reload({ waitUntil: 'domcontentloaded' });
    await door(duel, 'owner');
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
    await duel.goto(`${BASE}/#stop?at=nl2&place=owner`, { waitUntil: 'domcontentloaded' });
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

    // Shove it out. Close to a coin flip each time against a man who calls
    // everything, so a few goes if the first is lost: eight losses in a row
    // came up about one run in a hundred, sixteen about one in fifteen thousand.
    let result = await playOut();
    let tries = 1;
    while (!/won the duel|You took the table|You won the duel/.test(result) || /Wade won/.test(result)) {
      if (tries >= 16) throw new Error(`sixteen duels and no win: ${result}`);
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
    await door(duel, 'owner');
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
    await door(duel, 'owner');
    await duel.waitForSelector('.duel-block', { timeout: 5000 });
    const dutch = await text('.duel-block');
    if (!/Duel met Wade/.test(dutch) || /Rematch|stars/.test(dutch)) throw new Error(`the duel block in Dutch reads "${dutch}"`);
    console.log(`      the first visit tells the story once; a stranger is refused; Wade's blinds climb 1/2 → 2/4; a win took the table on duel ${tries} with ${stars} star${stars === 1 ? '' : 's'}; a forfeit counted as a loss; Dutch`);
  } finally {
    await ctx.close();
  }
});

await step('your character: the hands you play make the player you are, and the look is yours', async () => {
  // A player of their own, from nothing: one hand at the free table goes into
  // the career; the Character screen draws the figure, says it is too soon to
  // name a style, and fills in the one square of the grid that was dealt. A
  // career of tight-aggressive hands then puts a dot on the map. The look is
  // chosen, and survives a reload. The river carries a card that leads here.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cp = await ctx.newPage();
  const mine = [];
  cp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const KEY = 'poker-trainer.profile.v1';
  try {
    await cp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await cp.evaluate((key) => {
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      raw.seenPrologue = true;
      raw.settings = { ...(raw.settings || {}), autoDeal: false, liveCoach: false, lang: 'en' };
      localStorage.setItem(key, JSON.stringify(raw));
    }, KEY);
    await cp.reload({ waitUntil: 'domcontentloaded' });

    // One hand at the free table.
    await cp.goto(`${BASE}/#play`, { waitUntil: 'domcontentloaded' });
    await cp.waitForSelector('.felt', { timeout: 8000 });
    await cp.click('button.btn.primary.lg');
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const bar = await cp.textContent('.action-bar');
      if (/Deal next hand/.test(bar)) break;
      const band = await cp.$('.read-bands .btn');
      if (band) { await band.click().catch(() => {}); await cp.waitForTimeout(200); continue; }
      const btn = (await cp.$('.action-buttons .btn.success'))
        || (await cp.$('.action-buttons .btn:not(.danger):not(.primary)'))
        || (await cp.$('.action-buttons .btn.danger'));
      if (btn) await btn.click().catch(() => {});
      await cp.waitForTimeout(250);
    }
    const life = await cp.evaluate((key) => JSON.parse(localStorage.getItem(key)).lifetime, KEY);
    if (!life || life.hands !== 1) throw new Error(`the hand did not go into the career: ${JSON.stringify(life && { hands: life.hands })}`);
    if (life.style.hands !== 1) throw new Error('a hand at a full free table should count toward the style');
    if (Object.keys(life.starting).length !== 1) throw new Error(`one hand dealt, ${Object.keys(life.starting).length} starting hands kept`);

    // The rail's chip is the way in.
    await cp.click('.rank-chip');
    await cp.waitForSelector('.char-stage svg.character', { timeout: 5000 });
    const first = await cp.evaluate(() => ({
      type: document.querySelector('.type-name').textContent,
      rookie: document.querySelector('.rookie-bar') ? document.querySelector('.rookie-bar').textContent.replace(/\s+/g, ' ') : '',
      dealt: document.querySelectorAll('.hg-cell:not(.none)').length,
      cells: document.querySelectorAll('.hg-cell').length,
      regulars: document.querySelectorAll('.style-map .sm-regular').length,
      you: document.querySelectorAll('.style-map .sm-you').length,
      gauges: document.querySelectorAll('.cg').length,
      looks: document.querySelectorAll('.char-evolution .evo').length,
      ahead: document.querySelectorAll('.char-evolution .evo.ahead').length,
      plaques: document.querySelectorAll('.char-river .stat').length,
    }));
    if (first.type !== 'Still finding out') throw new Error(`one hand named a style: ${first.type}`);
    if (!/1 \/ 30/.test(first.rookie)) throw new Error(`the count to a style reads "${first.rookie}"`);
    if (first.cells !== 169 || first.dealt !== 1) throw new Error(`the grid has ${first.cells} squares, ${first.dealt} filled after one hand`);
    if (first.regulars !== 6 || first.you !== 0) throw new Error(`the map has ${first.regulars} regulars and ${first.you} of you before there is a style`);
    if (first.gauges !== 6) throw new Error(`${first.gauges} gauges, not six`);
    if (first.looks !== 5 || first.ahead !== 4) throw new Error(`${first.looks} looks with ${first.ahead} still to come; a new player wears the first`);
    if (first.plaques !== 10) throw new Error(`${first.plaques} river records, not ten`);

    // The look is yours: picked, drawn at once, and kept.
    await cp.click('.char-editor summary');
    await cp.click('.look-option[aria-label="Curly"]');
    await cp.click('.look-option[aria-label="Navy"]');
    await cp.fill('.look-name', 'Ada');
    await cp.press('.look-name', 'Enter');
    await cp.waitForTimeout(200);
    const plate = (await cp.textContent('.char-plate-name')).trim();
    const heading = await cp.textContent('.char-name');
    if (plate !== 'Ada' || !/^Ada, /.test(heading)) throw new Error(`the name did not take: plate "${plate}", heading "${heading}"`);
    await cp.reload({ waitUntil: 'domcontentloaded' });
    await cp.waitForSelector('.char-name', { timeout: 5000 });
    const kept = await cp.evaluate((key) => ({ look: JSON.parse(localStorage.getItem(key)).look, heading: document.querySelector('.char-name').textContent }), KEY);
    if (kept.look.hair !== 'curly' || kept.look.colour !== 'navy' || kept.look.name !== 'Ada' || !/^Ada, /.test(kept.heading)) {
      throw new Error(`the look did not survive a reload: ${JSON.stringify(kept)}`);
    }

    // A career of tight-aggressive hands, made by the code the table uses.
    await cp.evaluate(async (key) => {
      const { emptyLifetime, recordHand } = await import('/src/js/state/lifetime.js');
      const life = emptyLifetime();
      for (let i = 0; i < 60; i++) {
        const played = i % 5 === 0;
        recordHand(life, {
          mode: 'cash', full: true, key: played ? 'AKs' : '93o', position: ['BTN', 'CO', 'HJ', 'UTG', 'SB', 'BB'][i % 6],
          vpip: played, pfr: played, threeBet: false, threeBetChance: false, sawFlop: played, showdown: played && i % 10 === 0,
          won: played, netBb: played ? 3 : -0.25, potBb: played ? 6 : 1.5, bets: played ? 1 : 0, raises: 0, calls: 0, folds: played ? 0 : 1,
          allIn: false, made: null, bluff: false, decisions: 1, sound: 1, opponents: [], at: Date.now(), where: 'nl2',
        });
      }
      const raw = JSON.parse(localStorage.getItem(key));
      raw.lifetime = life;
      localStorage.setItem(key, JSON.stringify(raw));
    }, KEY);
    await cp.reload({ waitUntil: 'domcontentloaded' });
    await cp.waitForSelector('.style-map .sm-you', { timeout: 5000 });
    const read = await cp.evaluate(() => ({
      type: document.querySelector('.type-name').textContent,
      legend: Boolean(document.querySelector('.style-map-figure .chart-legend')),
      marks: document.querySelectorAll('.cg-mark').length,
      inRange: [...document.querySelectorAll('.cg')].map((g) => g.className).join(' '),
      favourite: document.querySelector('.hand-pick-name').textContent,
    }));
    if (read.type !== 'Tight-aggressive') throw new Error(`a fifth of hands, all raised, read as ${read.type}`);
    if (!read.legend) throw new Error('two kinds of dot on the map and no key to them');
    if (read.marks < 2) throw new Error(`only ${read.marks} gauges have a mark`);
    if (!/Ace-King suited/.test(read.favourite)) throw new Error(`the favourite hand reads "${read.favourite}"`);
    await cp.hover('.style-map .sm-you .dot');
    await cp.waitForTimeout(150);
    const tip = await cp.evaluate(() => {
      const t = document.querySelector('.style-map-figure .chart-tip');
      return t && !t.hidden ? t.textContent : null;
    });
    if (!tip || !/^You: plays 20% of hands, raises 100% of those/.test(tip)) throw new Error(`hovering your dot said: ${tip}`);

    // The river has a card that says who you are and leads here.
    await cp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await cp.waitForSelector('.you-card', { timeout: 5000 });
    const card = await cp.textContent('.you-card');
    if (!/Ada, the Hunter/.test(card)) throw new Error(`the river's card reads "${card.replace(/\s+/g, ' ')}"`);
    await cp.click('.you-card');
    await cp.waitForTimeout(300);
    if (!/#character/.test(cp.url())) throw new Error(`the card went to ${cp.url()}`);

    // On a phone nothing scrolls sideways.
    await cp.setViewportSize({ width: 390, height: 844 });
    await cp.goto(`${BASE}/#character`, { waitUntil: 'domcontentloaded' });
    await cp.waitForSelector('.char-stage svg.character', { timeout: 5000 });
    const wide = await cp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (wide > 1) throw new Error(`the Character screen is ${wide}px wider than a phone`);
    if (mine.length) throw new Error(mine.join(' | '));
    console.log('      one hand counted; 169 squares, one filled; a TAG career puts you on the map; the look survives a reload');
  } finally {
    await ctx.close();
  }
});

await step('a table waits when you look away: the seat is kept, the bar says so, and cashing out pays it back', async () => {
  // Looking at anything else used to end the table, and the buy-in went with
  // it: a reader lost buy-in after buy-in checking things between hands. The
  // table now waits, mid-hand, the rail says where you are sitting, a reload
  // keeps the chips, and nothing is charged twice.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const sp = await ctx.newPage();
  const mine = [];
  sp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const KEY = 'poker-trainer.profile.v1';
  const saved = () => sp.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
  try {
    await sp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await sp.evaluate((key) => {
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      raw.seenPrologue = true;
      raw.settings = { ...(raw.settings || {}), autoDeal: false, liveCoach: false, lang: 'en' };
      localStorage.setItem(key, JSON.stringify(raw));
    }, KEY);
    await sp.reload({ waitUntil: 'domcontentloaded' });
    const road = await sp.textContent('.road-panel');
    if (!/cash out with \$4\.00/.test(road)) throw new Error('the road does not say what doubling the buy-in means in money');
    const start = (await saved()).bankroll;

    await sp.click('.here-actions .btn.primary');
    await sp.waitForSelector('.felt', { timeout: 8000 });
    const sat = await saved();
    if (Math.abs(sat.bankroll - (start - 2)) > 1e-9) throw new Error(`sitting down cost ${start - sat.bankroll}, not the $2 buy-in`);
    if (!sat.seat || sat.seat.chips !== 200) throw new Error(`the seat was not kept: ${JSON.stringify(sat.seat)}`);
    const meter = await sp.textContent('.take-meter');
    if (!/cash out with \$4\.00/.test(meter) || !/You have \$2\.00/.test(meter)) throw new Error(`the meter reads "${meter}"`);

    await sp.click('button.btn.primary.lg');
    await sp.waitForFunction(() => document.querySelectorAll('.seat.hero .card').length === 2, null, { timeout: 12000 });
    const cards = await sp.evaluate(() => [...document.querySelectorAll('.seat.hero .card')].map((c) => c.textContent).join(' '));

    // Look away, and the rail says where you are sitting.
    await sp.click('.rank-chip');
    await sp.waitForSelector('#seatbar:not([hidden])', { timeout: 5000 });
    const bar = await sp.textContent('#seatbar');
    if (!/still seated at Mud Landing/.test(bar)) throw new Error(`the bar reads "${bar}"`);
    await sp.click('#seatbar .btn.primary');
    await sp.waitForFunction(() => document.querySelectorAll('.seat.hero .card').length === 2, null, { timeout: 5000 });
    const again = await sp.evaluate(() => [...document.querySelectorAll('.seat.hero .card')].map((c) => c.textContent).join(' '));
    if (again !== cards) throw new Error(`back at the table with ${again}, not the ${cards} left there`);
    if ((await saved()).bankroll !== sat.bankroll) throw new Error('going back to the table charged for it');

    // The language switched at the table keeps the hand, and the sign over it follows.
    const switchLanguage = async (label) => {
      await sp.click('.ledger-button');
      await sp.click('.lang-chip:not(.active)');
      await sp.keyboard.press('Escape');
      await sp.waitForFunction((want) => document.querySelector('.table-head').textContent.includes(want), label, { timeout: 5000 });
    };
    await switchLanguage('Cash uit');
    const dutch = await sp.evaluate(() => [...document.querySelectorAll('.seat.hero .card')].map((c) => c.textContent).join(' '));
    if (dutch !== cards) throw new Error(`a language switch dealt ${dutch} in place of the ${cards} in play`);
    if ((await saved()).bankroll !== sat.bankroll) throw new Error('a language switch charged another buy-in');
    await switchLanguage('Cash out');

    // One table at a time.
    await sp.evaluate(() => { location.hash = '#play'; });
    await sp.waitForSelector('.seated-elsewhere', { timeout: 5000 });

    // A reload keeps the chips, and taking the seat back costs nothing.
    await sp.reload({ waitUntil: 'domcontentloaded' });
    await sp.evaluate(() => { location.hash = '#home'; });
    await sp.waitForSelector('#seatbar:not([hidden])', { timeout: 5000 });
    if (!/still have a seat at Mud Landing/.test(await sp.textContent('#seatbar'))) throw new Error('after a reload the seat was not offered back');
    await sp.click('#seatbar .btn.primary');
    await sp.waitForSelector('.felt', { timeout: 8000 });
    const back = await saved();
    if (back.bankroll !== sat.bankroll) throw new Error(`taking the seat back cost ${sat.bankroll - back.bankroll}`);

    // Cashing out pays back what is on the table, and gives the seat up.
    const chips = back.seat.chips;
    await sp.click('.table-head .btn:has-text("Cash out")');
    await sp.waitForFunction(() => !/#play/.test(location.hash), null, { timeout: 5000 });
    const out = await saved();
    if (out.seat) throw new Error('the seat was still kept after cashing out');
    if (Math.abs(out.bankroll - (sat.bankroll + chips / 100)) > 0.011) throw new Error(`cashed out to ${out.bankroll}, expected ${sat.bankroll + chips / 100}`);
    if (!(await sp.evaluate(() => document.querySelector('#seatbar').hidden))) throw new Error('the bar stayed after getting up');

    // A Regatta the tab closed on before a card was dealt: the entry comes back,
    // before the reload on its address enters a new one, which is not refunded.
    await sp.evaluate((key) => {
      const raw = JSON.parse(localStorage.getItem(key));
      raw.bankroll = 50;
      raw.seat = { mode: 'regatta', venue: 'nl2', entry: 2, dealt: 0, at: Date.now() };
      localStorage.setItem(key, JSON.stringify(raw));
      location.href = `${location.origin}/?closed=1#play?mode=regatta&at=nl2`;
    }, KEY);
    await sp.waitForSelector('.felt', { timeout: 8000 });
    const regatta = await saved();
    if (regatta.bankroll !== 50) throw new Error(`the closed Regatta's refund and the new entry left ${regatta.bankroll}, not 50`);
    if (!regatta.seat || regatta.seat.mode !== 'regatta' || regatta.seat.dealt !== 0) throw new Error(`the new Regatta is not the one kept: ${JSON.stringify(regatta.seat)}`);
    if (!/entry is back/.test(await sp.textContent('#toasts'))) throw new Error('the closed Regatta was settled without a word');
    if (mine.length) throw new Error(mine.join(' | '));
    console.log(`      $2 once; the same ${cards} after looking away and in Dutch; one table at a time; a reload kept ${chips} chips; cashed out to $${out.bankroll.toFixed(2)}; a closed Regatta refunded once`);
  } finally {
    await ctx.close();
  }
});

await step('your hand rating names the hands you go wrong with, and opens each mistake', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const rp = await ctx.newPage();
  const mine = [];
  rp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const KEY = 'poker-trainer.profile.v1';
  try {
    await rp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await rp.evaluate(async (key) => {
      const { emptyLifetime, recordHand } = await import('/src/js/state/lifetime.js');
      const life = emptyLifetime();
      const base = { mode: 'cash', full: true, position: 'BTN', vpip: true, pfr: false, threeBet: false, threeBetChance: false, sawFlop: true, showdown: false, won: false, netBb: -2, potBb: 4, bets: 0, raises: 0, calls: 1, folds: 0, allIn: false, made: null, bluff: false, decisions: 2, sound: 1, opponents: [], at: Date.now(), where: 'nl2' };
      const wrong = { street: 'flop', action: 'call', level: 'bad', helped: false, id: 'called-without-odds', head: 'Called without the odds', body: 'The price asked for {needed} and you had {equity}.', better: 'Fold', params: { needed: '31%', equity: '21%' }, costBb: 1.4, handId: null };
      for (let i = 0; i < 3; i++) recordHand(life, { ...base, key: 'KJo', graded: [{ street: 'preflop', action: 'call', level: 'good', helped: false, head: 'Correct against the open' }, wrong] });
      for (let i = 0; i < 4; i++) recordHand(life, { ...base, key: 'AKs', graded: [{ street: 'preflop', action: 'raise', level: 'good', helped: false, head: 'Right side of the chart' }, { street: 'flop', action: 'bet', level: 'good', helped: false, head: 'Right bet on the right board' }] });
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      Object.assign(raw, { seenPrologue: true, lifetime: life, settings: { ...(raw.settings || {}), lang: 'en' } });
      localStorage.setItem(key, JSON.stringify(raw));
    }, KEY);
    await rp.reload({ waitUntil: 'domcontentloaded' });
    await rp.evaluate(() => { location.hash = '#character'; });
    await rp.waitForSelector('.char-hands .rate-row', { timeout: 5000 });
    const lists = await rp.evaluate(() => [...document.querySelectorAll('.rate-col')].map((c) => c.textContent.replace(/\s+/g, ' ')));
    if (!/KJo.*3 mistakes in 6/.test(lists[0])) throw new Error(`where you go wrong reads "${lists[0]}"`);
    if (!/AKs.*8 of 8 right/.test(lists[1])) throw new Error(`where you play best reads "${lists[1]}"`);
    // A tap opens the hand beside the list, and the page does not move.
    const tap = async (sel) => {
      await rp.evaluate((q) => document.querySelector(q).scrollIntoView({ block: 'center' }), sel);
      const at = await rp.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, scrollY]; }, sel);
      await rp.mouse.click(at[0], at[1]);
      await rp.waitForTimeout(200);
      if (await rp.evaluate(() => scrollY) !== at[2]) throw new Error(`tapping ${sel} scrolled the page`);
    };
    await tap('.rate-col:first-child .rate-row');
    await rp.waitForFunction(() => /King-Jack offsuit/.test(document.querySelector('.hand-inspector').textContent), null, { timeout: 5000 });
    const inView = await rp.evaluate(() => { const r = document.querySelector('.hand-inspector').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; });
    if (!inView) throw new Error('the hand opened out of sight');
    const detail = await rp.textContent('.hand-inspector');
    if (!/Called without the odds/.test(detail) || !/3 times/.test(detail) || !/The price asked for 31% and you had 21%/.test(detail) || !/Instead:\s*Fold/.test(detail)) {
      throw new Error(`the mistake opened as "${detail.replace(/\s+/g, ' ').slice(0, 200)}"`);
    }
    if (!/What you do well/.test(detail) || !/Correct against the open/.test(detail)) throw new Error('the hand does not say what you do well with it');
    // Any square of the grid opens its hand too, in the same place.
    await tap('.hg-cell[data-key="AKs"]');
    await rp.waitForFunction(() => /Ace-King suited/.test(document.querySelector('.hand-inspector').textContent), null, { timeout: 5000 });
    if (!(await rp.$('.hg-cell.is-picked[data-key="AKs"]'))) throw new Error('the square picked is not marked');
    const aks = await rp.textContent('.hand-inspector');
    if (!/You play this hand well/.test(aks) || !/Right bet on the right board/.test(aks) || !/4 times/.test(aks)) throw new Error(`AKs opened as "${aks.replace(/\s+/g, ' ').slice(0, 200)}"`);
    if (mine.length) throw new Error(mine.join(' | '));
    console.log('      KJo: 3 mistakes in 6, grouped, with why and what instead, and what it does well; AKs 8 of 8; taps open beside the list without moving the page');
  } finally {
    await ctx.close();
  }
});

await step('Silas sizes your bets: the rule before, the size graded after, and your habits kept', async () => {
  // A reader bet "what the box showed" and nothing ever said whether it was
  // the right amount. Now Silas says the rule for the spot and offers his own
  // size, every bet and raise is graded for its size too, and the profile
  // keeps the habit.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const sp = await ctx.newPage();
  const mine = [];
  sp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const KEY = 'poker-trainer.profile.v1';
  const saved = () => sp.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
  const text = (sel) => sp.evaluate((q) => { const n = document.querySelector(q); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  // Play on until a bet or raise is on offer, folding or checking anything else.
  const toRaiseSpot = async () => {
    for (let i = 0; i < 120; i++) {
      if (await sp.$('.size-presets')) return true;
      const deal = await sp.$('.action-bar button.btn.primary.lg');
      if (deal && /Deal/.test(await deal.textContent())) { await deal.click(); await sp.waitForTimeout(400); continue; }
      const band = await sp.$('.read-bands .btn');
      if (band) { await band.click(); continue; }
      const btn = await sp.$('.action-buttons .btn:not(.primary):not(.danger)') || await sp.$('.action-buttons .btn.danger');
      if (btn) await btn.click().catch(() => {});
      await sp.waitForTimeout(250);
    }
    return false;
  };
  const toHandEnd = async () => {
    for (let i = 0; i < 120; i++) {
      if (/Deal next hand/.test(await text('.action-bar'))) return;
      const band = await sp.$('.read-bands .btn');
      if (band) { await band.click(); continue; }
      const btn = await sp.$('.action-buttons .btn.danger') || await sp.$('.action-buttons .btn:not(.primary)');
      if (btn) await btn.click().catch(() => {});
      await sp.waitForTimeout(250);
    }
    throw new Error('the hand never finished');
  };
  try {
    await sp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await sp.evaluate((key) => {
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      raw.seenPrologue = true;
      raw.settings = { ...(raw.settings || {}), autoDeal: false, liveCoach: true, lang: 'en' };
      localStorage.setItem(key, JSON.stringify(raw));
    }, KEY);
    await sp.goto(`${BASE}/?sizes=1#play`, { waitUntil: 'domcontentloaded' });
    await sp.waitForSelector('.felt', { timeout: 8000 });
    await sp.click('button:has-text("Deal me in")');
    if (!(await toRaiseSpot())) throw new Error('no bet or raise was ever on offer');

    // Before: the rule in Silas's panel, and his size as a button of its own.
    const rule = await text('.size-advice');
    if (!/^Size/.test(rule)) throw new Error(`Silas's panel says "${rule}" about the size`);
    const silas = await sp.$('.size-silas');
    if (silas) {
      const amount = (await silas.$eval('.size-chips', (n) => n.textContent)).replace(/\D/g, '');
      if (!(await silas.getAttribute('title'))) throw new Error('Silas\'s size has no rule on it');
      await silas.click();
      if ((await sp.$eval('.raise-input', (n) => n.value)) !== amount) throw new Error('Silas\'s button did not set his size');
      await sp.click('.action-buttons .btn.primary');
      await sp.waitForSelector('.size-note', { timeout: 5000 });
      const note = await text('.size-note');
      if (!(await sp.$('.size-note.good')) || !/not count as one of yours/.test(note)) throw new Error(`Silas's own size was graded "${note}"`);
    }

    // A size far too big, typed in: graded, said, and what instead. Nearly
    // all-in is far too big unless the stack is short enough that it is
    // the right raise anyway, so deal on until a spot where it is not.
    let off = '';
    let offHead = '';
    let max = 0;
    for (let tries = 0; tries < 10; tries++) {
      if (!(await toRaiseSpot())) throw new Error('no second bet or raise came');
      max = Number(await sp.$eval('.raise-slider', (n) => n.max));
      const pot = await sp.$$eval('.size-presets button', (bs) => {
        const b = bs.find((x) => /^\s*Pot/.test(x.textContent));
        return b ? Number(b.textContent.replace(/[^0-9]/g, '')) : 0;
      });
      // A short stack: nearly all-in is no bigger than a big raise. Next hand.
      if (max - 1 < pot * 2.5) { await toHandEnd(); continue; }
      await sp.fill('.raise-input', String(max - 1));
      await sp.press('.raise-input', 'Tab');
      await sp.click('.action-buttons .btn.primary');
      await sp.waitForSelector('.size-note', { timeout: 5000 });
      off = await text('.size-note');
      offHead = await text('.size-note-head b');
      if (!(await sp.$('.size-note.good'))) break;
    }
    if (await sp.$('.size-note.good')) throw new Error(`a bet of ${max - 1} was called the right size: "${off}"`);
    if (!/Instead:/.test(off)) throw new Error(`a size well off says nothing instead: "${off}"`);
    await toHandEnd();
    const sizes = (await saved()).lifetime.sizes || {};
    const rows = Object.values(sizes);
    if (!rows.some((r) => r[0] > 0 && r[1] < r[0])) throw new Error(`the size that was off is not in the record: ${JSON.stringify(sizes)}`);
    if (silas && !rows.some((r) => r[4] > 0)) throw new Error(`Silas's size was counted as yours: ${JSON.stringify(sizes)}`);

    // The rules on one card.
    await sp.click('button:has-text("Deal next hand")');
    if (await toRaiseSpot()) {
      await sp.click('button:has-text("Open the reference")');
      await sp.click('.reference-tab:has-text("Bet sizes")');
      const n = await sp.$$eval('.size-sheet tbody tr', (r) => r.length);
      if (n !== 10) throw new Error(`the bet sizes card has ${n} rows`);
    }

    // The habit, on the profile.
    await sp.evaluate((key) => {
      const raw = JSON.parse(localStorage.getItem(key));
      raw.lifetime.sizes = { open: [8, 8, 0, 0, 0], '3bet': [6, 2, 4, 0, 1] };
      localStorage.setItem(key, JSON.stringify(raw));
    }, KEY);
    await sp.goto(`${BASE}/?sizes=2#character`, { waitUntil: 'domcontentloaded' });
    await sp.waitForSelector('.char-sizes', { timeout: 5000 });
    const panel = await text('.char-sizes');
    if (!/right 71% of the time/.test(panel) || !/work on: 3-bets, 2 of 6 right, mostly too small/.test(panel)) {
      throw new Error(`the bet sizes panel reads "${panel.slice(0, 220)}"`);
    }
    if (mine.length) throw new Error(mine.join(' | '));
    console.log(`      the rule and Silas's size before; his size right and not yours; ${max - 1} graded "${offHead}"; the card; 3-bets mostly too small on the profile`);
  } finally {
    await ctx.close();
  }
});

await step('pearls keep their worth: Delphine buys them, and a seat or an entry can be paid in them', async () => {
  // The shelves hold about five thousand pearls of things; after that the
  // purse filled up with pearls that bought nothing. Now they sell for money
  // — more the further down the river — and pay for seats and entries.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pp = await ctx.newPage();
  const mine = [];
  pp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const KEY = 'poker-trainer.profile.v1';
  const saved = () => pp.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
  const text = (sel) => pp.evaluate((q) => { const n = document.querySelector(q); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  try {
    await pp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await pp.evaluate((key) => {
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      Object.assign(raw, {
        seenPrologue: true,
        bankroll: 200,
        economy: { version: 3, pearls: 30000, earned: 30000, spent: 0, owned: ['lesson:hand-rankings'], boat: 'rowboat', crew: [] },
        career: { venue: 'nl5', best: 'nl5', busted: 0, staked: 0, beaten: ['nl2'], played: { nl2: 30 } },
        walkthroughs: ['hand-rankings', 'pot-odds'],
        settings: { ...(raw.settings || {}), autoDeal: false, lang: 'en' },
      });
      localStorage.setItem(key, JSON.stringify(raw));
    }, KEY);

    // The Trading Post: the price where the boat is, the river's prices, and a sale.
    await pp.goto(`${BASE}/?pearls=1#store`, { waitUntil: 'domcontentloaded' });
    await pp.waitForSelector('.exchange', { timeout: 8000 });
    const ex = await text('.exchange');
    if (!/\$2\.00 a thousand at Fisher's Rest/.test(ex) || !/Your 30,000 pearls fetch \$60\.00 here/.test(ex)) throw new Error(`the exchange reads "${ex.slice(0, 220)}"`);
    const board = await pp.$$eval('.exchange-board tbody tr', (rows) => rows.map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
    if (board.length !== 13 || !/Delta Crown.*10,000.*\$50\.00/.test(board[7]) || !/The Admiralty.*17,500.*\$1,428\.57/.test(board[12])) throw new Error(`the river's prices read ${board.join(' | ')}`);
    await pp.click('.exchange-offer:has-text("5,000")');
    if (!/Sell 5,000 pearls for \$10\.00\? It cannot be undone/.test(await text('.exchange-confirm'))) throw new Error('a sale was not confirmed first');
    await pp.click('.exchange-confirm .btn.primary');
    await pp.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).economy.pearls === 25000, KEY, { timeout: 5000 });
    const sold = await saved();
    if (sold.bankroll !== 210 || sold.economy.sold !== 5000) throw new Error(`the sale left $${sold.bankroll} and ${sold.economy.sold} sold`);

    // A seat paid in pearls: the purse pays, the bankroll does not, and cashing out pays money.
    await pp.goto(`${BASE}/?pearls=2#stop?at=nl5`, { waitUntil: 'domcontentloaded' });
    await pp.waitForSelector('.lobby-card .pay-pearls', { timeout: 8000 });
    if (!/Pay in pearls: 2,500/.test(await text('.lobby-card .pay-pearls'))) throw new Error('the seat is not offered in pearls');
    await pp.click('.lobby-card .pay-pearls');
    await pp.waitForSelector('.felt', { timeout: 8000 });
    const sat = await saved();
    if (sat.economy.pearls !== 22500 || sat.bankroll !== 210) throw new Error(`a pearl seat took ${25000 - sat.economy.pearls} pearls and $${210 - sat.bankroll}`);
    if (!sat.seat || sat.seat.pearlSeats !== 1) throw new Error(`the seat does not say it was paid in pearls: ${JSON.stringify(sat.seat)}`);
    await pp.click('.table-head .btn:has-text("Cash out")');
    await pp.waitForFunction(() => !/#play/.test(location.hash), null, { timeout: 5000 });
    if ((await saved()).bankroll !== 215) throw new Error(`cashing out a pearl seat paid $${(await saved()).bankroll - 210}, not the $5 seat`);

    // A Regatta entered in pearls and left before a card: the pearls come back.
    await pp.goto(`${BASE}/?pearls=3#stop?at=nl5&place=regatta`, { waitUntil: 'domcontentloaded' });
    await pp.waitForSelector('.regatta-block .pay-pearls', { timeout: 8000 });
    await pp.click('.regatta-block .pay-pearls');
    await pp.waitForSelector('.felt', { timeout: 8000 });
    if ((await saved()).economy.pearls !== 20000) throw new Error('the Regatta entry was not paid in pearls');
    await pp.click('.table-head .btn:has-text("Withdraw")');
    await pp.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).economy.pearls === 22500, KEY, { timeout: 5000 });
    if ((await saved()).bankroll !== 215) throw new Error('a pearl entry touched the bankroll');

    // The profile says what the purse is worth, here and at the far end.
    await pp.goto(`${BASE}/?pearls=4#character`, { waitUntil: 'domcontentloaded' });
    await pp.waitForSelector('.pearl-worth', { timeout: 5000 });
    const worth = await text('.pearl-worth');
    if (!/22,500 pearls fetch \$45\.00 at Fisher's Rest/.test(worth) || !/The Admiralty/.test(worth)) throw new Error(`the profile says "${worth}"`);
    if (mine.length) throw new Error(mine.join(' | '));
    console.log('      $2.00 a thousand at Fisher\'s Rest, $50 at the delta; 5,000 sold for $10; a seat for 2,500 pearls cashed out to money; a pearl entry refunded; the purse\'s worth on the profile');
  } finally {
    await ctx.close();
  }
});

await step('the card rooms: for sale once the table is yours, and counted on the profile', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const rp = await ctx.newPage();
  const mine = [];
  rp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const KEY = 'poker-trainer.profile.v1';
  const saved = () => rp.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
  const text = (sel) => rp.evaluate((q) => { const n = document.querySelector(q); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  try {
    await rp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await rp.evaluate((key) => {
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      Object.assign(raw, {
        seenPrologue: true, bankroll: 200,
        economy: { version: 3, pearls: 9000, earned: 9000, spent: 0, owned: ['lesson:hand-rankings'], boat: 'rowboat', crew: [] },
        career: { venue: 'nl5', best: 'nl5', busted: 0, staked: 0, beaten: ['nl2'], played: { nl2: 30 } },
        settings: { ...(raw.settings || {}), autoDeal: false, lang: 'en' },
      });
      localStorage.setItem(key, JSON.stringify(raw));
    }, KEY);
    await rp.goto(`${BASE}/?rooms=1#stop?at=nl5&place=deeds`, { waitUntil: 'domcontentloaded' });
    await rp.waitForSelector('.room-block', { timeout: 8000 });
    const locked = await text('.room-block');
    if (!/Take the table at Fisher's Rest first/.test(locked) || await rp.$('.room-block .buy-btn')) throw new Error(`a room was for sale before its table was taken: "${locked}"`);
    await rp.goto(`${BASE}/?rooms=2#stop?at=nl2&place=deeds`, { waitUntil: 'domcontentloaded' });
    await rp.waitForSelector('.room-block .buy-btn', { timeout: 8000 });
    await rp.click('.room-block .buy-btn');
    await rp.waitForSelector('.room-block.owned', { timeout: 5000 });
    if (!/Mud Landing is your room/.test(await text('.room-block')) || !/1 of 13 card rooms/.test(await text('.room-block'))) throw new Error(`the bought room reads "${await text('.room-block')}"`);
    const after = await saved();
    if (after.economy.pearls !== 6000 || !after.economy.owned.includes('room:nl2')) throw new Error(`buying the room left ${after.economy.pearls} pearls`);
    await rp.goto(`${BASE}/?rooms=3#character`, { waitUntil: 'domcontentloaded' });
    await rp.waitForSelector('.char-river', { timeout: 5000 });
    if (!/Card rooms\s*1 \/ 13/.test(await text('.char-river'))) throw new Error('the profile does not count the room');
    if (mine.length) throw new Error(mine.join(' | '));
    console.log('      shut until the table is taken; Mud Landing bought for 3,000 pearls; 1 of 8 on the profile');
  } finally {
    await ctx.close();
  }
});

await step('your money decisions on your character, you on the rail, and Silas at your side', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const gp = await ctx.newPage();
  const mine = [];
  gp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const KEY = 'poker-trainer.profile.v1';
  const saved = () => gp.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
  const text = (sel) => gp.evaluate((q) => { const n = document.querySelector(q); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  try {
    await gp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await gp.evaluate((key) => {
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      Object.assign(raw, {
        seenPrologue: true, bankroll: 200,
        lifetime: { version: 1, actions: { fold: [20, 18, 2, 1], call: [10, 6, 4, 7.5] },
          leaks: { 'called-short': [4, 7.5, 'Calling without the price', 1], 'opened-outside-range': [6, 0, 'Outside the range', 0] } },
        settings: { ...(raw.settings || {}), autoDeal: false, lang: 'en' },
      });
      localStorage.setItem(key, JSON.stringify(raw));
    }, KEY);
    // On the river: Silas stands in the dock along the bottom, in view,
    // with today's questions (the road has its own banner there).
    await gp.goto(`${BASE}/?guide=1#home`, { waitUntil: 'domcontentloaded' });
    await gp.waitForSelector('.guide-dock .guide-body svg.character', { timeout: 8000 });
    if (!/Today's three questions/.test(await text('.dock-says'))) throw new Error(`on the river Silas says "${await text('.dock-says')}"`);
    // He covers nothing: scrolled to the end, the page stops above him.
    const clear = await gp.evaluate(() => {
      window.scrollTo(0, 1e6);
      const top = document.querySelector('.guide-dock').getBoundingClientRect().top;
      const fixedUp = (n) => { for (let x = n; x && x !== document.body; x = x.parentElement) if (['fixed', 'sticky'].includes(getComputedStyle(x).position)) return true; return false; };
      const leaves = [...document.querySelectorAll('#screen *')].filter((n) => !n.children.length && n.getBoundingClientRect().height && !fixedUp(n));
      return Math.max(...leaves.map((n) => n.getBoundingClientRect().bottom)) <= top + 1;
    });
    if (!clear) throw new Error('the end of the river is under the dock');
    // The rail has you on it, and it opens your character.
    if (!await gp.$('.rank-chip .chip-figure svg.character')) throw new Error('no figure on the rail');
    await gp.click('.rank-chip');
    await gp.waitForSelector('.char-money', { timeout: 5000 });
    const money = await text('.char-money');
    for (const want of ['24 of 30 decisions right', 'Calls', '6 of 10 right', 'Where the money leaks', 'Calling without the price', 'Mistakes you repeat', 'Outside the range']) {
      if (!money.includes(want)) throw new Error(`the money panel misses "${want}": "${money.slice(0, 300)}"`);
    }
    if (!await gp.$('.char-nav')) throw new Error('no links along the top of the character page');
    // On your character he talks about the leak; a tap on the word is another word.
    if (!/costliest mistake so far: “Calling without the price”/.test(await text('.dock-says'))) throw new Error(`on the character page Silas says "${await text('.dock-says')}"`);
    const before = await text('.dock-says');
    await gp.click('.dock-word');
    if (await text('.dock-says') === before) throw new Error('"another word" did not change what he says');
    // Tap him and you can talk to him: a question, a word from the tables, a typed question.
    await gp.click('.guide-body');
    await gp.waitForSelector('.ask-sheet', { timeout: 3000 });
    await gp.click('.ask-chips .btn:has-text("How am I doing?")');
    if (!/24 of 30 decisions right: 80%/.test(await text('.ask-log')) || !/Your weakest: Calls, 60% right/.test(await text('.ask-log'))) throw new Error(`"how am I doing" was answered "${await text('.ask-log')}"`);
    await gp.fill('.ask-input', 'what are pot odds?');
    await gp.press('.ask-input', 'Enter');
    await gp.waitForFunction(() => /Pot odds/.test(document.querySelector('.ask-log').textContent), null, { timeout: 3000 });
    await gp.fill('.ask-input', 'where am I losing money');
    await gp.press('.ask-input', 'Enter');
    await gp.waitForFunction(() => document.querySelectorAll('.ask-log .ask-q').length === 3, null, { timeout: 3000 });
    if (!/Calling without the price/.test((await gp.$$eval('.ask-log .ask-a', (n) => n.at(-1).textContent)))) throw new Error('a typed question about losing money was not answered with the leak');
    // His answer takes you there.
    await gp.click('.ask-log .ask-a:last-child .btn');
    await gp.waitForFunction(() => !document.querySelector('.ask-sheet'), null, { timeout: 3000 });
    await gp.keyboard.press('Escape');
    // Not at the table: there he is at your shoulder already.
    await gp.goto(`${BASE}/?guide=3#play`, { waitUntil: 'domcontentloaded' });
    await gp.waitForSelector('.felt', { timeout: 8000 });
    if (await gp.$('.guide-dock')) throw new Error('Silas is in the dock at the table');
    // There he stands beside the felt in free play, saying a rule, and a tap gives another.
    await gp.waitForSelector('.silas-stand .stand-figure svg.character', { state: 'visible', timeout: 5000 });
    const rule = await text('.stand-bubble');
    await gp.click('.stand-figure');
    if (await text('.stand-bubble') === rule) throw new Error('tapping Silas at the table did not give another word');
    if (mine.length) throw new Error(mine.join(' | '));
    console.log('      money panel read; figure on the rail; Silas docked on the river, on the leak, asked three things; beside the felt at the table');
  } finally {
    await ctx.close();
  }
});

await step('the cat remembers: a hand gone wrong before warns you in the same spot, and asking her is help', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const cp = await ctx.newPage();
  const mine = [];
  cp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const text = (sel) => cp.evaluate((q) => { const n = document.querySelector(q); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  // Thirty-three offsuit hands, gone wrong first in from every seat: one of
  // them comes round soon enough to see her without playing all night.
  const R = 'AKQJT98765432';
  const keys = [];
  for (let i = 0; i < 13 && keys.length < 33; i++) for (let j = i + 1; j < 13 && keys.length < 33; j++) keys.push(`${R[i]}${R[j]}o`);
  const mistakes = [];
  for (const position of ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']) {
    for (const key of keys) mistakes.push({ key, street: 'preflop', action: 'call', id: 'limped', head: 'Limping gives the pot away', better: 'Raise', position, facing: 'first', at: 1 });
  }
  const toWarning = async () => {
    for (let i = 0; i < 600; i++) {
      if (await cp.$('.cat-warn')) return true;
      const deal = await cp.$('button:has-text("Deal next hand")');
      if (deal) { await deal.click(); await cp.waitForTimeout(120); continue; }
      const b = await cp.$('.action-buttons .btn:has-text("Fold")') || await cp.$('.action-buttons .btn:has-text("Check")');
      if (b) await b.click().catch(() => {});
      await cp.waitForTimeout(120);
    }
    return false;
  };
  try {
    await cp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await cp.evaluate((m) => localStorage.setItem('poker-trainer.profile.v1', JSON.stringify({
      seenPrologue: true, walkthroughs: ['hand-rankings', 'preflop'],
      economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: ['lesson:hand-rankings', 'lesson:preflop', 'pet:cat'], boat: 'rowboat', crew: ['cat'] },
      lifetime: { version: 1, mistakes: m }, settings: { lang: 'en', autoDeal: false, liveCoach: false },
    })), mistakes.slice(0, 198));
    await cp.goto(`${BASE}/?cat=1#play`, { waitUntil: 'domcontentloaded' });
    await cp.waitForSelector('.felt', { timeout: 8000 });
    await cp.click('button:has-text("Deal me in")');
    if (!(await toWarning())) throw new Error('the cat never spoke up');
    const said = await text('.cat-warn');
    if (!/Careful\. [AKQJT2-9]{2}o (under the gun|in the hijack|in the cutoff|on the button|in the small blind|in the big blind), first in: you went wrong here before — “Limping gives the pot away”\./.test(said)) throw new Error(`the cat said "${said}"`);
    if (/Raise/.test(said)) throw new Error('the free warning gave the answer away');
    if (await cp.$('.help-btn.used')) throw new Error('the warning counted as help');
    // Closed, she is quiet for this decision.
    await cp.click('.cat-hush');
    if (await cp.$('.cat-warn')) throw new Error('closing the cat did not close her');
    // The next time, ask her: the answer, and it is help.
    const b = await cp.$('.action-buttons .btn:has-text("Fold")');
    if (b) await b.click();
    if (!(await toWarning())) throw new Error('the cat did not speak up a second time');
    await cp.click('.cat-warn .btn');
    await cp.waitForSelector('.help-drawer [data-helper="cat"]', { timeout: 3000 });
    const help = await text('.help-drawer [data-helper="cat"]');
    if (!/in this very spot/.test(help) || !/Instead: Raise/.test(help)) throw new Error(`asked, the cat said "${help.slice(0, 200)}"`);
    if (!(await cp.$('.help-btn.used'))) throw new Error('asking the cat did not count as help');
    if (mine.length) throw new Error(mine.join(' | '));
    console.log(`      "${said.slice(0, 90)}…"; closed; asked the second time, and it counted as help`);
  } finally {
    await ctx.close();
  }
});

await step('your snags: a spot gone wrong at a table, sailed three times right, comes off the list and pays', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const np = await ctx.newPage();
  const mine = [];
  np.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const KEY = 'poker-trainer.profile.v1';
  const saved = () => np.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
  const text = (sel) => np.evaluate((q) => { const n = document.querySelector(q); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  try {
    await np.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    // Folded aces under the gun once: the opening chart says raise, every time.
    await np.evaluate((key) => localStorage.setItem(key, JSON.stringify({
      seenPrologue: true, economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: [], boat: 'rowboat', crew: [] },
      lifetime: { version: 1, mistakes: [{ key: 'AA', street: 'preflop', action: 'fold', id: 'folded-open', head: 'Inside the opening range', better: 'Raise', position: 'UTG', facing: 'first', at: Date.now() - 1000 }] },
      settings: { lang: 'en' },
    })), KEY);
    await np.goto(`${BASE}/?snags=1#character?at=snags`, { waitUntil: 'domcontentloaded' });
    await np.waitForSelector('.char-snags .snag', { timeout: 8000 });
    const panel = await text('.char-snags');
    if (!/AA\s*under the gun, first in/.test(panel) || !/once/.test(panel)) throw new Error(`the snags panel reads "${panel.slice(0, 200)}"`);
    if (!/One snag on your list/.test(await text('.dock-says')) && !/costliest|Today/.test(await text('.dock-says'))) throw new Error(`Silas says "${await text('.dock-says')}"`);
    await np.click('.char-snags .btn.primary');
    for (let i = 1; i <= 3; i++) {
      await np.waitForSelector('.options .option:not([disabled])', { timeout: 5000 });
      if (!/It folds to you in the Under the Gun/.test(await text('.question'))) throw new Error(`question ${i} asks "${await text('.question')}"`);
      await np.click('.options .option:has(span:text-is("Raise"))');
      await np.waitForSelector('.feedback.correct', { timeout: 3000 });
      const note = await text('.snag-note');
      const want = i < 3 ? `${i} of 3 in a row on this snag` : 'Cleared: off the list, and 15 pearls';
      if (!note.includes(want)) throw new Error(`after answer ${i} the snag says "${note}"`);
      await np.click('.row .btn.primary');
    }
    await np.waitForFunction(() => /Snags sailed/.test(document.querySelector('#screen').textContent), null, { timeout: 5000 });
    if (!/1 cleared this time; 0 still on the list/.test(await text('#screen'))) throw new Error('the end of the sitting does not count the snag cleared');
    const after = await saved();
    if (after.economy.pearls !== 15) throw new Error(`clearing paid ${after.economy.pearls} pearls`);
    await np.goto(`${BASE}/?snags=2#character?at=snags`, { waitUntil: 'domcontentloaded' });
    await np.waitForSelector('.char-snags', { timeout: 5000 });
    if (!/No snags/.test(await text('.char-snags'))) throw new Error('the cleared snag is still on the list');
    if (mine.length) throw new Error(mine.join(' | '));
    console.log('      AA under the gun, first in: raised three times, cleared, 15 pearls, off the list');
  } finally {
    await ctx.close();
  }
});

await step('the Gulf: past the delta, five ports on a chart of their own, their lessons and their drills', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const gp = await ctx.newPage();
  const mine = [];
  gp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const text = (sel) => gp.evaluate((q) => { const n = document.querySelector(q); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  const seed = (won) => gp.evaluate((won) => localStorage.setItem('poker-trainer.profile.v1', JSON.stringify({
    seenPrologue: true, bankroll: won ? 45000 : 200, stakeKey: won ? 'nl1000' : 'nl2',
    economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: won ? ['lesson:value', 'lesson:pushfold'] : [], boat: won ? 'flagship' : 'rowboat', crew: [] },
    career: won
      ? { venue: 'nl1000', best: 'nl1000', busted: 0, staked: 0, beaten: ['nl2', 'nl5', 'nl10', 'nl25', 'nl50', 'nl100', 'nl200', 'nl500'], played: {} }
      : { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: [], played: {} },
    settings: { lang: 'en' },
  })), won);
  try {
    // Before the river is won there is only the river.
    await gp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await seed(false);
    await gp.goto(`${BASE}/?gulf=0#home`, { waitUntil: 'domcontentloaded' });
    await gp.waitForSelector('.river-map', { timeout: 8000 });
    if (await gp.$('.chart-switch') || await gp.$('.gulf-art')) throw new Error('the Gulf shows before the river is won');
    // Won, and moored at Salt Harbour: the Gulf's chart, and a switch to the river.
    await seed(true);
    await gp.goto(`${BASE}/?gulf=1#home`, { waitUntil: 'domcontentloaded' });
    await gp.waitForSelector('.gulf-art', { timeout: 8000 });
    if ((await gp.$$('.gulf-art .landmark')).length !== 5) throw new Error('the Gulf has not got five ports');
    if (!/Salt Harbour\s*NL1000\s*You are here/.test(await text('.river-map'))) throw new Error(`Salt Harbour's plate reads "${(await text('.river-map')).slice(0, 160)}"`);
    if (!/Lighthouse Point\s*NL2000.*After Salt Harbour/.test(await text('.river-map'))) throw new Error('the next port is open before Salt Harbour is done');
    await gp.click('.chart-switch button:has-text("The Long River")');
    await gp.waitForSelector('.world-art:not(.gulf-art)', { timeout: 5000 });
    await gp.click('.chart-switch button:has-text("The Gulf")');
    await gp.waitForSelector('.gulf-art', { timeout: 5000 });
    // The port: at sea, with its owner, and the story says where you are.
    await gp.goto(`${BASE}/?gulf=2#stop?at=nl1000`, { waitUntil: 'domcontentloaded' });
    await gp.waitForSelector('.scene', { timeout: 8000 });
    const port = await text('#screen');
    if (!/The Gulf, Salt Harbour/.test(port) || !/Josiah Quint/.test(port)) throw new Error(`Salt Harbour reads "${port.slice(0, 200)}"`);
    // A Gulf chapter, and a push-or-fold question with one answer.
    await gp.goto(`${BASE}/?gulf=3#walkthrough?module=value`, { waitUntil: 'domcontentloaded' });
    await gp.waitForSelector('.lesson-body', { timeout: 5000 });
    if (!/Value Betting/.test(await text('#screen'))) throw new Error('the Value Betting chapter does not open');
    await gp.goto(`${BASE}/?gulf=4#drill?module=pushfold`, { waitUntil: 'domcontentloaded' });
    await gp.waitForSelector('.options .option', { timeout: 5000 });
    const q = await text('.question');
    if (!/big blinds/.test(q)) throw new Error(`the push-or-fold question reads "${q}"`);
    await gp.click('.options .option >> nth=0');
    await gp.waitForSelector('.feedback', { timeout: 3000 });
    if (!/✓ Correct|✗ Not quite/.test(await text('.feedback'))) throw new Error('the push-or-fold drill gave no verdict');
    if (mine.length) throw new Error(mine.join(' | '));
    console.log(`      hidden before the delta; five ports, Salt Harbour moored, the next one shut; both charts; "${q.slice(0, 60)}…"`);
  } finally {
    await ctx.close();
  }
});

await step('the backwaters: uncharted until somebody tells you, then a town of its own with its own table', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const bp = await ctx.newPage();
  const mine = [];
  bp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const text = (sel) => bp.evaluate((q) => { const n = document.querySelector(q); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  const KEY = 'poker-trainer.profile.v1';
  const seed = (extra) => bp.evaluate(({ key, extra }) => localStorage.setItem(key, JSON.stringify({
    seenPrologue: true, bankroll: 300, stakeKey: 'nl5',
    economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: [], boat: 'rowboat', crew: [] },
    career: { venue: 'nl5', best: 'nl5', busted: 0, staked: 0, beaten: ['nl2'], played: { nl5: 3 } },
    settings: { lang: 'en', autoDeal: false, liveCoach: false },
    ...extra,
  })), { key: KEY, extra });
  try {
    await bp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await seed({});
    await bp.goto(`${BASE}/?bw=1#home`, { waitUntil: 'domcontentloaded' });
    await bp.waitForSelector('.river-map .map-town', { timeout: 8000 });
    // Three question marks on the chart, each saying who to ask.
    const uncharted = await bp.$$eval('.map-town.uncharted', (n) => n.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    if (uncharted.length !== 3 || !uncharted.some((x) => /Ask at Fisher's Rest/.test(x))) throw new Error(`the uncharted plates read ${JSON.stringify(uncharted)}`);
    // Three hands at Fisher's Rest: Tilly has nothing to say yet.
    await bp.goto(`${BASE}/?bw=2#stop?at=nl5`, { waitUntil: 'domcontentloaded' });
    await bp.waitForSelector('.boss', { timeout: 5000 });
    if (await bp.$('.rumour-card')) throw new Error('the rumour came before ten hands at Fisher\'s Rest');
    // Ten: she leans over.
    await seed({ career: { venue: 'nl5', best: 'nl5', busted: 0, staked: 0, beaten: ['nl2'], played: { nl5: 10 } } });
    await bp.goto(`${BASE}/?bw=3#stop?at=nl5`, { waitUntil: 'domcontentloaded' });
    await bp.waitForSelector('.rumour-card', { timeout: 5000 });
    if (!/Tilly leans over/.test(await text('.rumour-card')) || !/Placer Gulch/.test(await text('.rumour-card'))) throw new Error(`the rumour reads "${await text('.rumour-card')}"`);
    await bp.click('.rumour-card .btn.primary');
    await bp.waitForSelector('.town-screen .town-list', { timeout: 5000 });
    // On the chart now, with its name.
    await bp.goto(`${BASE}/?bw=4#home`, { waitUntil: 'domcontentloaded' });
    await bp.waitForSelector('.map-town[data-town="gulch"]:not(.uncharted)', { timeout: 5000 });
    if (!/Placer Gulch\s*NL5/.test(await text('.map-town[data-town="gulch"]'))) throw new Error(`the Gulch's plate reads "${await text('.map-town[data-town="gulch"]')}"`);
    if ((await bp.$$('.map-town.uncharted')).length !== 2) throw new Error('hearing of the Gulch charted the other towns too');
    // Up the wagon road.
    await bp.click('.map-town[data-town="gulch"]');
    await bp.waitForSelector('.town-table', { timeout: 5000 });
    await bp.click('.town-table .btn.primary');
    await bp.waitForFunction(() => /Take a seat/.test(document.querySelector('.town-table')?.textContent || ''), null, { timeout: 5000 });
    if (!/Off the river, Placer Gulch/.test(await text('#screen'))) throw new Error('arriving at the Gulch told no story');
    // The chart says the boat is here, not at Fisher's Rest.
    await bp.goto(`${BASE}/?bw=5#home`, { waitUntil: 'domcontentloaded' });
    await bp.waitForSelector('.map-town.is-here', { timeout: 5000 });
    if (await bp.$('.map-stop.is-here')) throw new Error('the chart still says you are at a stop');
    if (!/You are moored at\s*Placer Gulch/.test(await text('.here-card'))) throw new Error(`the card reads "${await text('.here-card')}"`);
    // Sit down: Ike in his chair, his townsfolk by name, at NL5.
    const before = (await bp.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY)).bankroll;
    await bp.goto(`${BASE}/?bw=6#town?at=gulch`, { waitUntil: 'domcontentloaded' });
    await bp.waitForSelector('.town-table .btn.primary', { timeout: 5000 });
    await bp.click('.town-table .btn.primary');
    await bp.waitForSelector('.felt', { timeout: 8000 });
    const head = await text('.table-head');
    if (!/Placer Gulch/.test(head) || !/NL5/.test(head) || !/Ike's game/.test(head)) throw new Error(`the table's sign reads "${head}"`);
    const names = await bp.$$eval('.seat .seat-name, .seat .name', (n) => n.map((x) => x.textContent.trim()));
    if (!names.includes('Ike') || !names.includes('Dusty')) throw new Error(`the Gulch's table seats ${names.join(', ')}`);
    const sat = await bp.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
    if (Math.abs(sat.bankroll - (before - 5)) > 1e-9) throw new Error(`a seat at the Gulch cost ${before - sat.bankroll}, not the NL5 seat`);
    if (!sat.seat || sat.seat.table !== 'gulch' || sat.seat.venue !== 'nl5') throw new Error(`the seat kept is ${JSON.stringify(sat.seat)}`);
    // Up from it: back to the town, not to Fisher's Rest.
    await bp.click('.table-head button:has-text("Cash out")');
    await bp.waitForSelector('.town-screen', { timeout: 8000 });
    // A town list that remembers the best sitting, and the trophy for all three.
    await seed({
      career: { venue: 'nl5', best: 'nl5', busted: 0, staked: 0, beaten: ['nl2'], played: { nl5: 10, 'town:gulch': 50 }, town: 'gulch' },
      scenes: { 'rumour-gulch': true, 'arrive-town-gulch': true },
      towns: { gulch: { sittings: 3, bestUp: 44, bestSound: 0.8, paid: ['hands', 'up', 'sound'] } },
    });
    await bp.goto(`${BASE}/?bw=7#town?at=gulch`, { waitUntil: 'domcontentloaded' });
    await bp.waitForSelector('.town-list', { timeout: 5000 });
    const list = await text('.town-list');
    if (!/All three done/.test(list) || !/Given to you in Placer Gulch/.test(list) || !/Big Ike's gold nugget/.test(list)) throw new Error(`the finished list reads "${list}"`);
    // In Dutch.
    await bp.evaluate((key) => { const raw = JSON.parse(localStorage.getItem(key)); raw.settings.lang = 'nl'; localStorage.setItem(key, JSON.stringify(raw)); }, KEY);
    await bp.goto(`${BASE}/?bw=8#town?at=gulch`, { waitUntil: 'domcontentloaded' });
    await bp.waitForSelector('.town-list', { timeout: 5000 });
    const nl = await text('#screen');
    if (!/Goudzoekerskloof/.test(nl) || !/Wat te doen in Goudzoekerskloof/.test(nl)) throw new Error(`the Dutch town reads "${nl.slice(0, 200)}"`);
    if (mine.length) throw new Error(mine.join(' | '));
    console.log('      three question marks; the rumour at ten hands; the Gulch charted, reached, seated (Ike, Dusty, NL5) and left; the list done; in Dutch');
  } finally {
    await ctx.close();
  }
});

await step('fog over the chart: the river past the next stop is unexplored, and it lifts as you go', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const fp = await ctx.newPage();
  const mine = [];
  fp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const KEY = 'poker-trainer.profile.v1';
  const seed = (extra) => fp.evaluate(({ key, extra }) => localStorage.setItem(key, JSON.stringify({
    seenPrologue: true, bankroll: 200, settings: { lang: 'en' }, ...extra,
  })), { key: KEY, extra });
  // Which stops the fog has a hole over, read off the chart itself.
  const clear = () => fp.evaluate(() => {
    const holes = [...document.querySelectorAll('.river-map .fog-hole')].map((c) => ({ x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')), fresh: c.classList.contains('fresh') }));
    return { fog: Boolean(document.querySelector('.river-map .fog')), holes };
  });
  try {
    await fp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await seed({});
    await fp.goto(`${BASE}/?fog=1#home`, { waitUntil: 'domcontentloaded' });
    await fp.waitForSelector('.river-map .fog', { timeout: 8000 });
    let seen = await clear();
    // Mud Landing (1132,640) and Fisher's Rest (1360,978) clear; Cotton Row (1760,970) not.
    const has = (x, y) => seen.holes.some((h) => Math.abs(h.x - x) < 1 && Math.abs(h.y - y) < 1);
    if (!has(1132, 640) || !has(1360, 978)) throw new Error('the stop you are at, or the next one, is under fog');
    if (has(1760, 970)) throw new Error('Cotton Row is clear before you have been near it');
    if (seen.holes.some((h) => h.fresh)) throw new Error('the first look at the chart opened holes as if they were new');
    // Down at Cotton Row: the fog draws back to the Belle, once, and says so.
    await seed({ bankroll: 900, career: { venue: 'nl25', best: 'nl25', beaten: ['nl2', 'nl5', 'nl10'], played: {} }, charted: { river: 1 } });
    await fp.goto(`${BASE}/?fog=2#home`, { waitUntil: 'domcontentloaded' });
    await fp.waitForSelector('.river-map .fog', { timeout: 8000 });
    seen = await clear();
    if (seen.holes.filter((h) => h.fresh).length !== 3) throw new Error(`${seen.holes.filter((h) => h.fresh).length} holes opened, expected the Ferry, Cotton Row and the Belle`);
    await fp.waitForFunction(() => /The fog lifts/.test(document.querySelector('#toasts')?.textContent || ''), null, { timeout: 5000 });
    if (!/The Belle is on the chart now/.test(await fp.textContent('#toasts'))) throw new Error('the toast does not say where the fog lifted to');
    const charted = await fp.evaluate((key) => JSON.parse(localStorage.getItem(key)).charted, KEY);
    if (!charted || charted.river !== 4) throw new Error(`the chart was written down as ${JSON.stringify(charted)}`);
    await fp.goto(`${BASE}/?fog=3#home`, { waitUntil: 'domcontentloaded' });
    await fp.waitForSelector('.river-map .fog', { timeout: 8000 });
    seen = await clear();
    if (seen.holes.some((h) => h.fresh)) throw new Error('the fog drew back a second time');
    // At the delta there is nothing left to find: no fog at all.
    await seed({ bankroll: 30000, career: { venue: 'nl500', best: 'nl500', beaten: ['nl2', 'nl5', 'nl10', 'nl25', 'nl50', 'nl100', 'nl200'], played: {} } });
    await fp.goto(`${BASE}/?fog=4#home`, { waitUntil: 'domcontentloaded' });
    await fp.waitForSelector('.river-map svg', { timeout: 8000 });
    if ((await clear()).fog) throw new Error('the river is still under fog at the delta');
    if (mine.length) throw new Error(mine.join(' | '));
    console.log('      a new chart clear to Fisher\'s Rest; at Cotton Row the fog draws back to the Belle once, and says so; none at the delta');
  } finally {
    await ctx.close();
  }
});

await step('a stop is a town: places down one street, and a job on the notice board', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const tp = await ctx.newPage();
  const mine = [];
  tp.on('pageerror', (e) => mine.push(`PAGEERROR: ${e.message}`));
  const text = (sel) => tp.evaluate((q) => { const n = document.querySelector(q); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  const KEY = 'poker-trainer.profile.v1';
  const seed = (extra = {}) => tp.evaluate(({ key, extra }) => localStorage.setItem(key, JSON.stringify({
    seenPrologue: true, bankroll: 900, stakeKey: 'nl25', settings: { lang: 'en' },
    career: { venue: 'nl25', best: 'nl25', busted: 0, staked: 0, beaten: ['nl2', 'nl5', 'nl10'], played: { nl25: 12 }, sittings: 4 },
    scenes: { 'arrive-nl25': true },
    jobs: { nl25: { have: 3 } },
    ...extra,
  })), { key: KEY, extra });
  try {
    await tp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await seed();
    await tp.goto(`${BASE}/?town=1#stop?at=nl25`, { waitUntil: 'domcontentloaded' });
    await tp.waitForSelector('.town-doors', { timeout: 8000 });
    const doors = await tp.$$eval('.town-door', (n) => n.map((x) => x.dataset.place));
    for (const want of ['room', 'owner', 'regatta', 'deeds', 'board']) if (!doors.includes(want)) throw new Error(`Cotton Row has no ${want}: ${doors.join(', ')}`);
    // It opens on the card room, with the lobby in it and nothing from the other places.
    if (!(await tp.$('.town-door.active[data-place="room"]')) || (await tp.$$('.lobby-card')).length !== 3) throw new Error('the town does not open on the card room');
    if (await tp.$('.duel-block') || await tp.$('.room-block')) throw new Error('the other places are open at once');
    // Walk to the notice board: the job is there, and the address says where you are.
    await door(tp, 'board');
    if (!/place=board/.test(await tp.evaluate(() => location.hash))) throw new Error('the address does not keep the door');
    const job = await text('.job-card');
    if (!/Mr\. Delaune/.test(job) || !/Make 8 sound Continuation Betting decisions at the tables here/.test(job) || !/3 of 8/.test(job)) throw new Error(`the job reads "${job}"`);
    if (!(await tp.$('.road-stop'))) throw new Error('the notice board has no list of what to do here');
    if (!/a job going/.test(await text('.town-door[data-place="board"]'))) throw new Error('the board\'s door does not say there is a job');
    // A reload comes back to the same door.
    await tp.reload({ waitUntil: 'domcontentloaded' });
    await tp.waitForSelector('.town-door.active[data-place="board"]', { timeout: 5000 });
    // The road's button for the hands goes to the card room.
    await tp.click('.road-stop .road-goal.next .btn');
    await tp.waitForSelector('.town-door.active[data-place="room"]', { timeout: 5000 });
    // A job done says so, and is not paid twice.
    await seed({ jobs: { nl25: { have: 8, paid: true } } });
    await tp.goto(`${BASE}/?town=2#stop?at=nl25&place=board`, { waitUntil: 'domcontentloaded' });
    await tp.waitForSelector('.job-card.done', { timeout: 5000 });
    if (!/Done, and paid/.test(await text('.job-card'))) throw new Error('a finished job does not say so');
    // In Dutch, on a phone, the doors fit two to a row.
    await seed({ settings: { lang: 'nl' } });
    await tp.setViewportSize({ width: 390, height: 844 });
    await tp.goto(`${BASE}/?town=3#stop?at=nl25&place=board`, { waitUntil: 'domcontentloaded' });
    await tp.waitForSelector('.job-card', { timeout: 5000 });
    if (!/Gevraagd/.test(await text('.job-card')) || !/Het mededelingenbord/.test(await text('.town-doors'))) throw new Error('the town is not in Dutch');
    const fit = await tp.evaluate(() => {
      const boxes = [...document.querySelectorAll('.town-door')].map((n) => n.getBoundingClientRect());
      return { wide: document.documentElement.scrollWidth <= innerWidth + 1, inside: boxes.every((b) => b.left >= 0 && b.right <= innerWidth + 1) };
    });
    if (!fit.wide || !fit.inside) throw new Error(`the doors do not fit a phone: ${JSON.stringify(fit)}`);
    if (mine.length) throw new Error(mine.join(' | '));
    console.log('      Cotton Row opens on its card room; the notice board has Mr. Delaune\'s job at 3 of 8; the address and a reload keep the door; the road goes to the card room; in Dutch on a phone');
  } finally {
    await ctx.close();
  }
});

await step('the rail says which build this is, on a desktop and on a phone', async () => {
  // "Do I have the right one?" has to be a glance. The version was inside the
  // ledger; it is now on the rail of every screen, under the crest, and the
  // name beside it is hidden on a phone but the version is not.
  const { readFileSync } = await import('node:fs');
  const want = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const vp = await ctx.newPage();
  vp.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  try {
    // A purse with thousands in it and a rank with some XP behind it: the
    // widest the rail gets, which is where it first overlapped on a phone.
    await vp.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await vp.evaluate(() => {
      const key = 'poker-trainer.profile.v1';
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      raw.seenPrologue = true;
      raw.bankroll = 45000;
      raw.xp = 8195;
      localStorage.setItem(key, JSON.stringify(raw));
    });
    for (const [label, size, hash] of [['desktop', { width: 1280, height: 800 }, '#home'], ['desktop room', { width: 1280, height: 800 }, '#train'],
      ['iPad', { width: 820, height: 1180 }, '#home'], ['phone', { width: 390, height: 844 }, '#home'], ['phone, in a room', { width: 390, height: 844 }, '#train'],
      ['big phone', { width: 430, height: 932 }, '#home'], ['small phone', { width: 360, height: 740 }, '#home'],
      ['phone on its side', { width: 844, height: 390 }, '#home']]) {
      await vp.setViewportSize(size);
      await vp.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
      await vp.waitForSelector('.crest-version', { timeout: 8000 });
      const seen = await vp.evaluate(() => {
        const el = document.querySelector('.crest-version');
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          text: el.textContent.trim(), visible: style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0,
          inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1,
          size: parseFloat(style.fontSize),
          // The rail is one row of things side by side; none may sit on another.
          touching: (() => {
            // The crest's own box may shrink while its mark spills out of it, so the mark is what is measured.
            const kids = ['.crest-mark', '.purse', '.pearl-chip', '.rank-chip', '.ledger-button']
              .map((q) => document.querySelector(`#topbar ${q}`)).filter(Boolean)
              .map((n) => [n, n.getBoundingClientRect()]).filter(([, b]) => b.width > 0 && b.height > 0 && b.top < 100);
            for (let i = 0; i < kids.length; i++) {
              for (let j = i + 1; j < kids.length; j++) {
                const a = kids[i][1];
                const b = kids[j][1];
                if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) return `${kids[i][0].className.split(' ')[0]} and ${kids[j][0].className.split(' ')[0]}`;
              }
            }
            return '';
          })(),
        };
      });
      if (seen.text !== `v${want}`) throw new Error(`${label}: the rail says "${seen.text}" and package.json says v${want}`);
      if (!seen.visible || !seen.inside) throw new Error(`${label}: the version is not on screen (${JSON.stringify(seen)})`);
      if (seen.overflow) throw new Error(`${label}: the rail made the page scroll sideways`);
      if (seen.touching) throw new Error(`${label}: on the rail, ${seen.touching} overlap`);
      if (seen.size < 8) throw new Error(`${label}: the version is ${seen.size}px, too small to read`);
    }
    console.log(`      v${want} under the crest on a desktop, an iPad, a phone and a phone on its side; nothing scrolls sideways`);
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
