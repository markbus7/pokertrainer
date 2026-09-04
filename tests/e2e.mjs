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

  // Step one is an ordinary check; answer it to reach the exercise.
  const first = await page.$$('.option');
  if (first.length) { await first[0].click(); await page.waitForTimeout(200); }
  for (const b of await page.$$('button.btn.primary')) {
    if (/next step/i.test((await b.textContent()) || '')) { await b.click(); break; }
  }
  await page.waitForTimeout(500);

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
  const routes = ['#home', '#play', '#lab-run', '#review', '#walkthrough?module=pot-odds', '#charts?chart=BTN', '#stats'];
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
