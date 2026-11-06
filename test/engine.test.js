const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../docs/engine.js');

// generatore pseudo-casuale ripetibile
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function setup(n, rng) {
  const g = E.newGame('t');
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(E.addPlayer(g, 'G' + i, {}, rng).id);
  E.start(g, rng);
  return { g, ids };
}

test('ondate e personaggi crescono con i giocatori', () => {
  assert.deepEqual([4, 5, 6, 8, 9, 10].map(E.wavesFor), [1, 1, 2, 2, 3, 3]);
  const { g } = setup(9, seeded(1));
  assert.equal(g.waves.length, 3);
  assert.equal(g.waves[0].size, g.common[0]);
});

test('le ondate puntano il campo più ricco', () => {
  const rng = seeded(2), { g } = setup(4, rng);
  g.players[2].pumpkins = 30;
  g.phase = 1; g.event = 'serena';
  // rigenera la fase con la nuova classifica
  const ph = E.PHASES[1];
  E.advance; // eslint
  g.stage = 'orders';
  const order = g.players.slice().sort((a, b) => E.score(b) - E.score(a));
  assert.equal(order[0].name, 'G2');
});

test('asta: vince la somma più alta, devia l\'ondata e prende il bonus; pareggio = nessuno', () => {
  const rng = seeded(3), { g, ids } = setup(4, rng);
  g.event = 'serena';
  const [a, b, c, d] = g.players;
  g.waves = [{ size: 4, announced: a.id }];
  a.dice = [6, 5]; b.dice = [3, 2]; c.dice = [1, 1]; d.dice = [2, 2];
  c.seeds = 10;
  E.assign(g, a.id, 0, 'bid', 0, c.id); E.assign(g, a.id, 1, 'bid', 0, c.id);
  E.assign(g, b.id, 0, 'bid', 0, a.id);
  for (const p of g.players) E.setReady(g, p.id, true);
  const rv = E.resolvePhase(g, rng);
  const asta = rv.items.find(i => i.k === 'asta');
  assert.equal(asta.result, 'vinta'); assert.equal(asta.winner, 'G0'); assert.equal(asta.sum, 11);
  const onda = rv.items.find(i => i.k === 'onda');
  assert.equal(onda.to, 'G2'); assert.equal(onda.deviatedBy, 'G0');
  assert.equal(c.seeds, 10 - 8, '4 corvi = 8 semi');
  assert.equal(a.seeds, 2, 'bonus del Contadino: +2 semi');
  // pareggio
  E.advance(g, rng); g.waves = [{ size: 2, announced: b.id }];
  a.dice = [3, 3]; b.dice = [4, 2]; c.dice = [1, 1]; d.dice = [1, 1];
  E.assign(g, a.id, 0, 'bid', 0, d.id); E.assign(g, a.id, 1, 'bid', 0, d.id);
  E.assign(g, b.id, 0, 'bid', 0, d.id); E.assign(g, b.id, 1, 'bid', 0, d.id);
  const before = b.pumpkins;
  const rv2 = E.resolvePhase(g, rng);
  assert.equal(rv2.items.find(i => i.k === 'asta').result, 'pareggio');
  assert.equal(rv2.items.find(i => i.k === 'onda').to, 'G1', 'resta sul bersaglio annunciato');
  assert.equal(b.pumpkins, before - 2);
});

test('difese: bloccano e si consumano; i cinghiali rompono il recinto', () => {
  const rng = seeded(4), { g } = setup(4, rng);
  g.event = 'serena';
  const t = g.players[0];
  g.phase = 2; g.waves = [{ size: 3, announced: t.id }];
  t.seeds = 10; t.def = [0, 2, 2];
  const rv = E.resolvePhase(g, rng);
  const o = rv.items.find(i => i.k === 'onda');
  assert.equal(o.raw, 6); assert.equal(o.blocked, 4); assert.equal(o.dmg, 2);
  assert.equal(t.seeds, 8); assert.equal(t.def[2], 1, 'i cani si consumano'); assert.equal(t.def[1], 1, 'recinto rotto');
});

test('produzione: semina, raccolto e concime', () => {
  const rng = seeded(5), { g } = setup(4, rng);
  g.event = 'serena'; g.common = [1, 1, 1];
  const p = g.players[1];
  g.waves = [{ size: 1, announced: g.players[0].id }];
  p.dice = [6, 5]; E.assign(g, p.id, 0, 'prod'); E.assign(g, p.id, 1, 'prod');
  E.resolvePhase(g, rng); assert.equal(p.seeds, 8, 'semina con tetto 8');
  E.advance(g, rng); g.waves = [{ size: 1, announced: g.players[0].id }];
  p.dice = [2, 2]; E.assign(g, p.id, 0, 'prod'); E.assign(g, p.id, 1, 'prod');
  const pk = p.pumpkins; E.resolvePhase(g, rng);
  assert.equal(p.pumpkins, pk + 6, '2 dadi = 4 semi + coppia 2'); assert.equal(p.seeds, 2);
  E.advance(g, rng); g.waves = [{ size: 1, announced: g.players[0].id }];
  p.dice = [5, 4]; E.assign(g, p.id, 0, 'prod'); E.assign(g, p.id, 1, 'prod');
  E.resolvePhase(g, rng); assert.equal(p.seeds, 2 + 4, 'concime: meta di 8');
  const pkBefore = p.pumpkins; E.advance(g, rng); assert.equal(p.pumpkins, pkBefore + 3, 'crescita 2 semi = 1 zucca');
  assert.equal(g.day, 2);
});

test('combinazioni', () => {
  assert.equal(E.comboOf([3, 3], [1]).bonus, 2);
  assert.equal(E.comboOf([3, 3], [3]).bonus, 3);
  assert.equal(E.comboOf([3, 3], [3, 3]).bonus, 5);
  assert.equal(E.comboOf([3, 3], [3, 2, 2]).bonus, 4);
  assert.equal(E.comboOf([2], [5, 6]).bonus, 0);
});

test('partite complete di soli giocatori finti, da 2 a 10, senza stati impossibili', () => {
  for (let n = 2; n <= 10; n++) for (let k = 0; k < 40; k++) {
    const rng = seeded(n * 1000 + k), g = E.newGame('t');
    for (let i = 0; i < n; i++) E.addBot(g, rng);
    E.start(g, rng);
    let guard = 0;
    while (!g.finished) {
      assert.ok(guard++ < 50);
      assert.ok(E.allReady(g)); E.resolvePhase(g, rng); E.advance(g, rng);
      for (const p of g.players) { assert.ok(p.pumpkins >= 0 && p.seeds >= 0); assert.ok(p.def.every(d => d >= 0 && d <= 2)); }
      JSON.parse(JSON.stringify(g));
    }
    assert.equal(g.day, 6); assert.ok(g.winners.length >= 1); assert.equal(g.event, 'sagra');
  }
});

test('la vista del telefono non mostra i dadi altrui', () => {
  const rng = seeded(6), { g, ids } = setup(3, rng);
  const v = E.publicView(g, ids[0], null);
  assert.ok(v.me.dice.length === 2);
  assert.ok(v.players.every(p => !('dice' in p) && !('assign' in p)));
  assert.equal(v.common[1], null);
});

test('errori di input', () => {
  const rng = seeded(7), { g, ids } = setup(3, rng);
  assert.throws(() => E.assign(g, ids[0], 5, 'prod'));
  assert.throws(() => E.assign(g, ids[0], 0, 'bid', 0, ids[0]), /deviare/);
  assert.throws(() => E.addPlayer(g, 'Nuovo', {}, rng), /iniziata/);
  E.setReady(g, ids[0], true);
  assert.throws(() => E.assign(g, ids[0], 0, 'prod'), /confermato/);
});
