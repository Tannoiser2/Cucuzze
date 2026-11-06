# 🎃 Cucuzze — multiplayer TV + cellulari

Prototipo sperimentale HTML/CSS/JavaScript con server Node.js senza dipendenze esterne.

## Avvio sul Mac

```bash
git clone https://github.com/Tannoiser2/Cucuzze.git
cd Cucuzze
node server.js
```

Apri **http://localhost:8080/** sul computer o browser TV. Usa il pulsante **Crea stanza**; dal cellulare, connesso alla stessa Wi-Fi, apri `http://IP-DEL-MAC:8080/` e inserisci il codice stanza. Il pannello TV mostra un collegamento per i partecipanti. Per individuare l'IP locale del Mac: `ipconfig getifaddr en0`. Puoi cambiare la porta con `PORT=8123 node server.js`.

## Regole del prototipo

- 2–10 giocatori per i test (4–10 consigliati), 6 giorni, 5 zucche iniziali.
- Ogni giorno: 6 dadi personali segreti per giocatore; si piazzano massimo 3 dadi per fase e ogni dado si usa una volta.
- Board comune di 3 dadi: uno rivelato all'Alba, due al Tramonto, tre alla Notte; tutti possono usarli per potenziare le azioni senza consumarli.
- Alba: Semina, Contadino, Cinghiale.
- Tramonto: Raccolto, Recinto, Mercato.
- Notte: Procioni, Guardia, Sabotaggio.
- Coppia: +2 semi con Semina, +2 capacità con Raccolto, +1 potenziale bottino Procioni.
- Scala: +2 movimento Contadino/Cinghiale. Almeno un dado personale piazzato deve far parte della combinazione.
- Tutte le azioni vengono risolte quando tutti confermano; i bersagli sono segreti fino alla risoluzione.
- Gli scambi del Mercato sono automatici e non rappresentano ancora contratti: gli accordi e le promesse sono verbali.

## Limiti importanti

Versione prototipo per **LAN privata**: nessun login host, nessun TLS e memoria volatile. Non esporre direttamente la porta 8080 su Internet. GitHub Pages non esegue server Node.js, quindi per il multiplayer serve un server (Mac/NAS o hosting WebSocket/SSE). Manca ancora la grafica QR, la riconnessione autenticata, contratti formali, IA e animazioni finali.

Il materiale originale di *Cucuzze* include Contadino, Cinghiale, Procioni, semina, raccolto e recinti; questa è una reinterpretazione digitale per playtest.
