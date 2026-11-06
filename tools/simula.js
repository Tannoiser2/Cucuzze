#!/usr/bin/env node
// Partite automatiche con i giocatori finti, usando il motore vero del gioco.
// Uso: node tools/simula.js [partite=300]
const E = require("../docs/engine.js");
const N = +(process.argv[2] || 300);
console.log("giocatori | zucche medie | distacco 1-2 | pareggi | aste vinte | indice per stile (1.00 = equilibrato)");
for (let n = 4; n <= 10; n++) {
  const fin = [], marg = []; let ties = 0, auc = 0, aucW = 0; const win = {}, seat = {};
  for (let k = 0; k < N; k++) {
    const g = E.newGame("sim"); for (let i = 0; i < n; i++) E.addBot(g); E.start(g);
    while (!g.finished) { const r = E.resolvePhase(g); for (const it of r.items) if (it.k === "asta" && it.result !== "vuota") { auc++; if (it.result === "vinta") aucW++; } E.advance(g); }
    const s = g.standings; fin.push(...s.map(x => x.pumpkins)); marg.push(s[0].pumpkins - s[1].pumpkins); if (g.winners.length > 1) ties++;
    for (const p of g.players) { seat[p.style] = (seat[p.style] || 0) + 1; if (g.winners.includes(p.id)) win[p.style] = (win[p.style] || 0) + 1 / g.winners.length; }
  }
  const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), tot = Object.values(seat).reduce((a, b) => a + b, 0);
  const idx = Object.keys(seat).map(s => s + " " + (((win[s] || 0) / N) / (seat[s] / tot)).toFixed(2)).join(", ");
  console.log(String(n).padStart(9), "|", avg(fin).padStart(12), "|", avg(marg).padStart(12), "|", (100 * ties / N).toFixed(0).padStart(6) + "%", "|", (auc ? (100 * aucW / auc).toFixed(0) : "-").padStart(9) + "%", "|", idx);
}
