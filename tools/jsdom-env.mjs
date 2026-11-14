/* =============================================================================
   tools/jsdom-env.mjs — a DOM for the smoke test
   Registers hooks that install a jsdom window as the global environment for
   real ES module imports, served from a loopback static server so relative
   fetches and dynamic imports behave exactly as they do in the browser.
   ========================================================================== */

import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const PROJECT_ROOT = new URL('../', import.meta.url);

/** Serve the project over 127.0.0.1 so `fetch` and URL resolution are realistic. */
export async function startServer() {
  const http = await import('node:http');
  const path = await import('node:path');
  const root = path.dirname(new URL(import.meta.url).pathname);
  const projectRoot = path.resolve(root, '..');
  const types = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  };
  const server = http.createServer(async (req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = path.join(projectRoot, pathname);
    try {
      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}/` };
}

/** Install a jsdom window (with the app's HTML) as the global environment. */
export async function installDom(baseUrl) {
  const { JSDOM, VirtualConsole } = await import('jsdom');
  const html = await readFile(new URL('index.html', PROJECT_ROOT), 'utf8');

  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));

  const dom = new JSDOM(html, {
    url: baseUrl,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;

  // Minimal API surface the app relies on that jsdom does not implement.
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  });
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => {};
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  if (!window.structuredClone) window.structuredClone = (v) => JSON.parse(JSON.stringify(v));
  class FakeImage {
    set src(value) {
      this._src = value;
      if (this.onload) setTimeout(() => this.onload(), 0);
    }
    get src() { return this._src; }
  }
  window.Image = FakeImage;
  window.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);

  installGlobals(window, dom, baseUrl);
  return { dom, window, errors };
}

function installGlobals(window, dom, baseUrl) {
  // Constructors the app checks with `instanceof` must be jsdom's, even when
  // Node already provides one (Node 22 ships global CustomEvent, Event, etc.).
  const force = [
    'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage',
    'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'FocusEvent',
    'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLButtonElement',
    'Element', 'Node', 'NodeList', 'DocumentFragment', 'Range', 'Selection',
    'DOMParser', 'Image', 'getComputedStyle', 'requestAnimationFrame',
    'cancelAnimationFrame', 'CSS', 'MutationObserver',
    'IntersectionObserver', 'ResizeObserver',
  ];
  for (const name of force) {
    if (window[name] === undefined) continue;
    try {
      // Always forward to the live jsdom object, even if Node has its own
      // native version of the same global (Node 22 does for several events).
      Object.defineProperty(globalThis, name, {
        get: () => window[name],
        configurable: true,
      });
    } catch {
      /* read-only globals are left alone */
    }
  }

  // fetch, resolved against the test server, exactly like a browser would.
  const nodeFetch = globalThis.fetch;
  const boundFetch = (input, init) => {
    const target = typeof input === 'string' ? new URL(input, baseUrl).href : input;
    return nodeFetch(target, init);
  };
  Object.defineProperty(globalThis, 'fetch', { value: boundFetch, configurable: true, writable: true });
  window.fetch = boundFetch;

  globalThis.__dom = dom;
  globalThis.__jsdomWindow = window;
}

/**
 * Stop timers and close the DOM without leaving work running in the background
 * (a pending app timer would otherwise fire into a closed document).
 */
export function teardown({ server, dom } = {}) {
  try { server?.close(); } catch { /* ignore */ }
  try {
    dom?.window.close();
  } catch {
    /* ignore */
  }
}

export const projectRootUrl = PROJECT_ROOT;
