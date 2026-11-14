/* =============================================================================
   tools/resilience-test.mjs — how the room behaves when things go wrong
   Each scenario boots the app in its own child process (a module graph is bound
   to one DOM), with a different failure injected first: missing collection,
   missing photography, corrupt storage, corrupt bookmarks.
   `npm run test:resilience`
   ========================================================================== */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WORKER = new URL('resilience-worker.mjs', import.meta.url);

const SCENARIOS = ['quotes-offline', 'images-offline', 'corrupt-storage', 'corrupt-bookmarks'];

function run(scenario) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(WORKER), scenario], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('close', (code) => resolve({ scenario, code, out, err }));
  });
}

const lines = [];
let failures = 0;

for (const scenario of SCENARIOS) {
  const result = await run(scenario);
  const first = result.out.trim().split('\n').filter(Boolean).pop() || result.err.split('\n')[0] || 'no output';
  if (result.code === 0) {
    lines.push(`✓ ${scenario.padEnd(20)} ${first}`);
  } else {
    failures += 1;
    lines.push(`✗ ${scenario.padEnd(20)} ${first}`);
  }
}

console.log('\n  Minute Muse — resilience\n');
lines.forEach((line) => console.log(`  ${line}`));
console.log(`\n  ${lines.length - failures}/${lines.length} checks passed\n`);
process.exit(failures ? 1 : 0);
