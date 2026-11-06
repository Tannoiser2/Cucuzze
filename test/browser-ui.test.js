const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const engineSrc = fs.readFileSync(path.join(__dirname, '../docs/engine.js'), 'utf8');
const gameSrc = fs.readFileSync(path.join(__dirname, '../docs/game.js'), 'utf8');

/* Finto PeerJS in memoria: collega i contesti TV e telefoni. */
function network() {
  const peers = {};
  class Conn {
    constructor(owner, remoteId) { this.owner = owner; this.remoteId = remoteId; this.l = {}; this.open = false; }
    on(n, f) { this.l[n] = f; }
    send(m) { const o = this.other; if (o && o.open) setImmediate(() => o.l.data && o.l.data(JSON.parse(JSON.stringify(m)))); }
    close() { if (!this.open) return; this.open = false; this.other.open = false; this.l.close && this.l.close(); this.other.l.close && this.other.l.close(); }
  }
  class Peer {
    constructor(id) { this.id = id || 'guest-' + Math.random().toString(36).slice(2); this.l = {}; this.disconnected = false; this.conns = [];
      setImmediate(() => { if (peers[this.id]) { this.l.error && this.l.error({ type: 'unavailable-id', message: 'taken' }); return; } peers[this.id] = this; this.l.open && this.l.open(this.id); }); }
    on(n, f) { this.l[n] = f; }
    connect(id) { const a = new Conn(this, id); this.conns.push(a); setImmediate(() => { const host = peers[id]; if (!host) { this.l.error && this.l.error({ type: 'peer-unavailable', message: 'nope' }); return; }
      const b = new Conn(host, this.id); a.other = b; b.other = a; host.conns.push(b); host.l.connection && host.l.connection(b); a.open = b.open = true; a.l.open && a.l.open(); b.l.open && b.l.open(); }); return a; }
    destroy() { if (peers[this.id] === this) delete peers[this.id]; for (const c of this.conns) c.close(); }
    reconnect() {}
  }
  return { Peer, peers };
}
function device(net, search, storage = {}) {
  const els = {};
  const el = () => ({ innerHTML: '', value: '', onclick: null, onchange: null, textContent: '', dataset: {}, classList: { add() {}, remove() {} }, addEventListener(n, f) { this['on' + n] = f; } });
  const document = { getElementById: id => els[id] || (els[id] = el()), querySelectorAll: () => [], querySelector: () => null, body: { className: '' } };
  const ctx = { document, location: { pathname: '/Cucuzze/', href: 'https://x.org/Cucuzze/' + search, search },
    localStorage: { getItem: k => k in storage ? storage[k] : null, setItem: (k, v) => { storage[k] = String(v); }, removeItem: k => { delete storage[k]; } },
    history: { replaceState() {} }, URLSearchParams, Peer: net.Peer, console, Math, JSON, Date, setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 5)), clearTimeout, setImmediate };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(engineSrc, ctx);
  vm.runInContext(gameSrc + '\n;globalThis.__t={get game(){return game},get view(){return view},get me(){return me},get offline(){return offline},act,draw}', ctx);
  return { ctx, els, storage, t: ctx.__t };
}
const tick = (n = 30) => new Promise(r => { let i = 0; const f = () => ++i >= n ? r() : setImmediate(f); f(); });
const wait = ms => new Promise(r => setTimeout(r, ms));

test('TV + 2 telefoni + 2 giocatori finti: una giornata intera, ricarica della TV, fine partita', async () => {
  const net = network(), tvStore = {};
  let tv = device(net, '', tvStore);
  tv.els.create.onclick(); await tick();
  const room = tv.t.game.room; assert.match(room, /^cucuzze-/);
  assert.match(tv.els.app.innerHTML, /Sala d'attesa/);
  const phones = ['Anna', 'Bruno'].map(n => device(net, '?room=' + room, { 'cucuzze-name': n }));
  await tick(60);
  tv.els.bot.onclick(); tv.els.bot.onclick();
  assert.equal(tv.t.game.players.length, 4);
  assert.match(phones[0].els.app.innerHTML, /Aspetta che la TV/);
  tv.els.start.onclick(); await tick(40);
  assert.match(phones[0].els.app.innerHTML, /I tuoi dadi/);
  assert.match(phones[0].els.app.innerHTML, /dado-[1-6]\.webp/);
  assert.match(tv.els.app.innerHTML, /In arrivo/);
  // Alba: Anna semina con entrambi i dadi, Bruno punta sul Contadino deviando su Anna
  const anna = phones[0].t.me, bruno = phones[1].t.me;
  phones[0].t.act({ type: 'assign', die: 0, slot: 'prod' }); phones[0].t.act({ type: 'assign', die: 1, slot: 'prod' });
  phones[1].t.act({ type: 'assign', die: 0, slot: 'bid', wave: 0, target: anna }); phones[1].t.act({ type: 'assign', die: 1, slot: 'def' });
  await tick(30);
  assert.match(phones[0].els.app.innerHTML, /Semina: \+\d+ semi/);
  for (const ph of phones) ph.t.act({ type: 'ready', ready: true });
  await tick(40); await wait(40); await tick(40);
  // la rivelazione parte e poi la TV avanza al Tramonto
  for (let i = 0; i < 40 && tv.t.game.phase === 0; i++) { await wait(10); await tick(10); }
  assert.equal(tv.t.game.phase, 1, 'si passa al Tramonto');
  const saved = JSON.parse(tvStore['cucuzze2-host-save']);
  assert.equal(saved.game.phase, 1);
  // la TV ricarica la pagina
  net.peers[room].destroy(); await tick();
  assert.equal(phones[0].t.offline, true);
  tv = device(net, '', tvStore);
  assert.match(tv.els.app.innerHTML, /Riprendi la partita/);
  tv.els.resume.onclick(); await tick(40); await wait(30); await tick(60);
  assert.equal(tv.t.game.room, room);
  for (const ph of phones) assert.equal(ph.t.offline, false, 'i telefoni si ricollegano');
  // giochiamo fino alla fine: i telefoni confermano sempre senza scegliere
  for (let guard = 0; guard < 400 && !tv.t.game.finished; guard++) {
    if (tv.t.game.stage === 'orders') for (const ph of phones) if (ph.t.view && ph.t.view.me && !ph.t.view.me.ready) ph.t.act({ type: 'ready', ready: true });
    await wait(5); await tick(10);
  }
  assert.equal(tv.t.game.finished, true);
  assert.match(tv.els.app.innerHTML, /Classifica finale/);
  await tick(20);
  assert.match(phones[0].els.app.innerHTML, /Classifica|Hai vinto/);
  for (const d of [tv, ...phones]) assert.doesNotMatch(d.els.app.innerHTML, /[←-⯿\u{1F000}-\u{1FAFF}]/u, 'nessun simbolo Unicode a rischio');
});

test('partita di prova con soli giocatori finti, senza rete', async () => {
  const net = network();
  const tv = device(net, '', {});
  tv.ctx.document.getElementById('nbot').value = '7';
  tv.els.test.onclick();
  for (let i = 0; i < 600 && !tv.t.game.finished; i++) { await wait(3); }
  assert.equal(tv.t.game.finished, true);
  assert.equal(tv.t.game.players.length, 7);
});
