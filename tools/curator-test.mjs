import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, ['generate-images.js'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, UNSPLASH_ACCESS_KEY: '' },
});
const output = `${result.stdout || ''}${result.stderr || ''}`;

assert.equal(result.status, 0, `A missing key should skip cleanly, got ${result.status}: ${output}`);
assert.match(output, /UNSPLASH_ACCESS_KEY is not set/);
assert.doesNotMatch(output, /require is not defined|ERR_REQUIRE_ESM/);
console.log('✓ Curator starts as an ES module and skips missing credentials cleanly.');

const before = readFileSync(resolve(root, 'images.json'), 'utf8');
let outageStatus = null;
let outageOutput = '';
{
  const outage = spawnSync(process.execPath, ['generate-images.js'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 5000,
    env: {
      ...process.env,
      UNSPLASH_ACCESS_KEY: 'fake-test-key',
      UNSPLASH_ENDPOINT: 'http://127.0.0.1:1/',
      UNSPLASH_REFRESH_DELAY_MS: '0',
    },
  });
  outageStatus = outage.status;
  outageOutput = `${outage.stdout || ''}${outage.stderr || ''}`;
}
assert.equal(outageStatus, 0, `A transient API outage failed the job: ${outageOutput}`);
assert.match(outageOutput, /images.json left untouched/i);
assert.equal(readFileSync(resolve(root, 'images.json'), 'utf8'), before, 'the fallback set was overwritten during an outage');
console.log('✓ Unsplash outages keep the previous image set without failing the refresh job.');
