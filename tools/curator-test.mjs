import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, ['generate-images.js'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, UNSPLASH_ACCESS_KEY: '' },
});
const output = `${result.stdout || ''}${result.stderr || ''}`;

assert.equal(result.status, 1, `Expected a clear missing-key exit, got ${result.status}: ${output}`);
assert.match(output, /UNSPLASH_ACCESS_KEY is not set/);
assert.doesNotMatch(output, /require is not defined|ERR_REQUIRE_ESM/);
console.log('✓ Curator starts as an ES module and reports missing credentials cleanly.');
