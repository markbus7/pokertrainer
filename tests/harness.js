/** Tiny zero-dependency test harness. */
const suites = [];
let current = null;

export function describe(name, fn) {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
}

export function it(name, fn) {
  if (!current) throw new Error('it() outside describe()');
  current.tests.push({ name, fn });
}

export function assert(cond, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

export function equal(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg}\n    expected: ${expected}\n    actual:   ${actual}`);
  }
}

export function close(actual, expected, tolerance, msg = '') {
  if (!Number.isFinite(actual)) {
    throw new Error(`${msg}\n    expected: ${expected} +/- ${tolerance}\n    actual:   ${actual} (not a number)`);
  }
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg}\n    expected: ${expected} +/- ${tolerance}\n    actual:   ${actual}`);
  }
}

export function throws(fn, msg = 'expected throw') {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg);
}

export async function runAll() {
  let passed = 0;
  const failures = [];
  for (const suite of suites) {
    console.log(`\n\x1b[1m${suite.name}\x1b[0m`);
    for (const test of suite.tests) {
      const started = Date.now();
      try {
        await test.fn();
        const ms = Date.now() - started;
        console.log(`  \x1b[32m✓\x1b[0m ${test.name}\x1b[90m${ms > 40 ? ` (${ms}ms)` : ''}\x1b[0m`);
        passed++;
      } catch (err) {
        console.log(`  \x1b[31m✗ ${test.name}\x1b[0m`);
        console.log(`\x1b[31m    ${String(err.message).split('\n').join('\n    ')}\x1b[0m`);
        failures.push(`${suite.name} > ${test.name}`);
      }
    }
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\x1b[31mFailures:\x1b[0m');
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
  return failures.length === 0;
}
