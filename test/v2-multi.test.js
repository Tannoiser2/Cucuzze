const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const docs=path.join(__dirname,'../docs'),html=fs.readFileSync(path.join(docs,'v2-multi.html'),'utf8'),js=fs.readFileSync(path.join(docs,'v2-multi.js'),'utf8');

test('modalità 2.0 TV e telefoni contiene QR, rete e campi visuali',()=>{
  assert.match(html,/qrcodejs/);assert.match(html,/peerjs/);assert.match(html,/v2-multi\.js/);
  assert.match(js,/new QRCode/);assert.match(js,/new Peer/);assert.match(js,/tv-board/);assert.match(js,/pumpkin/);
  assert.match(js,/lobby\.length>=10/);assert.match(html,/repeat\(5,1fr\)/);
  assert.match(js,/advanceReveal/);assert.match(js,/phaseCaption/);assert.match(html,/crowDive/);assert.match(html,/raccoonRaid/);
  assert.match(js,/drawFinal/);assert.match(js,/Classifica finale/);assert.match(js,/Pollice verde/);assert.match(js,/Re dei furti/);
});

test('il telefono riceve solo i propri dadi',()=>{
  assert.match(js,/dice:me\.dice/);
  assert.doesNotMatch(js,/dice:p\.dice/);
});

test('il turno è guidato per fasi e comprende 30 eventi con asta',()=>{
  assert.match(js,/STAGES=\['event','sow','crows','raccoons','defend'\]/);
  assert.match(js,/type:'phaseOrder'/);
  assert.match(js,/NON PARTECIPO/);
  assert.match(js,/Bersaglio segreto/);
  assert.match(js,/vince l’asta con il dado/);
  assert.match(js,/EVENT_NAMES/);
  const names=(js.match(/\['[^']+','[^']+'\]/g)||[]).filter(x=>!x.includes("'🎪'")&&!x.includes("'🌱'")&&!x.includes("'🛡️'")&&!x.includes("'🐾'"));
  assert.ok(names.length>=30,'devono esserci almeno 30 carte evento');
});

test('la risoluzione racconta ogni singolo attacco con viaggio e bottino',()=>{
  assert.match(js,/buildStory/);
  assert.match(js,/attackerName/);
  assert.match(js,/I \$\{animal\} di/);
  assert.match(js,/story-stage/);
  assert.match(js,/pickup/);
  assert.match(html,/storyTravel/);
  assert.match(html,/lootReturn/);
  assert.match(js,/animal-back/);
  assert.match(js,/pumpkin-burst/);
  assert.match(js,/seed-rain/);
  assert.match(js,/market-scene/);
  assert.match(html,/returnHome/);
  assert.match(html,/burstPumpkins/);
  assert.match(html,/seedFall/);
  assert.match(html,/cartAcross/);
});

test('la cronaca non copre i campi e i raccolti grandi sono compattati',()=>{
  assert.doesNotMatch(js,/class="scene-caption"/);
  assert.match(js,/Math\.min\(n,24\)/);
  assert.match(js,/harvest-stack/);
  assert.match(html,/story-header/);
  assert.match(js,/Hai puntato il dado/);
});

test('gli attacchi restano segreti e la difesa conosce soltanto il loro numero',()=>{
  assert.match(js,/declareAttacks/);
  assert.match(js,/declaredAttacks/);
  assert.match(js,/Animali, forza e mandanti restano segreti/);
  assert.match(js,/alarmOverlay/);
  assert.match(js,/MISSIONE CORVI/);
  assert.match(js,/MISSIONE PROCIONI/);
  assert.match(js,/lupara contro Corvi/);
  assert.match(js,/forcone contro Procioni/);
  assert.match(js,/Rubadado/);
  assert.match(js,/Rubadifese/);
  assert.match(js,/Vedetta/);
  assert.match(js,/Pianificare/);
  assert.match(html,/alarm-layer/);
  assert.match(html,/pumpkin\.seedling/);
  assert.doesNotMatch(js,/ARRIVA TRA/);
  assert.match(js,/market-progress/);
  assert.match(html,/market-progress/);
  assert.match(html,/\.tv-field \.who\{left:50%/);
  assert.match(html,/\.alarm-layer strong/);
});
