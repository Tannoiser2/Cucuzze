# Cucuzze - La guerra degli orti

Gioco da festa per TV e telefoni, da 4 a 10 giocatori (si può provare anche in 2 o 3, completando con giocatori finti).

**Si gioca qui: https://tannoiser2.github.io/Cucuzze/**

Apri l'indirizzo sul browser della TV e premi **Crea una partita sulla TV**. Compare un QR code: gli invitati lo inquadrano col telefono, scrivono il nome e sono dentro. Niente app, niente server da avviare. Dalla sala d'attesa puoi aggiungere **giocatori finti** (Zio Peppino, Comare Rosina, Mastro Gennaro...) per riempire il tavolo o per fare le prove.

Per vedere le regole in azione senza nessuno, usa **Partita di prova**: da 3 a 10 giocatori finti giocano da soli sulla TV.

## Regole (prototipo, versione "arrivi deviabili")

- **Partita**: 6 giorni, ognuno con Alba, Tramonto e Notte. Si parte con 5 zucche. Vince chi ha più zucche; in caso di pareggio più semi, poi più livelli di difesa.
- **Dadi**: a ogni fase ognuno tira **2 dadi** (non si conservano). Ogni dado va su una di tre azioni, scelte in segreto sul telefono:
  - **Produci**: Alba *Semina* (semi = somma dei dadi, massimo 8, più combinazione); Tramonto *Raccolto* (2 semi per dado diventano zucche, 1 a 1); Notte *Concime* (metà della somma in semi).
  - **Difesa**: +1 livello per dado, massimo 2. Alba *Spaventapasseri* (ogni livello ferma 2 semi), Tramonto *Recinto* (ferma 1 zucca), Notte *Cani* (ferma 2 semi). Ogni ondata che ti colpisce consuma 1 livello.
  - **Asta**: punti sul personaggio della fase (*Contadino*, *Falegname*, *Cacciatore*). Vince la somma più alta; in pareggio non vince nessuno e chi perde perde i dadi. Il vincitore **devia gli animali su chi vuole** e prende un bonus (+2 semi, +1 livello di recinto, +1 zucca).
- **Animali**: a ogni fase la TV annuncia le ondate verso i campi più ricchi: **corvi** all'Alba (2 semi per corvo), **procioni** al Tramonto (1 zucca per procione), **cinghiali** di Notte (2 semi per cinghiale, e rompono un livello di recinto). La prima ondata è grande quanto il dado comune della fase.
- **Ondate e personaggi**: 1 con 4-5 giocatori, 2 con 6-8, 3 con 9-10. Ogni ondata ha il suo personaggio all'asta.
- **Combinazioni**: i dadi comuni (uno scoperto per fase) si combinano con i tuoi per Semina, Raccolto e Concime: coppia +2, tris +3, full +4, poker +5.
- **Crescita**: a fine giornata 2 semi diventano 1 zucca.
- **Eventi**: ogni giorno un evento cambia una regola (Pioggia, Gelata, Stormo, Luna piena, Nebbia, Fiera, Festa del paese...). Il sesto giorno è sempre la **Sagra della Cucuzza**.

## Se qualcosa va storto durante la serata

- **La TV ricarica la pagina o si spegne**: riapri l'indirizzo e premi **Riprendi la partita in corso**. La partita è salvata nel browser della TV a ogni mossa; i telefoni si ricollegano da soli.
- **Un telefono si scarica**: sulla TV compare "scollegato" e il pulsante **Procedi senza chi manca** (va premuto due volte). I dadi non assegnati di quel giocatore vanno persi.
- L'interfaccia non usa emoji né simboli Unicode speciali: dadi e icone sono immagini o disegni. `python3 tools/controlla_glifi.py` verifica che ogni carattere dei testi esista nei font.

## Struttura

- `docs/engine.js`: regole, eventi e giocatori finti (stesso codice su TV, test e simulazioni).
- `docs/game.js`: interfaccia TV e telefono, rete PeerJS, rivelazione animata.
- `docs/assets/`, `docs/fonts/`: grafica (dalla cartella originale di Cucuzze) e font Chewy e Nunito.
- `test/`: `npm test` esegue i test del motore, una partita completa in rete simulata (TV, 2 telefoni, giocatori finti, ricarica della TV) e i test del vecchio server.
- `server.js`, `public/`: vecchia versione con server Node, tenuta solo come riferimento.

La TV ospita la partita; i telefoni si collegano via WebRTC con PeerJS Cloud. Serve Internet su tutti i dispositivi; su alcune reti molto restrittive WebRTC può non collegarsi.
