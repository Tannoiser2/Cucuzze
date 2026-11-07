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
  assert.match(js,/STAGES=\['event','sow','defend','attack'\]/);
  assert.match(js,/type:'phaseOrder'/);
  assert.match(js,/PASSO QUESTA FASE/);
  assert.match(js,/vince l’asta con il dado/);
  assert.match(js,/EVENT_NAMES/);
  const names=(js.match(/\['[^']+','[^']+'\]/g)||[]).filter(x=>!x.includes("'🎪'")&&!x.includes("'🌱'")&&!x.includes("'🛡️'")&&!x.includes("'🐾'"));
  assert.ok(names.length>=30,'devono esserci almeno 30 carte evento');
});

test('la risoluzione racconta ogni singolo attacco con viaggio e bottino',()=>{
  assert.match(js,/buildStory/);
  assert.match(js,/attackerName/);
  assert.match(js,/I \$\{animal\} di/);
  assert.match(js,/story-flight/);
  assert.match(js,/flying-loot/);
  assert.match(html,/storyTravel/);
  assert.match(html,/lootReturn/);
});
