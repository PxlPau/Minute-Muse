/* =============================================================================
   tools/time-of-day-test.mjs — run the smoke suite as if the clock read a
   given minute, so tests can never depend on when they happen to run.

   Background: the reader picks a random passage from the current minute, and
   the collection contains legitimately short entries ("7.40 a.m. Have
   breakfast."). A length-based assertion therefore failed at certain minutes of
   the day. This script boots the suite at the minutes that used to break it,
   plus a couple of ordinary ones, and proves the suite is time-independent.

   `npm run test:minutes`
   ========================================================================== */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SUITE = fileURLToPath(new URL('smoke-test.mjs', import.meta.url));

/** Minutes that guarantee a short passage, plus neutral controls. */
const MINUTES = [
  '01:22', // "It was 1:22 when we found Dad's grave."
  '07:32', // "At 7:32, he suffered a fatal stroke."
  '07:40', // "7.40 a.m. Have breakfast."
  '13:22', // single short candidate
  '15:55', // "3.55 p.m. Give Toby food and water"
  '16:18', // single short candidate
  '00:47', // "At 12:47 a.m, Uncle Ho left us forever."
  '12:30', // the minute in the original failure: "12.30 p.m. Lunch"
  '09:15', // an ordinary, long passage
  '23:59', // the last minute of the day
];

function runAt(minute) {
  const [hours, minutes] = minute.split(':').map(Number);
  // Pin Date before the suite (and therefore the app) is imported.
  const shim = `
    const RealDate = globalThis.Date;
    const H = ${hours};
    const M = ${minutes};
    class PinnedDate extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [2026, 10, 14, H, M, 12]));
      }
      static now() { return new RealDate(2026, 10, 14, H, M, 12).getTime(); }
    }
    globalThis.Date = PinnedDate;
  `;
  const dataUrl = `data:text/javascript,${encodeURIComponent(shim)}`;

  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', dataUrl, SUITE], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { out += chunk; });
    child.on('close', (code) => {
      const summary = out.split('\n').filter((line) => line.includes('checks passed')).pop();
      const failures = out.split('\n')
        .filter((line) => line.includes('✗'))
        .map((line) => line.replace(/^\s*✗\s*/, '').trim());
      resolve({ minute, code, summary: (summary || '(no summary)').trim(), failures });
    });
  });
}

const results = [];
for (const minute of MINUTES) {
  const result = await runAt(minute);
  results.push(result);
  const status = result.code === 0 ? '✓' : '✗';
  const detail = result.code === 0 ? result.summary : result.failures.join(' ; ') || result.summary;
  console.log(`  ${status} ${minute}  ${detail}`);
}

const failures = results.filter((result) => result.code !== 0);

console.log(`\n  Minute Muse — time-of-day independence\n`);
console.log(`  ${results.length - failures.length}/${results.length} minutes passed the full suite\n`);

process.exit(failures.length ? 1 : 0);
