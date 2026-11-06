# 🎃 CUCUZZE — La guerra degli orti

**Gioco da festa multiplayer per TV + telefoni**. Ogni partecipante possiede un campo, coltiva zucche, fa affari e negozia tregue. Di notte, i procioni degli avversari e i sabotaggi possono far saltare tutto.

**Versione:** 1.0 — prototipo giocabile LAN, con regolamento completo per le funzioni presenti. Grafica e bilanciamento ancora migliorabili attraverso playtest.

## Avvio rapido sul Mac

Richiede **Node.js 20+**. Non sono necessarie dipendenze npm.

```bash
git clone https://github.com/Tannoiser2/Cucuzze.git
cd Cucuzze
node server.js
```

Apri `http://localhost:8080/` **sul Mac** oppure `http://IP-DEL-MAC:8080/` **sulla TV TCL** (e sugli altri dispositivi della stessa rete) e seleziona **Crea partita sulla TV**. Sul tabellone trovi un **codice stanza**, un **indirizzo di accesso** e, con connessione Internet per caricare la libreria QR, anche un **QR code**. Gli ospiti, collegati alla stessa Wi-Fi, aprono dal cellulare l'indirizzo indicato e scelgono un nome. Se la TV non carica il QR, basta copiare il link o digitare l'indirizzo e il codice.

Se `8080` è occupata: `PORT=8123 node server.js`, quindi usa la porta 8123 anche sugli altri dispositivi. Per trovare l'IP locale del Mac: `ipconfig getifaddr en0` (se non è la scheda attiva, verifica l'IP nelle impostazioni Rete).

**GitHub Pages non esegue il server**. La modalità multiplayer richiede `node server.js` su Mac, NAS o un hosting Node compatibile. Non esporre direttamente questa versione in Internet: è destinata a una LAN privata.

## Regolamento

**Partecipanti:** 4–10 consigliati (2–10 supportati per le prove). **Durata:** 6 giorni, ognuno composto da Alba, Tramonto e Notte. **Partenza:** 5 zucche a testa, zero semi e zero livelli di recinto. **Vittoria:** più zucche nel magazzino alla fine della sesta Notte.

Ogni giorno, ciascuno lancia **6 dadi privati**. Può spendere **al massimo 3 dadi personali per fase**; i dadi non spesi rimangono disponibili nelle fasi successive, ma si perdono alla fine della giornata.

La TV rivela progressivamente **3 dadi comuni**: uno all'Alba, uno in più al Tramonto e l'ultimo di Notte. Sono riutilizzabili da tutti: **non vengono spesi**. Ogni azione richiede comunque almeno un dado personale. Puoi usare da 1 a 3 dadi personali nella medesima azione per potenziarla.

### 🌅 Alba — preparare il raccolto
- **Semina**: aggiungi semi al campo pari alla somma dei tuoi dadi piazzati, con tetto 8, più bonus delle combinazioni.
- **Contadino**: muovilo in senso orario o antiorario di tante posizioni quant'è la somma dei tuoi dadi. Alla fine dell'Alba il campo dove si trova riceve **+2 semi**.
- **Cinghiale**: muovilo in senso orario o antiorario allo stesso modo. Alla fine dell'Alba distrugge fino a **2 semi** nel campo di arrivo.

### 🌇 Tramonto — raccogliere e fare affari
- **Raccolto**: trasferisci dal campo al magazzino fino alla somma dei dadi piazzati, più bonus delle combinazioni.
- **Recinto**: ogni dado speso può costruire un livello pagando **2 zucche**; massimo livello 2.
- **Mercato**: regala al giocatore scelto fino a un numero di zucche pari ai tuoi dadi piazzati e ricevi fino a **1 zucca di premio dal mercato**.
- **Scambi diretti**: senza consumare dadi puoi proporre a un avversario di scambiare 0–3 zucche contro 0–3 delle sue. Se accetta, lo scambio avviene subito. Massimo **uno scambio concluso per giocatore al giorno**.
- **Tregue pubbliche**: proponi a un altro giocatore un patto di non aggressione per la Notte seguente. Se accetta ed entrambi lo rispettano, ciascuno ottiene **+1 zucca**. Se uno attacca l'altro con procioni o sabotaggio, la TV annuncia il tradimento e nessuno riceve il bonus. Massimo **una tregua accettata per giocatore al giorno**.

### 🌙 Notte — procioni, difesa e sabotaggio
- **Procioni**: scegli segretamente un bersaglio. Se non è di guardia, rubi fino a `2 + (dadi personali spesi - 1) + bonus combinazione / 2` arrotondato in eccesso, con capacità massima `3 - livello recinto`, mai più delle zucche disponibili.
- **Guardia**: difendi il tuo campo bloccando tutti i furti e i sabotaggi di quella Notte.
- **Sabotaggio**: scegli un bersaglio. Se non è di guardia, il suo recinto perde un livello (minimo 0).

Le scelte di una fase si rivelano **soltanto quando tutti hanno confermato** e chi ospita preme *Rivela azioni e avanza*. Tutti giocano in simultanea; nessuno viene eliminato.

### Combinazioni di dadi
I dadi comuni si combinano con i dadi personali **usati nell'azione**, non con tutta la mano. Almeno un dado personale deve contribuire alla combinazione.
- **Coppia**: +2 per Semina/Raccolto; potenziamento dei Procioni.
- **Tris**: +3.
- **Full**: +4.
- **Poker**: +5.
- **Scala di tre**: +2 movimento Contadino/Cinghiale.

I bonus aumentano quantità e capacità secondo l'azione. Le altre azioni non ricevono automaticamente punti aggiuntivi dalle combinazioni. Il gioco indica sul telefono quali combinazioni stai formando.

## Come giocare davanti alla TV
1. Il presentatore crea la stanza.
2. Gli invitati entrano con il loro cellulare.
3. Si discute liberamente: si possono fare promesse, minacce, patti e offerte.
4. Ognuno piazza segretamente i suoi dadi e tocca **Conferma fase**.
5. Quando tutti sono pronti, la TV rivela le azioni e passa alla fase successiva.
6. Dopo la sesta Notte si decreta il vincitore. Dalla TV puoi creare una nuova partita.

## Aspetti tecnici e limiti della versione LAN
- Server Node.js con HTTP e **Server-Sent Events**: aggiornamenti in tempo reale senza WebSocket e senza librerie da installare.
- Browser compatibili: Safari, Chrome, Edge e browser HTML5 moderni su Smart TV. I test con la TCL e i telefoni reali restano da fare.
- Le stanze e i token vengono salvati localmente in `.cucuzze-sessions.json`. Riavviando il server sullo stesso Mac, le partite possono essere ripristinate.
- Il pannello TV usa un token host per avviare o avanzare il gioco. La rete locale deve comunque essere fidata: non sono previsti account e autenticazione Internet.
- Il QR è opzionale e usa una libreria JavaScript CDN; senza connessione Internet resta disponibile il codice stanza e il link.
- La grafica finale, gli effetti sonori, l'accessibilità sulle singole TV e il bilanciamento competitivo richiedono playtest con ospiti reali.

## Verifiche

```bash
node --check server.js
node --check public/app.js
node --test test/*.test.js
```

I test includono un percorso di tre fasi e una partita automatica di sei giorni con sei partecipanti.

## Origine del progetto
I protagonisti Contadino, Cinghiale, Procioni e le azioni di semina, raccolto e recinto derivano dal precedente gioco di carte *Cucuzze* (materiale fornito dall'autore). Il dice placement con sei dadi privati e tre dadi comuni, il ciclo Alba/Tramonto/Notte e la negoziazione digitale sono la nuova evoluzione.
