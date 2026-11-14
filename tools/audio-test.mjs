/* =============================================================================
   tools/audio-test.mjs — the ambience mixer, exercised without a browser
   A stub Web Audio implementation is rich enough to verify routing, fades,
   ducking and disposal. `npm run test:audio`
   ========================================================================== */

import { startServer, installDom, projectRootUrl } from './jsdom-env.mjs';

const { server, url } = await startServer();
const { dom, window } = await installDom(url);

// A minimal Web Audio implementation just rich enough to exercise routing.
let nodesCreated = 0;
class Param {
  constructor(v = 0) { this.value = v; this.events = []; }
  setValueAtTime(v) { this.value = v; this.events.push(['set', v]); return this; }
  linearRampToValueAtTime(v) { this.events.push(['ramp', v]); this.value = v; return this; }
  setTargetAtTime(v) { this.events.push(['target', v]); return this; }
  cancelScheduledValues() { this.events.push(['cancel']); return this; }
  exponentialRampToValueAtTime(v) { this.value = v; return this; }
}
class NodeStub {
  constructor(kind) { this.kind = kind; this.outputs = []; nodesCreated++; }
  connect(target) { this.outputs.push(target); return target; }
  disconnect() {}
  start() { this.started = true; }
  stop() { this.stopped = true; }
}
class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.sampleRate = 1000; // tiny buffers keep the test fast
    this.destination = new NodeStub('destination');
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  createGain() { const n = new NodeStub('gain'); n.gain = new Param(1); return n; }
  createBiquadFilter() { const n = new NodeStub('filter'); n.frequency = new Param(350); n.Q = new Param(1); n.gain = new Param(0); n.type = ''; return n; }
  createBufferSource() { const n = new NodeStub('buffer'); n.buffer = null; return n; }
  createOscillator() { const n = new NodeStub('osc'); n.frequency = new Param(440); n.type = 'sine'; n.detune = new Param(0); return n; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  createMediaElementSource(el) { const n = new NodeStub('media'); n.el = el; return n; }
}
window.AudioContext = FakeAudioContext;
window.webkitAudioContext = FakeAudioContext;

const { Ambience, SOUND_LIST, SOUND_PRESETS, playChime } = await import(new URL('js/audio.js', projectRootUrl).href);

const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(`✓ ${name}`); }
  catch (e) { results.push(`✗ ${name} — ${e.message}`); }
};
const assert = (c, m) => { if (!c) throw new Error(m || 'failed'); };

const amb = new Ambience({ rain: 0.4, brown: 0.2 });

await check('nothing plays before a gesture', () => {
  assert(amb.playingIds.length === 0, 'audio started unbidden');
  assert(amb.ctx === null, 'context created without a gesture');
});

await check('seven layers are offered', () => {
  assert(SOUND_LIST.length === 7, `got ${SOUND_LIST.length}`);
  assert(SOUND_LIST.every(s => s.id && s.name && s.credit), 'incomplete layer metadata');
});

await check('a file layer starts and fades in', async () => {
  const started = await amb.start('rain');
  assert(started, 'rain did not start');
  assert(amb.isPlaying('rain'), 'rain not reported as playing');
  assert(amb.ctx.state === 'running', 'context not resumed');
  const channel = amb.channels.get('rain');
  assert(channel.gain.gain.events.some(e => e[0] === 'ramp'), 'no fade-in ramp');
  assert(amb.playingIds.includes('rain'), 'playingIds missing rain');
});

await check('a synthesised bed starts', async () => {
  const started = await amb.start('brown');
  assert(started, 'brown noise did not start');
  assert(amb.isPlaying('brown'), 'brown not playing');
});

await check('volume changes ramp without restarting', async () => {
  const channel = amb.channels.get('rain');
  const sources = channel.sources.slice();
  amb.setVolume('rain', 0.8);
  assert(amb.volumes.rain === 0.8, 'volume not stored');
  assert(channel.sources.every((s, i) => s === sources[i]), 'source was recreated');
  assert(channel.gain.gain.events.some(e => e[0] === 'ramp'), 'no ramp on volume change');
});

await check('stopping fades then disposes', async () => {
  amb.stop('rain', { fade: 0.01 });
  await new Promise(r => setTimeout(r, 120));
  assert(!amb.channels.has('rain'), 'channel not disposed after fade');
});

await check('toggle is idempotent', async () => {
  const first = await amb.toggle('fire');
  assert(first === true, 'toggle did not start');
  const playing = amb.isPlaying('fire');
  const second = await amb.toggle('fire');
  await new Promise(r => setTimeout(r, 120));
  assert(second === false, 'second toggle did not stop');
  assert(!amb.isPlaying('fire'), 'still playing after stop');
});

await check('muting ramps to zero and back', () => {
  amb.setMuted(true);
  assert(amb.muted, 'muted flag not set');
  const master = amb.master.gain.events;
  assert(master.length > 0, 'master gain untouched');
  amb.setMuted(false);
  assert(!amb.muted, 'did not unmute');
});

await check('ducking lowers and restores the master level', () => {
  amb.setMasterDuck(true);
  assert(amb.masterGain < 1, 'no duck applied');
  amb.setMasterDuck(false);
  assert(amb.masterGain === 1, 'duck not released');
});

await check('a preset can be applied as a blend', async () => {
  amb.stopAll({ fade: 0.01 });
  await new Promise(r => setTimeout(r, 120));
  for (const id of Object.keys(SOUND_PRESETS[0].mix)) await amb.start(id);
  assert(amb.playingIds.length === Object.keys(SOUND_PRESETS[0].mix).length, 'preset layers incomplete');
});

await check('chime synthesises without error', async () => {
  await playChime({ volume: 0.2 });
  assert(true);
});

await check('state change events fire', () => {
  let fired = 0;
  amb.onStateChange = () => { fired++; };
  amb.setVolume('brown', 0.5);
  assert(fired > 0, 'no state change emitted');
});

await check('dispose tears everything down', () => {
  amb.dispose();
  assert(amb.playingIds.length === 0, 'layers still playing after dispose');
  assert(amb.ctx === null, 'context not closed');
});

const failed = results.filter((r) => r.startsWith('✗'));

console.log('\n  Minute Muse — ambience mixer\n');
results.forEach((line) => console.log(`  ${line}`));
console.log(`\n  ${results.length - failed.length}/${results.length} checks passed\n`);

dom.window.close();
server.close();
process.exit(failed.length ? 1 : 0);
