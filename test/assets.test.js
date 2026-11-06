const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const D = path.join(__dirname, '../docs');
test('ogni immagine e font usati dal gioco esistono', () => {
  const js = fs.readFileSync(path.join(D, 'game.js'), 'utf8'), html = fs.readFileSync(path.join(D, 'index.html'), 'utf8');
  const nomi = new Set(['dado-1', 'dado-2', 'dado-3', 'dado-4', 'dado-5', 'dado-6', 'dado-vuoto']);
  for (const m of js.matchAll(/A\("([a-z-]+)"\)/g)) nomi.add(m[1]);
  for (const m of js.matchAll(/"((?:med|pers|anim|scena|bg|campo)-[a-z-]+)"/g)) nomi.add(m[1]);
  for (const n of nomi) assert.ok(fs.existsSync(path.join(D, 'assets', n + '.webp')), 'manca assets/' + n + '.webp');
  for (const m of html.matchAll(/(assets\/[a-z-]+\.webp|fonts\/[a-z0-9-]+\.woff2)/g)) assert.ok(fs.existsSync(path.join(D, m[1])), 'manca ' + m[1]);
});
