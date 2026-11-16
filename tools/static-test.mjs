/* Static contract checks that do not need a DOM: offline shell, data files,
   legal pages, and a syntax check of every shipped script. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(join(root, name), 'utf8');
let checks = 0;

function check(label, fn) {
  fn();
  checks += 1;
  console.log(`  ✓ ${label}`.padEnd(58, '.') + 'ok');
}

check('every shipped JavaScript and MJS file parses', () => {
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', '.cache'].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(js|mjs)$/.test(entry.name)) files.push(relative(root, full));
    }
  };
  visit(join(root, 'js'));
  visit(join(root, 'tools'));
  for (const file of ['sw.js', 'generate-images.js']) files.push(file);
  assert(files.length > 20, `unexpectedly small script inventory (${files.length})`);
  for (const file of files) {
    const parsed = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
    assert.equal(parsed.status, 0, `${file} does not parse:\n${parsed.stderr}`);
  }
});

check('the service worker lists every runtime module', () => {
  const sw = read('sw.js');
  const modules = readdirSync(join(root, 'js/ui'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => `js/ui/${name}`);
  for (const name of ['js/app.js', 'js/store.js', 'js/util.js', 'js/audio.js', 'js/quotes.js', 'js/timer.js', ...modules]) {
    assert.match(sw, new RegExp(`'${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), `${name} is missing from the offline shell`);
  }
  assert.match(sw, /ignoreSearch:\s*true/, 'cache-busting JSON requests would miss the offline data cache');
});

check('the HTML shell has no duplicate ids or dead local references', () => {
  const html = read('index.html');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);
  const sprite = new Set([...html.matchAll(/<symbol\s+id="([^"]+)"/g)].map((match) => match[1]));
  const localRefs = [...html.matchAll(/(?:href|src)="#?([^"#:]+)"/g)]
    .map((match) => match[1])
    .filter((value) => value.startsWith('#i-'));
  for (const ref of localRefs) {
    assert(sprite.has(ref.replace(/^#/, '')), `unknown sprite reference ${ref}`);
  }
});

check('every image bucket has usable, safe photographs', () => {
  const images = JSON.parse(read('images.json'));
  for (const [climate, periods] of Object.entries(images)) {
    assert(['north', 'south', 'tropical'].includes(climate), `unknown climate ${climate}`);
    for (const [period, list] of Object.entries(periods)) {
      assert(['dawn', 'morning', 'afternoon', 'evening', 'night'].includes(period), `unknown period ${period}`);
      assert(Array.isArray(list) && list.length >= 2, `${climate}.${period} has too few images`);
      for (const photo of list) {
        assert.match(photo.url, /^https:\/\//, `${climate}.${period} has an unsafe photo URL`);
        assert.match(photo.link, /^https:\/\//, `${climate}.${period} has an unsafe profile URL`);
        assert(photo.name && !/[<>]/.test(photo.name), `${climate}.${period} has an unsafe photographer name`);
      }
    }
  }
});

check('quote collection has valid minute keys and required passages', () => {
  const quotes = JSON.parse(read('quotes.json'));
  let total = 0;
  const duplicates = [];
  for (const [key, passages] of Object.entries(quotes)) {
    assert.match(key, /^([01]\d|2[0-3]):[0-5]\d$/, `invalid minute key ${key}`);
    assert(Array.isArray(passages) && passages.length > 0, `empty minute ${key}`);
    const seen = new Set();
    for (const passage of passages) {
      assert.equal(typeof passage.quote, 'string', `${key} has a non-string passage`);
      assert.equal(typeof passage.author, 'string', `${key} has a non-string author`);
      assert(passage.quote.trim(), `${key} has a blank passage`);
      if (seen.has(passage.quote)) duplicates.push(key);
      seen.add(passage.quote);
      total += 1;
    }
  }
  assert(duplicates.length === 0, `duplicate passages at ${[...new Set(duplicates)].join(', ')}`);
  assert(total > 3000, `unexpectedly small quote collection (${total})`);
});

check('legal pages and licence are linked and present', () => {
  const html = read('index.html');
  for (const page of ['terms.html', 'privacy.html', 'disclaimer.html', 'LICENSE']) {
    assert(read(page).trim(), `${page} is empty`);
    assert(html.includes(page) || page === 'LICENSE', `${page} is not linked from the app shell`);
  }
  assert.match(read('LICENSE'), /MIT License/);
});

check('CI parses the full script inventory and refresh tolerates a missing key', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /git ls-files '\*\.js' '\*\.mjs'/, 'CI does not check all scripts');
  const refresh = read('.github/workflows/refresh.yml');
  assert.match(refresh, /env\.UNSPLASH_ACCESS_KEY != ''/, 'refresh runs the curator without a key');
  assert.match(refresh, /::warning::UNSPLASH_ACCESS_KEY/, 'refresh does not report a missing key');
});

console.log(`\n  ${checks}/${checks} static checks passed\n`);
