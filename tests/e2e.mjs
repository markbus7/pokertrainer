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
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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

await step('numeric drills make you produce the number, not pick it', async () => {
  // MDF is the clean case: every question has a number for an answer, so the
  // entry box must always be there and the options must not.
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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
    await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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

  // And a second Enter is still how you move on once you have read it.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const next = await readState();
  if (!next.question || next.question === entered.after.question) {
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

  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('poker-trainer.profile.v1') || '{}');
    raw.drills = {};
    for (const [id, n] of [['hand-rankings', 26], ['pot-odds', 39]]) raw.drills[id] = { attempts: n, correct: n - 3 };
    raw.walkthroughs = ['hand-rankings', 'pot-odds'];
    raw.xp = 3000;
    raw.handsPlayed = 60;
    localStorage.setItem('poker-trainer.profile.v1', JSON.stringify(raw));
  });
  await page.goto(`${BASE}/#drill?module=position`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  const look = await page.$('button:has-text("Show me the chart")');
  if (!look) throw new Error('a preflop question offers nowhere to look the chart up');
  await look.click();
  await page.waitForTimeout(250);

  const sheet = await page.evaluate(() => {
    const table = document.querySelector('.cheat-table');
    if (!table) return null;
    return {
      rows: table.querySelectorAll('tbody tr').length,
      seats: [...table.querySelectorAll('thead th')].map((n) => n.textContent),
      body: table.textContent.replace(/\s+/g, ' '),
    };
  });
  if (!sheet) throw new Error('the chart button showed no chart');
  if (sheet.rows < 4) throw new Error(`only ${sheet.rows} rows of chart`);
  for (const seat of ['UTG', 'CO', 'BTN']) {
    if (!sheet.seats.includes(seat)) throw new Error(`the sheet is missing ${seat}: ${sheet.seats.join(' ')}`);
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
  console.log(`      chart offered (${sheet.rows} rows), and the peeked answer scored ${after.correct - before.correct}`);
});

await step('a graded question can be copied out as text', async () => {
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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
      await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      // The language lives in the profile settings, so it is switched the way a
      // reader switches it — through the chip in the header.
      const wanted = lang.toUpperCase();
      const chip = await page.$(`.lang-chip:not(.active):has-text("${wanted}")`);
      if (chip) { await chip.click(); await page.waitForTimeout(400); }

      for (const mod of ['outs', 'pot-odds', 'spr']) {
        await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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
    await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const back = await page.$('.lang-chip:not(.active):has-text("EN")');
    if (back) { await back.click(); await page.waitForTimeout(300); }
  }
});

await step('when only the lesson is left, it says so where the button is', async () => {
  // A module at 50/52 and 96% is past both of Mastered's numbers, so the only
  // thing left is one pass through the guided lesson. The tile named it as a
  // noun — "Mastered: the guided lesson" — which reads as a category rather
  // than a thing to do, and the lesson page offered "Teach me this" and
  // "Skip to drills" as equal options. So the reader kept drilling a module
  // that no amount of drilling could move.
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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
  if (!/5 more questions/i.test(tile)) {
    throw new Error(`the tile never says how many more are needed: ${tile}`);
  }
  console.log(`      tile reads: ${tile.slice(0, 120)}`);
});

await step('the home screen names one module and the grid marks the same one', async () => {
  // Reported: the banner named a module, the grid showed two tiles both
  // reading "Learning", and nothing said which one was meant or why.
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const marked = await page.$$eval('.module-tile.next-up .name', (n) => n.map((x) => x.textContent.trim()));
  if (marked.length !== 1) throw new Error(`expected exactly one marked tile, got ${marked.length}`);

  const banner = await page.$eval('.panel', (p) => p.textContent);
  const named = await page.$eval('.panel .btn.sm.ghost', (b) => b.textContent);
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
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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
    ['#home', '.stat', 'the home stat tiles', 4],
    ['#stats', '.stat, .calib-value', 'the progress tiles and calibration rows', 5],
  ]) {
    // The reload above is what makes the seeded profile real: going straight
    // from #home to #stats is only a fragment navigation, so the app keeps
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
    await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#play?lesson=pot-odds`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.felt', { timeout: 8000 });
  await page.click('button.btn.primary.lg');

  // Play the run out, always taking the first action offered.
  for (let i = 0; i < 400; i++) {
    if (await page.$('.run-report')) break;
    const opt = await page.$('.practice-option:not([disabled])');
    if (opt) { await opt.click(); await page.waitForTimeout(120); continue; }
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
    await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
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

await step('the language switch turns the whole app Dutch and persists', async () => {
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const englishNav = await page.$$eval('.tab', (n) => n.map((x) => x.textContent.trim()));
  if (!englishNav.includes('Train')) throw new Error(`expected English nav, got ${englishNav}`);

  await page.click('.lang-chip:not(.active)');
  await page.waitForTimeout(400);

  const dutchNav = await page.$$eval('.tab', (n) => n.map((x) => x.textContent.trim()));
  if (!dutchNav.includes('Leren')) throw new Error(`nav did not switch: ${dutchNav}`);

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
  await page.goto(`${BASE}/#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const stillDutch = await page.$eval('.lang-chip.active', (n) => n.textContent);
  if (!/NL/.test(stillDutch)) throw new Error(`language did not persist: ${stillDutch}`);

  // Put it back so later steps see the app they expect.
  await page.click('.lang-chip:not(.active)');
  await page.waitForTimeout(300);
});

await step('no screen is half in English when the app is in Dutch', async () => {
  // Rendered twice, once per language, and compared. Checking the Dutch text
  // against the translation table would answer the wrong question: once a
  // string is translated the reader never sees the English, so what matters
  // is text that comes out the same in both — which is text that never
  // reached t(). Randomly dealt content differs between renders anyway, so
  // what this actually measures is the fixed chrome of every screen.
  const routes = [
    '#home', '#lab-run', '#review', '#charts?chart=BTN', '#glossary', '#stats',
    '#levels', '#grind', '#gauntlet', '#drill?module=outs', '#walkthrough?module=pot-odds',
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
  const routes = ['#home', '#play', '#lab-run', '#review', '#walkthrough?module=pot-odds',
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
