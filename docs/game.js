/* Cucuzze - interfaccia TV e telefono, rete PeerJS, giocatori finti.
 * La TV e' l'host: tiene lo stato (motore in engine.js), lo salva nel browser e lo invia ai telefoni.
 * Nessun emoji o simbolo Unicode speciale: icone e dadi sono immagini o SVG disegnati qui.
 */
"use strict";
const E = window.CucuzzeEngine;
const $ = id => document.getElementById(id), root = $("app");
const store = { get(k) { try { return localStorage.getItem(k) } catch { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch { } }, del(k) { try { localStorage.removeItem(k) } catch { } } };
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 11);
const SAVE_KEY = "cucuzze2-host-save";
const A = n => "assets/" + n + ".webp";
const remote = new URLSearchParams(location.search).get("room");

let mode = null, testMode = false, hostPeer = null, guestPeer = null, connection = null, peers = new Map(), game = null, me = null, view = null;
let roomCode = "", hostReady = false, codeError = "", offline = false, retryTimer = null, revealTimer = null, revealPlaying = 0, forceArmed = false;
let sel = { die: null, wave: 0, target: "" }, phaseKey = "", resolveTimer = null;

/* ---------- Icone disegnate (SVG) ---------- */
const SVG = {
  seme: '<svg viewBox="0 0 40 40" class="ico"><path d="M20 36V18" stroke="#5c9e3c" stroke-width="3" stroke-linecap="round"/><path d="M20 22c-9 0-12-6-12-11 6 0 12 3 12 11z" fill="#7cc35a"/><path d="M20 19c0-7 5-11 12-11 0 6-4 11-12 11z" fill="#9bd67a"/><ellipse cx="20" cy="37" rx="9" ry="2.5" fill="#6b4a2a"/></svg>',
  recinto: '<svg viewBox="0 0 40 40" class="ico"><g fill="#c9965a" stroke="#4a311a" stroke-width="1.6"><path d="M6 36V12l3-4 3 4v24z"/><path d="M17 36V12l3-4 3 4v24z"/><path d="M28 36V12l3-4 3 4v24z"/><rect x="3" y="16" width="34" height="4"/><rect x="3" y="27" width="34" height="4"/></g></svg>',
  spaventapasseri: '<svg viewBox="0 0 40 40" class="ico"><path d="M20 14v24" stroke="#6b4a2a" stroke-width="3"/><path d="M6 19h28" stroke="#6b4a2a" stroke-width="3"/><path d="M12 19l4 12h8l4-12z" fill="#b5532a" stroke="#4a311a" stroke-width="1.2"/><circle cx="20" cy="10" r="5" fill="#f2d48a" stroke="#4a311a" stroke-width="1.2"/><path d="M12 7h16l-3-5h-10z" fill="#8a5a2b" stroke="#4a311a" stroke-width="1.2"/></svg>',
  cani: '<svg viewBox="0 0 40 40" class="ico"><path d="M8 14c0-6 4-9 7-9l2 4h6l2-4c3 0 7 3 7 9l-3 3v8c0 6-4 10-9 10s-9-4-9-10v-8z" fill="#b07a45" stroke="#4a311a" stroke-width="1.5"/><path d="M8 14l-3 10 6-3zM32 14l3 10-6-3z" fill="#6b4a2a"/><circle cx="16" cy="19" r="1.8" fill="#2a1a0c"/><circle cx="24" cy="19" r="1.8" fill="#2a1a0c"/><ellipse cx="20" cy="27" rx="3.5" ry="2.5" fill="#2a1a0c"/></svg>',
  corvo: '<svg viewBox="0 0 60 40" class="ico"><path d="M4 22c8-2 12-10 22-10 6 0 9 3 12 6l10-2-7 6c0 8-8 12-16 12-6 0-10-2-13-5L4 30l6-6z" fill="#1d1d26"/><path d="M26 14c-4-8-12-11-20-10 6 3 9 8 12 13z" fill="#2b2b38"/><circle cx="38" cy="20" r="1.6" fill="#f2c14e"/></svg>',
};
const DEF_ICON = ["spaventapasseri", "recinto", "cani"];
const PH_ART = [{ ch: "pers-contadino", an: "anim-corvi", med: null }, { ch: "pers-falegname", an: "anim-procioni", med: "med-procioni" }, { ch: "pers-cacciatore", an: "anim-cinghiali", med: "med-cinghiale" }];
const zucca = n => '<span class="stat" title="Zucche"><img class="zucca" src="' + A("zucca") + '" alt="">' + n + '</span>';
const semi = n => '<span class="stat" title="Semi">' + SVG.seme + n + '</span>';
const difese = d => d.map((v, i) => '<span class="stat" title="' + E.PHASES[i].defName + ' livello ' + v + '" style="' + (v ? "" : "opacity:.45") + '">' + SVG[DEF_ICON[i]] + v + '</span>').join("");
const dado = (v, extra) => '<span class="dado" style="background-image:url(' + A(v ? "dado-" + v : "dado-vuoto") + ')">' + (extra || "") + '</span>';
const medaglione = ph => PH_ART[ph].med ? 'background-image:url(' + A(PH_ART[ph].med) + ')' : '';
const medHTML = ph => PH_ART[ph].med ? '<div class="med" style="' + medaglione(ph) + '"></div>' : '<div class="med" style="display:flex;align-items:center;justify-content:center;background:#fbf0d6;border:3px solid #c9965a;border-radius:50%">' + SVG.corvo.replace('class="ico"', 'style="width:80%"') + '</div>';

function notice(t) { const e = $("toast"); e.textContent = t; e.classList.add("visibile"); clearTimeout(notice.t); notice.t = setTimeout(() => e.classList.remove("visibile"), 3500) }
function setBody(cls, ph) { document.body.className = cls + " " + (ph || "ph-sala") }

/* ---------- Salvataggio della TV ---------- */
function saveHost() { if (mode !== "host" || !game || testMode) return; if (game.finished) { store.del(SAVE_KEY); return } store.set(SAVE_KEY, JSON.stringify({ room: roomCode, game, at: Date.now() })) }
function loadSaved() { try { const s = JSON.parse(store.get(SAVE_KEY) || "null"); if (s && s.room && s.game && s.game.v === 2 && !s.game.finished && Date.now() - s.at < 24 * 3600e3) return s } catch { } return null }

/* ---------- Ciclo della TV ---------- */
function onlineSet() { return new Set(peers.keys()) }
function update() {
  view = E.publicView(game, null, mode === "host" && !testMode ? onlineSet() : null);
  saveHost();
  draw();
  for (const [id, c] of peers) send(c, { type: "state", state: E.publicView(game, id, onlineSet()) });
  scheduleResolve();
}
function scheduleResolve() {
  if (mode !== "host" || !game || !game.started || game.finished || game.stage !== "orders") return;
  if (!E.allReady(game) || resolveTimer) return;
  resolveTimer = setTimeout(() => { resolveTimer = null; if (game.stage === "orders" && E.allReady(game)) doResolve() }, testMode ? 250 : 900);
}
function doResolve() {
  forceArmed = false;
  E.resolvePhase(game);
  update();
}
function hostForce() { if (!game || game.stage !== "orders") return; if (!forceArmed) { forceArmed = true; draw(); return } for (const p of game.players) p.ready = true; doResolve() }

/* ---------- Rivelazione animata sulla TV ---------- */
function revealCards(rv) {
  const ph = E.PHASES[rv.phase], cards = [];
  const prod = rv.items.filter(i => i.k === "prod" || i.k === "def");
  if (prod.length) cards.push({ art: A("scena-amici"), html: '<h2>' + ph.name + ': il lavoro nei campi</h2><ul>' + prod.map(i => '<li><b>' + esc(i.who) + '</b> ' + esc(i.text) + '</li>').join("") + '</ul>' });
  rv.items.filter(i => i.k === "onda").forEach(o => {
    const asta = rv.items.find(i => i.k === "asta" && i.wave === o.wave);
    let a = "";
    if (asta && asta.result === "vinta") a = '<div class="esito"><b>' + esc(asta.winner) + '</b> vince il ' + esc(asta.ch) + ' con ' + asta.sum + ' (' + esc(asta.bonus) + ')' + (asta.offers.length > 1 ? '<br><span class="muto">Offerte: ' + asta.offers.map(x => esc(x.name) + ' ' + x.sum).join(", ") + '</span>' : "") + '</div>';
    else if (asta && asta.result === "pareggio") a = '<div class="esito">Asta del ' + esc(asta.ch) + ': <b>pareggio</b> (' + asta.offers.map(x => esc(x.name) + ' ' + x.sum).join(", ") + '), nessuno vince e i dadi sono persi</div>';
    else a = '<div class="esito muto">Nessuno ha puntato sul ' + esc(ph.chName) + '</div>';
    const dev = o.deviatedBy ? '<p class="grande">' + esc(o.deviatedBy) + ' li devia su ' + esc(o.to) + '!</p>' : '<p class="grande">Arrivano su ' + esc(o.to) + '!</p>';
    const res = o.dmg ? '<b>-' + E.unita(o.unit, o.dmg) + '</b> per ' + esc(o.to) : '<b>Nessun danno</b> per ' + esc(o.to);
    const extra = (o.blocked ? ' (' + o.blocked + ' fermati da ' + esc(E.PHASES[rv.phase].defName) + ')' : '') + (o.fence ? '. E rompono un livello di recinto!' : '');
    cards.push({ art: A(o.deviatedBy ? PH_ART[rv.phase].ch : PH_ART[rv.phase].an), target: o.toId, html: '<h2>' + esc(E.animali(E.PHASES[rv.phase], o.size)) + ' verso ' + esc(o.from) + '</h2>' + a + dev + '<div class="esito">' + res + extra + '</div>' });
  });
  return cards;
}
function playReveal(rv, done) {
  if (!rv || revealPlaying === rv.seq) return;
  revealPlaying = rv.seq;
  const cards = revealCards(rv), box = $("rivela"), step = testMode ? 1100 : 4200;
  let i = 0;
  const show = () => {
    document.querySelectorAll(".campo.colpito").forEach(e => e.classList.remove("colpito"));
    if (i >= cards.length) { box.classList.remove("attiva"); box.innerHTML = ""; revealTimer = null; done && done(); return }
    const c = cards[i++];
    box.innerHTML = '<div class="carta"><div class="arte" style="background-image:url(' + c.art + ')"></div><div class="testo">' + c.html + '<div class="controlli" style="margin-top:.8em"><button class="chiaro piccolo" id="salta">Avanti</button></div></div></div>';
    box.classList.add("attiva");
    if (c.target) { const el = document.querySelector('[data-pid="' + c.target + '"]'); if (el) el.classList.add("colpito") }
    $("salta").onclick = () => { clearTimeout(revealTimer); show() };
    revealTimer = setTimeout(show, step);
  };
  show();
}

/* ---------- Rete: TV ---------- */
function send(c, obj) { try { if (c && c.open) c.send(obj) } catch { } }
function connectHost(saved) {
  if (typeof Peer === "undefined") { codeError = "Impossibile caricare la libreria di connessione. Verifica Internet, oppure prova la partita con i giocatori finti."; landing(); return }
  mode = "host"; testMode = false; game = null; hostReady = false; peers.clear();
  roomCode = saved ? saved.room : "cucuzze-" + uid();
  let attempts = 0;
  const open = () => {
    hostPeer = new Peer(roomCode);
    hostPeer.on("open", id => { roomCode = id; if (!game) { game = saved ? saved.game : E.newGame(roomCode); game.room = roomCode; if (saved) { E.log(game, "La TV ha ripreso la partita: i telefoni si ricollegano da soli"); if (game.stage === "reveal") E.advance(game) } } hostReady = true; history.replaceState({}, "", location.pathname); update() });
    hostPeer.on("connection", c => { c.on("data", d => hostMessage(c, d)); c.on("close", () => { const id = [...peers].find(([, v]) => v === c)?.[0]; if (id) peers.delete(id); update() }) });
    hostPeer.on("disconnected", () => { notice("Connessione di rete interrotta: riconnessione..."); try { hostPeer.reconnect() } catch { } });
    hostPeer.on("error", e => {
      if (e && e.type === "unavailable-id" && saved && attempts < 20) { attempts++; try { hostPeer.destroy() } catch { } root.innerHTML = intro("Recupero della stanza in corso... (tentativo " + attempts + " di 20)"); setTimeout(open, 3000); return }
      if (hostReady) { notice("Problema di rete: " + (e && e.message || e)); return }
      codeError = "Connessione fallita: " + (e && e.message || e); landing() });
  };
  setBody("tv", "ph-sala"); root.innerHTML = intro(saved ? "Ripresa della partita in corso..." : "Creazione della stanza online...");
  open();
}
function startTest(nBots) {
  mode = "host"; testMode = true; peers.clear(); roomCode = "prova";
  game = E.newGame("prova");
  for (let i = 0; i < nBots; i++) E.addBot(game);
  E.start(game); update();
}
function hostMessage(c, d) {
  if (!d || typeof d !== "object") return;
  try {
    if (d.type === "join") {
      let p = d.id && game.players.find(x => x.id === d.id);
      if (!p) p = E.addPlayer(game, d.name, {});
      peers.set(p.id, c); send(c, { type: "joined", id: p.id }); update(); return;
    }
    const id = [...peers].find(([, conn]) => conn === c)?.[0];
    if (!id) throw Error("Giocatore non riconosciuto");
    if (d.type === "assign") E.assign(game, id, d.die, d.slot, d.wave, d.target);
    else if (d.type === "ready") E.setReady(game, id, d.ready !== false);
    update();
  } catch (e) { send(c, { type: "error", message: e.message }) }
}

/* ---------- Rete: telefono ---------- */
function connectGuest(code) {
  if (typeof Peer === "undefined") { codeError = "Connessione di rete non disponibile"; landing(); return }
  mode = "guest"; roomCode = code; me = store.get("cucuzze-id-" + code);
  setBody("tel", "ph-sala"); root.innerHTML = intro("Connessione alla TV...");
  guestPeer = new Peer();
  guestPeer.on("open", openLink);
  guestPeer.on("disconnected", () => scheduleRetry());
  guestPeer.on("error", e => {
    if (view) { scheduleRetry(); return }
    codeError = e && e.type === "peer-unavailable" ? "Stanza non trovata: controlla il codice e che la TV sia accesa." : "Stanza non raggiungibile: " + (e && e.message || e);
    landing() });
}
function scheduleRetry() { if (retryTimer) return; if (!offline) { offline = true; draw() } retryTimer = setTimeout(() => { retryTimer = null; if (guestPeer.disconnected) { try { guestPeer.reconnect() } catch { } } else openLink() }, 3000) }
function blankView() { return { room: roomCode, started: false, me: null, players: [], waves: [], history: [] } }
function openLink() {
  const c = guestPeer.connect(roomCode, { reliable: true }); connection = c;
  c.on("open", () => { const name = store.get("cucuzze-name") || ""; if (me || name) send(c, { type: "join", id: me, name }); else { view = view || blankView(); offline = false; draw() } });
  c.on("data", msg => {
    if (msg.type === "state") { offline = false; view = msg.state; if (me && !view.me) { me = null; store.del("cucuzze-id-" + roomCode) } draw() }
    else if (msg.type === "joined") { me = msg.id; store.set("cucuzze-id-" + roomCode, me); draw() }
    else if (msg.type === "error") { notice(msg.message); if (!view) { view = blankView(); offline = false; draw() } } });
  c.on("close", () => { if (connection === c) scheduleRetry() });
  c.on("error", () => { if (connection === c) scheduleRetry() });
}
function act(msg) { send(connection, msg) }

/* ---------- Disegno ---------- */
function intro(t) { return '<div class="tel-wrap"><div class="pannello centro"><h1>Cucuzze</h1><p>' + esc(t) + '</p></div></div>' }
function draw() { if (mode === "host") drawTV(); else drawPhone() }
function link() { return location.href.split("?")[0] + "?room=" + encodeURIComponent(roomCode) }

function landing() {
  if (remote && !codeError) { connectGuest(remote); return }
  mode = null; setBody("tel", "ph-sala");
  const saved = loadSaved();
  root.innerHTML = '<div class="tel-wrap" style="max-width:640px"><div class="banner" style="margin:1em auto 0"><span>Cucuzze</span></div>' +
    '<div class="pannello"><h2>Gioca sulla TV</h2>' +
    (saved ? '<button id="resume" class="verde" style="width:100%;margin-bottom:.6em">Riprendi la partita in corso (giorno ' + saved.game.day + ', ' + saved.game.players.length + ' giocatori)</button>' : "") +
    '<button id="create" style="width:100%">Crea una partita sulla TV</button><p class="muto">Compare un QR code: gli invitati lo inquadrano col telefono e sono dentro.</p>' +
    '<h3>Partita di prova</h3><p class="muto">Solo giocatori finti che giocano da soli, per vedere le regole in azione.</p><div class="riga"><select id="nbot" style="width:auto">' + [3, 4, 5, 6, 7, 8, 9, 10].map(n => '<option value="' + n + '"' + (n === 6 ? " selected" : "") + '>' + n + ' giocatori finti</option>').join("") + '</select><button id="test" class="chiaro">Guarda una partita</button></div></div>' +
    '<div class="pannello"><h2>Entra con il telefono</h2><label>Il tuo nome</label><input id="name" maxlength="22" value="' + esc(store.get("cucuzze-name") || "") + '"><label>Codice della stanza</label><input id="room" value="' + esc(remote || "") + '"><button id="enter" style="width:100%">Entra</button></div>' +
    (codeError ? '<div class="offline">' + esc(codeError) + '</div>' : "") + '</div>';
  codeError = "";
  $("create").onclick = () => { store.del(SAVE_KEY); connectHost(null) };
  if (saved) $("resume").onclick = () => connectHost(saved);
  $("test").onclick = () => startTest(+$("nbot").value);
  $("enter").onclick = () => { const code = $("room").value.trim(); if (!code) return notice("Inserisci il codice della stanza"); store.set("cucuzze-name", $("name").value.trim()); history.replaceState({}, "", location.pathname + "?room=" + encodeURIComponent(code)); connectGuest(code) };
}

function regoleHTML() {
  return '<ul class="regole">' +
    '<li>Si gioca <b>6 giorni</b>, ognuno con <b>Alba, Tramonto e Notte</b>. Vince chi ha più zucche.</li>' +
    '<li>A ogni fase tiri <b>2 dadi</b> e decidi in segreto: <b>produrre</b>, <b>difenderti</b> o <b>puntare all\'asta</b>.</li>' +
    '<li>La TV annuncia gli animali in arrivo verso il campo più ricco: corvi all\'Alba, procioni al Tramonto, cinghiali di Notte.</li>' +
    '<li>Chi vince l\'asta del personaggio (somma più alta) <b>devia gli animali dove vuole</b> e prende un bonus. Pareggio: nessuno vince.</li>' +
    '<li>Le difese fermano parte del danno ma si consumano a ogni colpo. A fine giornata 2 semi diventano 1 zucca.</li></ul>';
}

function campoHTML(p, s, i) {
  const targeted = s.stage === "orders" && s.waves.some(w => w.announced === p.id);
  const winner = s.finished && s.winners.includes(p.id);
  const full = p.pumpkins + p.seeds / 2 >= 14;
  const status = !s.started ? (p.bot ? '<span class="pill bot">finto</span>' : "") : s.finished ? "" : p.online === false ? '<span class="pill off">scollegato</span>' : p.ready ? '<span class="pill pronto">pronto</span>' : '<span class="pill attesa">sceglie</span>';
  return '<div class="campo' + (targeted ? " bersaglio" : "") + (winner ? " vincitore" : "") + '" data-pid="' + esc(p.id) + '">' +
    (targeted ? '<div class="mira" style="' + (medaglione(s.phase) || 'background:#fbf0d6;border-radius:50%;border:3px solid #c9965a') + '">' + (PH_ART[s.phase].med ? "" : SVG.corvo.replace('class="ico"', 'style="width:100%;height:100%"')) + '</div>' : "") +
    '<div class="nome"><span>' + esc(p.name) + '</span>' + status + '</div>' +
    '<div class="terra" style="background-image:url(' + A(full ? "campo-pieno" : "campo-vuoto") + ')"></div>' +
    '<div class="stats">' + zucca(p.pumpkins) + semi(p.seeds) + difese(p.def) + '</div></div>';
}

function ondeHTML(s, forMe) {
  const ph = E.PHASES[s.phase];
  return s.waves.map((w, i) => {
    const t = s.players.find(p => p.id === w.announced), mine = forMe && t && t.id === forMe;
    return '<div class="onda' + (mine ? " mio-bersaglio" : "") + '">' + medHTML(s.phase) + '<div><b class="num">' + esc(E.animali(ph, w.size)) + '</b> verso <b>' + esc(t ? t.name : "?") + '</b>' + (mine ? ' <span class="pill off">sei tu!</span>' : "") +
      '<br><span class="muto">' + E.unita(ph.unit, w.size * ph.perAnimal) + ' di danno. All\'asta: ' + esc(ph.chName) + (s.waves.length > 1 ? " " + (i + 1) : "") + '</span></div></div>';
  }).join("");
}

function drawTV() {
  if (!game) return;
  const s = view || E.publicView(game, null, null);
  if (!s.started) return drawLobby(s);
  const ph = E.PHASES[s.phase];
  setBody("tv", s.finished ? "ph-sala" : "ph-" + ph.key);
  const ready = s.players.filter(p => p.ready).length;
  const ev = s.event;
  const testa = '<div class="tv-testa"><div class="banner"><span>Cucuzze</span></div><div class="fase"><div class="titolo">' + (s.finished ? "Fine della partita" : "Giorno " + s.day + " di 6 - " + ph.name) + '</div>' +
    (ev && !s.finished ? '<div class="pannello evento"><b>' + esc(ev.name) + '</b><br>' + esc(ev.text) + '</div>' : "") + '</div>' +
    (testMode ? '<button class="chiaro piccolo" id="esci">Esci dalla prova</button>' : '<span class="pill" style="background:#fbf0d6">Stanza ' + esc(roomCode) + '</span>') + '</div>';
  let lato;
  if (s.finished) {
    const st = s.standings || [];
    lato = '<div class="pannello"><h2>Classifica finale</h2><div class="podio">' + st.map((p, i) => '<div class="pos' + (s.winners.includes(p.id) ? " primo" : "") + '"><span class="n">' + (i + 1) + '</span><span>' + esc(p.name) + '</span><span>' + zucca(p.pumpkins) + '</span></div>').join("") + '</div><p class="muto">Spareggio: più semi, poi più difese.</p><div class="controlli"><button id="again">Nuova partita</button></div></div>';
  } else {
    lato = '<div class="pannello"><h2>In arrivo</h2>' + ondeHTML(s) + '</div>' +
      '<div class="pannello centro"><h3>Dadi comuni</h3><div class="dadi-comuni">' + s.common.map((v, i) => dado(v, '<small>' + E.PHASES[i].name + '</small>')).join("") + '</div><p class="muto" style="margin-top:1.6em">Si usano per le combinazioni: coppia +2, tris +3, full +4, poker +5</p></div>' +
      '<div class="pannello centro"><p><b>' + ready + ' su ' + s.players.length + '</b> hanno scelto</p><div class="controlli">' + (ready < s.players.length && s.stage === "orders" ? '<button class="chiaro piccolo" id="force">' + (forceArmed ? "Premi ancora per procedere" : "Procedi senza chi manca") + '</button>' : "") + '</div></div>';
  }
  root.innerHTML = '<div class="tv-wrap">' + testa + '<div class="campi' + (s.players.length > 6 ? " molti" : "") + '">' + s.players.map((p, i) => campoHTML(p, s, i)).join("") + '</div><div class="lato">' + lato + '</div>' +
    '<div class="pannello cronaca">' + s.history.slice().reverse().slice(0, 5).map(x => '<div>' + esc(x) + '</div>').join("") + '</div></div>';
  $("force") && ($("force").onclick = hostForce);
  $("esci") && ($("esci").onclick = () => { clearTimeout(revealTimer); $("rivela").classList.remove("attiva"); game = null; testMode = false; landing() });
  $("again") && ($("again").onclick = () => { if (testMode) return startTest(game.players.length); try { hostPeer && hostPeer.destroy() } catch { } store.del(SAVE_KEY); connectHost(null) });
  if (s.stage === "reveal" && game.reveal && revealPlaying !== game.reveal.seq) playReveal(game.reveal, () => { E.advance(game); update() });
}

function drawLobby(s) {
  setBody("tv", "ph-sala");
  root.innerHTML = '<div class="sala"><div class="pannello"><div class="banner" style="margin:0 auto"><span>Cucuzze</span></div><h2 class="centro">La guerra degli orti</h2>' + regoleHTML() + '</div>' +
    '<div class="pannello centro"><h2>Sala d\'attesa</h2><p>Inquadra il QR code con il telefono</p><div class="qr" id="qrcode"></div><p class="muto" style="word-break:break-all">' + esc(link()) + '</p>' +
    '<h3>' + s.players.length + ' giocatori</h3><div class="giocatori-sala" style="justify-content:center">' + s.players.map(p => '<span class="chip">' + esc(p.name) + (p.bot ? ' <span class="pill bot">finto</span> <button class="chiaro piccolo" data-rm="' + esc(p.id) + '">Togli</button>' : "") + '</span>').join("") + '</div>' +
    '<div class="controlli"><button class="chiaro" id="bot">Aggiungi giocatore finto</button><button id="start" ' + (s.players.length < 2 ? "disabled" : "") + '>Inizia la partita</button></div>' + (s.players.length < 2 ? '<p class="muto">Servono almeno 2 giocatori (anche finti).</p>' : "") + '</div></div>';
  if (typeof QRCode !== "undefined") try { new QRCode($("qrcode"), { text: link(), width: 220, height: 220, colorDark: "#3b2716", colorLight: "#ffffff" }) } catch { }
  $("bot").onclick = () => { try { E.addBot(game); update() } catch (e) { notice(e.message) } };
  $("start").onclick = () => { try { E.start(game); update() } catch (e) { notice(e.message) } };
  document.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { E.removePlayer(game, b.dataset.rm); update() });
}

/* ---------- Telefono ---------- */
function drawPhone() {
  const banner = offline ? '<div class="offline">Connessione con la TV persa: ricollegamento in corso...</div>' : "";
  if (!view) { root.innerHTML = intro("Connessione alla TV..."); return }
  const s = view, p = s.me;
  if (!p) {
    setBody("tel", "ph-sala");
    root.innerHTML = '<div class="tel-wrap">' + banner + '<div class="banner" style="margin:0 auto"><span>Cucuzze</span></div><div class="pannello"><h2>Entra nella partita</h2><label>Il tuo nome</label><input id="name" maxlength="22" value="' + esc(store.get("cucuzze-name") || "") + '"><button id="join" style="width:100%">Entra</button></div></div>';
    $("join").onclick = () => { const name = $("name").value.trim(); if (!name) return notice("Scrivi il tuo nome"); store.set("cucuzze-name", name); act({ type: "join", name }) };
    return;
  }
  const mine = s.players.find(x => x.id === p.id);
  if (!s.started) {
    setBody("tel", "ph-sala");
    root.innerHTML = '<div class="tel-wrap">' + banner + '<div class="banner" style="margin:0 auto"><span>Cucuzze</span></div><div class="pannello"><h2>Ciao ' + esc(p.name) + '!</h2><p>Sei nella stanza con ' + (s.players.length - 1) + ' altri. Aspetta che la TV avvii la partita.</p>' + regoleHTML() + '</div></div>';
    return;
  }
  const ph = E.PHASES[s.phase];
  setBody("tel", s.finished ? "ph-sala" : "ph-" + ph.key);
  const testa = '<div class="tel-testa"><span class="nome">' + esc(p.name) + '</span><span class="riga">' + zucca(mine.pumpkins) + semi(mine.seeds) + '</span></div><div class="pannello" style="padding:.5em .8em"><div class="riga" style="justify-content:space-between"><b>' + (s.finished ? "Partita finita" : "Giorno " + s.day + " - " + ph.name) + '</b><span class="riga">' + difese(mine.def) + '</span></div>' + (s.event && !s.finished ? '<div class="muto"><b>' + esc(s.event.name) + ':</b> ' + esc(s.event.text) + '</div>' : "") + '</div>';
  if (s.finished) {
    const st = s.standings || [];
    root.innerHTML = '<div class="tel-wrap">' + banner + testa + '<div class="pannello"><h2>' + (s.winners.includes(p.id) ? "Hai vinto!" : "Classifica") + '</h2><div class="podio">' + st.map((x, i) => '<div class="pos' + (s.winners.includes(x.id) ? " primo" : "") + '"><span class="n">' + (i + 1) + '</span><span>' + esc(x.name) + '</span><span>' + zucca(x.pumpkins) + '</span></div>').join("") + '</div></div></div>';
    return;
  }
  if (s.stage === "reveal" && s.reveal) {
    const it = s.reveal.items;
    root.innerHTML = '<div class="tel-wrap">' + banner + testa + '<div class="pannello"><h2>Guarda la TV!</h2><ul>' +
      it.filter(i => i.k === "asta").map(i => '<li>Asta del ' + esc(i.ch) + ': ' + (i.result === "vinta" ? '<b>' + esc(i.winner) + '</b> con ' + i.sum + ', devia su ' + esc(i.target) : i.result === "pareggio" ? "pareggio, nessuno vince" : "nessuna offerta") + '</li>').join("") +
      it.filter(i => i.k === "onda").map(i => '<li>' + esc(E.animali(E.PHASES[s.reveal.phase], i.size)) + ' su <b>' + esc(i.to) + '</b>: ' + (i.dmg ? "-" + E.unita(i.unit, i.dmg) : "nessun danno") + '</li>').join("") +
      it.filter(i => i.k === "prod" || i.k === "def").map(i => '<li>' + esc(i.who) + ' ' + esc(i.text) + '</li>').join("") + '</ul></div></div>';
    return;
  }
  // fase degli ordini
  const key = s.day + "-" + s.phase; if (key !== phaseKey) { phaseKey = key; const mw = s.waves.findIndex(w => w.announced === p.id); sel = { die: p.assign.findIndex(a => !a) >= 0 ? p.assign.findIndex(a => !a) : null, wave: mw >= 0 ? mw : 0, target: "" } }
  const others = s.players.filter(x => x.id !== p.id);
  if (!others.some(x => x.id === sel.target)) { const rich = others.slice().sort((a, b) => E.score(b) - E.score(a))[0]; sel.target = rich ? rich.id : "" }
  const myWave = s.waves.findIndex(w => w.announced === p.id); if (sel.wave >= s.waves.length) sel.wave = 0;
  const label = a => !a ? "da scegliere" : a.slot === "prod" ? ph.prodName : a.slot === "def" ? ph.defName : "Asta " + ph.chName + (s.waves.length > 1 ? " " + (a.wave + 1) : "");
  const diceHTML = p.dice.map((v, i) => '<button class="mio-dado' + (sel.die === i ? " scelto" : "") + '" data-die="' + i + '" ' + (p.ready ? "disabled" : "") + '>' + dado(v) + '<span class="etichetta">' + esc(label(p.assign[i])) + '</span></button>').join("");
  const art = PH_ART[s.phase];
  const azioni = sel.die === null || p.ready ? '<p class="muto centro">' + (p.ready ? "Hai confermato. Aspetta gli altri." : "Tocca un dado per scegliere cosa farci.") + '</p>' :
    '<div class="azioni">' +
    '<button class="azione" data-slot="prod"><span class="miniatura" style="background-image:url(' + A("scena-amici") + ')"></span><span>' + esc(ph.prodName) + '<small>' + (s.phase === 0 ? "Semi = somma dei dadi (max 8) + combinazione" : s.phase === 1 ? "Trasforma 2 semi per dado in zucche, 1 a 1" : "Metà della somma in semi, esposti ai cinghiali") + '</small></span></button>' +
    '<button class="azione" data-slot="def"><span class="miniatura" style="display:flex;align-items:center;justify-content:center;background:#fbf0d6">' + SVG[DEF_ICON[s.phase]].replace('class="ico"', 'style="width:80%"') + '</span><span>' + esc(ph.defName) + '<small>+1 livello (max 2): ferma ' + ph.block + ' ' + ph.unit + ' per livello, si consuma a ogni colpo</small></span></button>' +
    '<button class="azione" data-slot="bid"><span class="miniatura" style="background-image:url(' + A(art.ch) + ')"></span><span>Asta: ' + esc(ph.chName) + '<small>Chi offre di più devia gli animali e prende ' + esc(ph.bonusText) + '</small></span></button>' +
    '<button class="chiaro piccolo" data-slot="none">Lascia il dado libero</button></div>';
  const bidCount = p.assign.filter(a => a && a.slot === "bid").length;
  const bidSetup = '<div class="pannello"><h3>La tua asta</h3>' + (s.waves.length > 1 ? '<label>Su quale ' + esc(ph.chName) + ' punti?</label><select id="wave">' + s.waves.map((w, i) => '<option value="' + i + '"' + (sel.wave === i ? " selected" : "") + '>' + esc(ph.chName) + ' ' + (i + 1) + ': ' + esc(E.animali(ph, w.size)) + ' verso ' + esc(s.players.find(x => x.id === w.announced)?.name) + '</option>').join("") + '</select>' : "") +
    '<label>Se vinci, su chi mandi gli animali?</label><select id="target">' + others.map(x => '<option value="' + esc(x.id) + '"' + (sel.target === x.id ? " selected" : "") + '>' + esc(x.name) + ' (' + x.pumpkins + ' zucche, ' + x.seeds + ' semi)</option>').join("") + '</select></div>';
  const groups = ["prod", "def", "bid"].map(sl => ({ sl, vals: p.assign.map((a, i) => a && a.slot === sl ? p.dice[i] : null).filter(v => v !== null) })).filter(g => g.vals.length);
  const prev = groups.map(g => '<div>' + esc(E.preview(s, g.sl, g.vals)) + '</div>').join("");
  root.innerHTML = '<div class="tel-wrap">' + banner + testa +
    '<div class="pannello"><h3>In arrivo</h3>' + ondeHTML(s, p.id) + (myWave >= 0 ? '<p class="muto">Per salvarti: difenditi, oppure vinci l\'asta e mandali su qualcun altro.</p>' : "") + '</div>' +
    '<div class="pannello"><h3 class="centro">I tuoi dadi</h3><div class="miei-dadi">' + diceHTML + '</div>' + azioni + (prev ? '<div class="anteprima">' + prev + '</div>' : "") +
    '<p class="muto centro" style="margin:.4em 0 0">Dadi comuni: ' + s.common.filter(v => v !== null).join(", ") + ' (valgono per le combinazioni)</p></div>' +
    (bidCount || sel.die !== null ? bidSetup : "") +
    '</div><div class="barra-conferma">' + (p.ready ? '<button class="chiaro" id="unready">Modifica le scelte</button>' : '<button class="verde" id="ready">' + (p.assign.some(a => !a) ? "Conferma (un dado resta libero)" : "Conferma le scelte") + '</button>') + '</div>';
  document.querySelectorAll("[data-die]").forEach(b => b.onclick = () => { sel.die = sel.die === +b.dataset.die ? null : +b.dataset.die; draw() });
  document.querySelectorAll("[data-slot]").forEach(b => b.onclick = () => {
    const slot = b.dataset.slot, die = sel.die;
    if (slot === "bid") { const w = $("wave"); if (w) sel.wave = +w.value; const t = $("target"); if (t) sel.target = t.value; if (myWave >= 0 && !$("wave")) sel.wave = myWave }
    act({ type: "assign", die, slot: slot === "none" ? null : slot, wave: sel.wave, target: sel.target });
    const next = p.assign.findIndex((a, i) => !a && i !== die); sel.die = next >= 0 ? next : null; draw();
  });
  $("wave") && ($("wave").onchange = e => { sel.wave = +e.target.value; resendBid(p) });
  $("target") && ($("target").onchange = e => { sel.target = e.target.value; resendBid(p) });
  $("ready") && ($("ready").onclick = () => act({ type: "ready", ready: true }));
  $("unready") && ($("unready").onclick = () => act({ type: "ready", ready: false }));
}
function resendBid(p) { const i = p.assign.findIndex(a => a && a.slot === "bid"); if (i >= 0) act({ type: "assign", die: i, slot: "bid", wave: sel.wave, target: sel.target }) }

if (remote) connectGuest(remote); else landing();
