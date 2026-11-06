/* Cucuzze - motore di gioco (regole, eventi, giocatori finti).
 * Funziona nel browser (window.CucuzzeEngine) e in Node (module.exports).
 * Tutto lo stato è un oggetto JSON serializzabile: la TV lo salva e lo invia ai telefoni.
 */
(function (root) {
  "use strict";

  const DAYS = 6, START_PUMPKINS = 5, DICE_PER_PHASE = 2, DEF_MAX = 2, GROWTH = 2, SEMINA_CAP = 8;

  // Le tre ore del giorno: ognuna ha una produzione, una difesa fissa, un animale e un personaggio all'asta.
  const PHASES = [
    { key: "alba", name: "Alba", prod: "semina", prodName: "Semina", def: "spaventapasseri", defName: "Spaventapasseri",
      animal: "corvi", animalName: "Corvi", animalOne: "corvo", ch: "contadino", chName: "Contadino", chPlural: "Contadini",
      unit: "semi", perAnimal: 2, block: 2, bonusText: "+2 semi" },
    { key: "tramonto", name: "Tramonto", prod: "raccolto", prodName: "Raccolto", def: "recinto", defName: "Recinto",
      animal: "procioni", animalName: "Procioni", animalOne: "procione", ch: "falegname", chName: "Falegname", chPlural: "Falegnami",
      unit: "zucche", perAnimal: 1, block: 1, bonusText: "+1 livello di recinto" },
    { key: "notte", name: "Notte", prod: "concime", prodName: "Concime", def: "cani", defName: "Cani",
      animal: "cinghiali", animalName: "Cinghiali", animalOne: "cinghiale", ch: "cacciatore", chName: "Cacciatore", chPlural: "Cacciatori",
      unit: "semi", perAnimal: 2, block: 2, bonusText: "+1 zucca" },
  ];

  const EVENTS = [
    { id: "serena", name: "Giornata serena", text: "Nessuna sorpresa: si lavora e basta." },
    { id: "pioggia", name: "Pioggia", text: "La Semina dà 2 semi in più.", seminaPlus: 2 },
    { id: "gelata", name: "Gelata", text: "La Semina rende la metà.", seminaHalf: true },
    { id: "stormo", name: "Stormo", text: "All'Alba ogni ondata ha 2 corvi in più.", extra: [2, 0, 0] },
    { id: "affamati", name: "Procioni affamati", text: "Al Tramonto ogni ondata ha 2 procioni in più.", extra: [0, 2, 0] },
    { id: "lunapiena", name: "Luna piena", text: "Stanotte ogni ondata ha 2 cinghiali in più.", extra: [0, 0, 2] },
    { id: "nebbia", name: "Nebbia", text: "Oggi gli animali puntano un campo a caso, non il più ricco.", randomTargets: true },
    { id: "fiera", name: "Fiera", text: "Il Raccolto converte 3 semi per dado invece di 2.", raccoltoPerDie: 3 },
    { id: "festa", name: "Festa del paese", text: "Chi vince un'asta prende anche 1 zucca.", auctionPumpkin: 1 },
  ];
  const SAGRA = { id: "sagra", name: "Sagra della Cucuzza", text: "Ultimo giorno! Il Raccolto converte 3 semi per dado e chi vince un'asta prende 1 zucca.", raccoltoPerDie: 3, auctionPumpkin: 1 };

  // Giocatori finti: nomi di paese e uno stile di gioco ciascuno.
  const BOTS = [
    ["Zio Peppino", "economico"], ["Comare Rosina", "difensivo"], ["Mastro Gennaro", "vendicativo"], ["Donna Carmela", "equilibrato"],
    ["Compare Turiddu", "astuto"], ["Nonna Assunta", "difensivo"], ["Don Ciccio", "economico"], ["Zia Nunziata", "vendicativo"],
    ["Pasquale lo Zappatore", "equilibrato"], ["Cuncetta", "astuto"], ["Mimmo del Trattore", "economico"], ["Filomena", "equilibrato"],
  ];
  const STYLES = {
    economico: { prod: 1.4, def: 0.8, bid: 0.7, mean: 0.5 },
    difensivo: { prod: 1.0, def: 1.5, bid: 1.0, mean: 0.5 },
    vendicativo: { prod: 1.0, def: 1.0, bid: 1.3, mean: 1.8 },
    equilibrato: { prod: 1.0, def: 1.0, bid: 1.0, mean: 1.0 },
    astuto: { prod: 1.1, def: 0.9, bid: 1.2, mean: 1.2 },
  };

  const animali = (ph, n) => n + " " + (n === 1 ? ph.animalOne : ph.animal);
  const unita = (u, n) => n + " " + (n === 1 ? (u === "zucche" ? "zucca" : u === "semi" ? "seme" : u) : u);
  const wavesFor = n => n <= 5 ? 1 : n <= 8 ? 2 : 3;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const uid = rng => Math.floor(rng() * 36 ** 8).toString(36).padStart(8, "0");
  const d6 = rng => 1 + Math.floor(rng() * 6);
  const score = p => p.pumpkins + p.seeds / GROWTH;

  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

  // Combinazioni: i tuoi dadi usati nell'azione + i dadi comuni già scoperti.
  function comboOf(own, shared) {
    if (!own.length) return { bonus: 0, name: "" };
    const pool = own.concat(shared), c = n => pool.filter(v => v === n).length, u = [...new Set(pool)];
    const three = u.find(v => c(v) >= 3);
    const full = three !== undefined && u.some(v => v !== three && c(v) >= 2) && own.some(v => c(v) >= 2);
    if (own.some(v => c(v) >= 4)) return { bonus: 5, name: "Poker" };
    if (full) return { bonus: 4, name: "Full" };
    if (own.some(v => c(v) >= 3)) return { bonus: 3, name: "Tris" };
    if (own.some(v => c(v) >= 2)) return { bonus: 2, name: "Coppia" };
    return { bonus: 0, name: "" };
  }

  function newGame(room) {
    return { v: 2, room: room || "", started: false, finished: false, day: 0, phase: 0, stage: "lobby",
      common: [null, null, null], event: null, deck: [], waves: [], players: [], history: [], reveal: null, revealSeq: 0, winners: [] };
  }

  function addPlayer(g, name, opts, rng) {
    rng = rng || Math.random;
    if (g.started) throw Error("La partita è già iniziata");
    if (g.players.length >= 10) throw Error("Stanza piena: massimo 10 giocatori");
    name = String(name || "").trim().slice(0, 22);
    if (!name) throw Error("Inserisci un nome");
    if (g.players.some(p => p.name.toLowerCase() === name.toLowerCase())) throw Error("Nome già usato: scegline un altro");
    const p = { id: (opts && opts.id) || uid(rng), name, bot: !!(opts && opts.bot), style: (opts && opts.style) || null,
      pumpkins: START_PUMPKINS, seeds: 0, def: [0, 0, 0], dice: [], assign: [], ready: false, wins: 0, hits: 0 };
    g.players.push(p);
    log(g, p.name + (p.bot ? " (giocatore finto)" : "") + " entra nella valle");
    return p;
  }
  function addBot(g, rng) {
    rng = rng || Math.random;
    const free = BOTS.filter(([n]) => !g.players.some(p => p.name === n));
    if (!free.length) throw Error("Non ci sono altri giocatori finti");
    const [name, style] = free[Math.floor(rng() * free.length)];
    return addPlayer(g, name, { bot: true, style }, rng);
  }
  function removePlayer(g, id) {
    if (g.started) throw Error("La partita è già iniziata");
    const p = g.players.find(x => x.id === id); if (!p) return;
    g.players = g.players.filter(x => x !== p); log(g, p.name + " lascia la valle");
  }

  function log(g, text) { g.history.push(text); if (g.history.length > 60) g.history = g.history.slice(-60); }

  function start(g, rng) {
    rng = rng || Math.random;
    if (g.started) return;
    if (g.players.length < 2) throw Error("Servono almeno 2 giocatori");
    g.started = true; g.day = 0;
    g.deck = shuffle(EVENTS.map(e => e.id), rng);
    log(g, "La partita comincia: 6 giorni per far crescere più cucuzze di tutti");
    newDay(g, rng);
  }

  function eventOf(g) { return g.event === "sagra" ? SAGRA : EVENTS.find(e => e.id === g.event) || EVENTS[0]; }

  function newDay(g, rng) {
    g.day++;
    g.common = [d6(rng), d6(rng), d6(rng)];
    g.event = g.day === DAYS ? "sagra" : g.deck[(g.day - 1) % g.deck.length];
    const ev = eventOf(g);
    log(g, "Giorno " + g.day + ": " + ev.name + ". " + ev.text);
    g.phase = 0; newPhase(g, rng);
  }

  function ranking(g, rng) {
    const r = g.players.map(p => ({ p, k: rng() })).sort((a, b) => score(b.p) - score(a.p) || a.k - b.k);
    return r.map(x => x.p);
  }

  function newPhase(g, rng) {
    const ph = PHASES[g.phase], ev = eventOf(g), n = g.players.length, k = wavesFor(n);
    const order = ev.randomTargets ? shuffle(g.players.slice(), rng) : ranking(g, rng);
    g.waves = [];
    for (let i = 0; i < k; i++) {
      const base = i === 0 ? g.common[g.phase] : d6(rng);
      g.waves.push({ size: base + (ev.extra ? ev.extra[g.phase] : 0), announced: order[i % n].id });
    }
    for (const p of g.players) { p.dice = Array.from({ length: DICE_PER_PHASE }, () => d6(rng)); p.assign = p.dice.map(() => null); p.ready = false; }
    g.stage = "orders"; g.reveal = null;
    const names = g.waves.map(w => animali(ph, w.size) + " verso " + nameOf(g, w.announced));
    log(g, ph.name + " del giorno " + g.day + ": in arrivo " + names.join(", "));
    for (const p of g.players) if (p.bot) botPlay(g, p, rng);
  }

  function nameOf(g, id) { const p = g.players.find(x => x.id === id); return p ? p.name : "?"; }

  // ---------- Ordini dei giocatori ----------
  function assign(g, pid, die, slot, wave, target) {
    const p = g.players.find(x => x.id === pid);
    if (!p || !g.started || g.finished) throw Error("Partita non disponibile");
    if (g.stage !== "orders") throw Error("Aspetta la fine della rivelazione");
    if (p.ready) throw Error("Hai già confermato: tocca Modifica per cambiare");
    if (!Number.isInteger(die) || die < 0 || die >= p.dice.length) throw Error("Dado non valido");
    if (slot === null || slot === "none") { p.assign[die] = null; return; }
    if (!["prod", "def", "bid"].includes(slot)) throw Error("Azione non valida");
    if (slot === "bid") {
      if (!Number.isInteger(wave) || wave < 0 || wave >= g.waves.length) throw Error("Scegli quale personaggio vuoi all'asta");
      if (!g.players.some(x => x.id === target && x.id !== pid)) throw Error("Scegli su chi deviare gli animali");
      p.assign[die] = { slot, wave, target };
      // tutti i dadi d'asta del giocatore vanno sullo stesso personaggio e sullo stesso bersaglio
      p.assign.forEach((a, i) => { if (a && a.slot === "bid") p.assign[i] = { slot, wave, target }; });
    } else p.assign[die] = { slot };
  }
  function setReady(g, pid, ready) {
    const p = g.players.find(x => x.id === pid); if (!p) throw Error("Giocatore sconosciuto");
    if (g.stage !== "orders") throw Error("Aspetta la fine della rivelazione");
    p.ready = !!ready;
  }
  const allReady = g => g.players.every(p => p.ready);

  // ---------- Risoluzione di una fase ----------
  function resolvePhase(g, rng) {
    rng = rng || Math.random;
    const ph = PHASES[g.phase], ev = eventOf(g), shared = g.common.slice(0, g.phase + 1);
    const items = [], byId = id => g.players.find(p => p.id === id);
    const diceOf = (p, slot) => p.assign.map((a, i) => a && a.slot === slot ? p.dice[i] : null).filter(v => v !== null);
    // 1) aste: una per ondata
    const winners = g.waves.map((w, wi) => {
      const bids = g.players.map(p => ({ p, a: p.assign.find(a => a && a.slot === "bid" && a.wave === wi), s: sum(p.assign.map((a, i) => a && a.slot === "bid" && a.wave === wi ? p.dice[i] : 0)) })).filter(b => b.a);
      if (!bids.length) { items.push({ k: "asta", wave: wi, ch: ph.chName, result: "vuota" }); return null; }
      const top = Math.max(...bids.map(b => b.s)), tops = bids.filter(b => b.s === top);
      const offers = bids.map(b => ({ name: b.p.name, sum: b.s })).sort((a, b) => b.sum - a.sum);
      if (tops.length > 1) { items.push({ k: "asta", wave: wi, ch: ph.chName, result: "pareggio", offers }); log(g, "Asta del " + ph.chName + ": pareggio a " + top + ", nessuno vince"); return null; }
      const win = tops[0];
      win.p.wins++;
      // bonus del personaggio
      if (g.phase === 0) win.p.seeds += 2;
      if (g.phase === 1) win.p.def[1] = Math.min(DEF_MAX, win.p.def[1] + 1);
      if (g.phase === 2) win.p.pumpkins += 1;
      if (ev.auctionPumpkin) win.p.pumpkins += ev.auctionPumpkin;
      items.push({ k: "asta", wave: wi, ch: ph.chName, result: "vinta", winner: win.p.name, winnerId: win.p.id, sum: top, offers, target: byId(win.a.target).name, bonus: ph.bonusText + (ev.auctionPumpkin ? " e 1 zucca" : "") });
      log(g, win.p.name + " vince il " + ph.chName + " con " + top + " (" + ph.bonusText + ")");
      return { p: win.p, target: win.a.target };
    });
    // 2) produzione e difese
    for (const p of g.players) {
      const prod = diceOf(p, "prod");
      if (prod.length) {
        const b = comboOf(prod, shared), s = sum(prod);
        if (g.phase === 0) {
          let n = Math.min(SEMINA_CAP, s) + b.bonus + (ev.seminaPlus || 0); if (ev.seminaHalf) n = Math.ceil(n / 2);
          p.seeds += n; items.push({ k: "prod", who: p.name, text: "semina " + n + " semi" + (b.name ? " (" + b.name + ")" : "") });
        } else if (g.phase === 1) {
          const cap = prod.length * (ev.raccoltoPerDie || 2) + b.bonus, n = Math.min(p.seeds, cap);
          p.seeds -= n; p.pumpkins += n; items.push({ k: "prod", who: p.name, text: "raccoglie " + n + " zucche" + (b.name ? " (" + b.name + ")" : "") });
        } else {
          const n = Math.ceil((Math.min(SEMINA_CAP, s) + b.bonus) / 2);
          p.seeds += n; items.push({ k: "prod", who: p.name, text: "concima: +" + n + " semi" + (b.name ? " (" + b.name + ")" : "") });
        }
      }
      const def = diceOf(p, "def").length;
      if (def) { const before = p.def[g.phase]; p.def[g.phase] = Math.min(DEF_MAX, before + def); if (p.def[g.phase] > before) items.push({ k: "def", who: p.name, text: ph.defName + " al livello " + p.def[g.phase] }); }
    }
    // 3) gli animali colpiscono
    g.waves.forEach((w, wi) => {
      const win = winners[wi];
      const t = byId(win ? win.target : w.announced);
      const raw = w.size * ph.perAnimal, blocked = Math.min(raw, t.def[g.phase] * ph.block), dmgRaw = raw - blocked;
      let dmg;
      if (g.phase === 1) { dmg = Math.min(t.pumpkins, dmgRaw); t.pumpkins -= dmg; }
      else { dmg = Math.min(t.seeds, dmgRaw); t.seeds -= dmg; }
      const worn = t.def[g.phase] > 0; if (worn) t.def[g.phase]--;
      let fence = false; if (g.phase === 2 && dmgRaw > 0 && t.def[1] > 0) { t.def[1]--; fence = true; }
      t.hits++;
      items.push({ k: "onda", wave: wi, animal: ph.animalName, size: w.size, from: nameOf(g, w.announced), to: t.name, toId: t.id,
        deviatedBy: win ? win.p.name : null, raw, blocked, dmg, unit: ph.unit, worn: worn ? ph.defName : null, fence });
      log(g, animali(ph, w.size) + " su " + t.name + (win ? " (deviati da " + win.p.name + ")" : "") + ": " + (dmg ? "-" + unita(ph.unit, dmg) : "nessun danno") + (blocked ? ", " + blocked + " fermati da " + ph.defName : "") + (fence ? ", recinto rotto" : ""));
    });
    // 4) avanzamento
    for (const p of g.players) { p.assign = p.dice.map(() => null); p.ready = false; }
    g.revealSeq++;
    g.reveal = { seq: g.revealSeq, day: g.day, phase: g.phase, items };
    g.stage = "reveal";
    return g.reveal;
  }

  // Dopo la rivelazione: fase successiva, fine giornata o fine partita.
  function advance(g, rng) {
    rng = rng || Math.random;
    if (g.finished) return;
    if (g.phase < 2) { g.phase++; newPhase(g, rng); return; }
    const growth = [];
    for (const p of g.players) { const z = Math.floor(p.seeds / GROWTH); p.pumpkins += z; p.seeds -= z * GROWTH; if (z) growth.push(p.name + " +" + z); }
    log(g, "Fine del giorno " + g.day + ": i semi crescono" + (growth.length ? " (" + growth.join(", ") + ")" : ""));
    if (g.day >= DAYS) return finish(g);
    newDay(g, rng);
  }

  function finish(g) {
    g.finished = true; g.stage = "end";
    const key = p => [p.pumpkins, p.seeds, sum(p.def)];
    const cmp = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; };
    const sorted = g.players.slice().sort(cmp);
    g.winners = sorted.filter(p => cmp(p, sorted[0]) === 0).map(p => p.id);
    const names = sorted.filter(p => g.winners.includes(p.id)).map(p => p.name);
    log(g, (names.length > 1 ? "Pareggio perfetto tra " + names.join(" e ") : "Vince " + names[0]) + " con " + sorted[0].pumpkins + " zucche");
    g.standings = sorted.map(p => ({ id: p.id, name: p.name, pumpkins: p.pumpkins, seeds: p.seeds, def: sum(p.def) }));
  }

  // ---------- Giocatori finti ----------
  function botPlay(g, p, rng) {
    const st = STYLES[p.style] || STYLES.equilibrato, ph = PHASES[g.phase], ev = eventOf(g), shared = g.common.slice(0, g.phase + 1);
    const daysLeft = DAYS - g.day + 1, n = g.players.length, rank = ranking(g, rng);
    const expDmg = (t, w) => { const raw = w.size * ph.perAnimal - t.def[g.phase] * ph.block; const res = g.phase === 1 ? t.pumpkins : t.seeds + (g.phase === 0 ? 6 : 0); return Math.max(0, Math.min(res, raw)) * (g.phase === 1 ? 1 : 1 / GROWTH); };
    // ondata su cui puntare: quella annunciata su di me, altrimenti la più grande
    let wi = g.waves.findIndex(w => w.announced === p.id);
    if (wi < 0) wi = g.waves.reduce((b, w, i) => w.size > g.waves[b].size ? i : b, 0);
    // bersaglio della deviazione: chi guida, con difesa bassa
    let victim = null, best = -1e9;
    for (const t of g.players) if (t !== p) { const v = expDmg(t, g.waves[wi]) + (rank.indexOf(t) < 2 ? 2 * st.mean : 0) + rng() * 0.4; if (v > best) { best = v; victim = t; } }
    const typicalBid = 7.5;
    let bestPlan = null, bestV = -1e9;
    const slots = ["prod", "def", "bid", "none"];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      const plan = [slots[a], slots[b]], v = { prod: [], def: [], bid: [] };
      plan.forEach((s, i) => { if (s !== "none") v[s].push(p.dice[i]); });
      let val = 0;
      if (v.prod.length) {
        const c = comboOf(v.prod, shared).bonus, s = sum(v.prod);
        if (g.phase === 0) { let k = Math.min(SEMINA_CAP, s) + c + (ev.seminaPlus || 0); if (ev.seminaHalf) k = Math.ceil(k / 2); val += st.prod * k / GROWTH * 0.85; }
        if (g.phase === 1) val += st.prod * Math.min(p.seeds, v.prod.length * (ev.raccoltoPerDie || 2) + c) * 0.55;
        if (g.phase === 2) val += st.prod * Math.ceil((Math.min(SEMINA_CAP, s) + c) / 2) / GROWTH * 0.7;
      }
      if (v.def.length) {
        const lv = Math.min(v.def.length, DEF_MAX - p.def[g.phase]);
        const hitRate = rank.indexOf(p) < g.waves.length + 1 ? 0.8 : 0.15;
        val += st.def * lv * ph.block * (g.phase === 1 ? 1 : 1 / GROWTH) * hitRate * Math.min(daysLeft, 3) * 0.9;
      }
      if (v.bid.length) {
        const s = sum(v.bid), pwin = 1 / (1 + Math.exp(-(s - typicalBid) / 1.8)), w = g.waves[wi];
        const mine = w.announced === p.id ? expDmg(p, w) : expDmg(p, w) * 0.3;
        val += st.bid * pwin * (mine + expDmg(victim, w) * 0.3 * st.mean + 1);
      }
      val += rng() * 0.3;
      if (val > bestV) { bestV = val; bestPlan = plan; }
    }
    bestPlan.forEach((s, i) => { p.assign[i] = s === "none" ? null : s === "bid" ? { slot: "bid", wave: wi, target: victim.id } : { slot: s }; });
    p.ready = true;
  }

  // Stato visibile a un telefono: niente dadi o scelte altrui prima della rivelazione.
  function publicView(g, viewerId, online) {
    const me = g.players.find(p => p.id === viewerId);
    return {
      room: g.room, started: g.started, finished: g.finished, day: g.day, phase: g.phase, stage: g.stage,
      common: g.common.map((v, i) => g.started && (i < g.phase || (i === g.phase)) ? v : null),
      event: g.started ? eventOf(g) : null, waves: g.waves, reveal: g.reveal, winners: g.winners, standings: g.standings || null,
      players: g.players.map(p => ({ id: p.id, name: p.name, bot: p.bot, pumpkins: p.pumpkins, seeds: p.seeds, def: p.def, ready: p.ready, online: p.bot || !online || online.has(p.id) })),
      history: g.history.slice(-16),
      me: me ? { id: me.id, name: me.name, dice: me.dice, assign: me.assign, ready: me.ready } : null,
    };
  }

  // Anteprima dell'effetto di una scelta, per il telefono.
  function preview(view, slot, values) {
    const ph = PHASES[view.phase], ev = view.event || {}, shared = view.common.filter(v => v !== null), me = view.players.find(p => p.id === view.me.id);
    if (!values.length) return "";
    const c = comboOf(values, shared), s = sum(values), combo = c.name ? " con " + c.name + " (+" + c.bonus + ")" : "";
    if (slot === "prod") {
      if (view.phase === 0) { let n = Math.min(SEMINA_CAP, s) + c.bonus + (ev.seminaPlus || 0); if (ev.seminaHalf) n = Math.ceil(n / 2); return "Semina: +" + n + " semi" + combo; }
      if (view.phase === 1) { const cap = values.length * (ev.raccoltoPerDie || 2) + c.bonus; return "Raccolto: fino a " + cap + " semi diventano zucche (ne hai " + me.seeds + ")" + combo; }
      return "Concime: +" + Math.ceil((Math.min(SEMINA_CAP, s) + c.bonus) / 2) + " semi" + combo;
    }
    if (slot === "def") return ph.defName + ": +" + values.length + " livello (massimo " + DEF_MAX + "), ogni livello ferma " + ph.block + " " + ph.unit;
    return "Offerta all'asta: " + s + " (conta solo la somma; in caso di pareggio nessuno vince)";
  }

  const api = { animali, unita, PHASES, EVENTS, SAGRA, BOTS, STYLES, DAYS, DEF_MAX, wavesFor, comboOf, newGame, addPlayer, addBot, removePlayer, start, assign, setReady, allReady, resolvePhase, advance, publicView, preview, eventOf, score, log };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CucuzzeEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
