/* Cucuzze Browser Edition: host-authoritative PeerJS multiplayer.
 * GitHub Pages serves only static assets; PeerJS Cloud is used for signaling.
 * Nessun emoji o simbolo Unicode speciale: icone e dadi sono SVG disegnati qui,
 * cosi' si vedono su qualsiasi browser (anche quello della TV).
 */
"use strict";
const $=id=>document.getElementById(id),root=$("app");
const STAGES=["Alba","Tramonto","Notte"];
const TYPES=[["semina","contadino","cinghiale"],["raccolto","recinto","mercato"],["procioni","guardia","sabotaggio"]];
const LABEL={semina:"Semina",contadino:"Contadino",cinghiale:"Cinghiale",raccolto:"Raccolto",recinto:"Recinto",mercato:"Mercato",procioni:"Procioni",guardia:"Guardia",sabotaggio:"Sabotaggio"};
const HINT={semina:"Semi pari alla somma dei dadi (max 8) piu' il bonus della combinazione.",contadino:"Sposti il Contadino: il campo dove arriva riceve +2 semi.",cinghiale:"Sposti il Cinghiale: distrugge fino a 2 semi nel campo dove arriva.",raccolto:"Porti in magazzino tanti semi quanto la somma dei dadi piu' il bonus.",recinto:"Ogni dado: +1 livello di recinto al costo di 2 zucche (massimo 2).",mercato:"Regali 1 zucca per dado al giocatore scelto; il mercato te ne rende 1.",procioni:"Rubi zucche al bersaglio, se non e' di guardia. Il recinto le protegge.",guardia:"Blocchi tutti i furti e i sabotaggi contro di te questa Notte.",sabotaggio:"Il recinto del bersaglio perde un livello, se non e' di guardia."};
const STATUS={pending:"in attesa",accepted:"accettato",rejected:"rifiutato",expired:"scaduto",honored:"rispettata",betrayed:"TRADITA"};
const SAVE_KEY="cucuzze-host-save";
const rand=()=>1+Math.floor(Math.random()*6),uid=()=>Math.random().toString(36).slice(2,11),escapeHTML=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}},del(k){try{localStorage.removeItem(k)}catch{}}};
let mode=null,hostPeer=null,guestPeer=null,connection=null,peers=new Map(),game=null,me=null,view=null,chosen=[],action="",target="",direction="right",roomCode="",hostReady=false,codeError="";
let form={partner:"",trader:"",give:0,receive:0},phaseKey="",offline=false,retryTimer=null,forceArmed=false;
const remote=new URLSearchParams(location.search).get("room");

/* ---------- Grafica: icone e dadi disegnati ---------- */
const PIPS={1:[[50,50]],2:[[27,27],[73,73]],3:[[27,27],[50,50],[73,73]],4:[[27,27],[73,27],[27,73],[73,73]],5:[[27,27],[73,27],[50,50],[27,73],[73,73]],6:[[27,24],[73,24],[27,50],[73,50],[27,76],[73,76]]};
function dieFace(v){return v?'<svg viewBox="0 0 100 100" class="pips" role="img" aria-label="'+v+'">'+PIPS[v].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="10"/>').join("")+'</svg>':'<span class="q">?</span>'}
const ICON={
 pumpkin:'<svg viewBox="0 0 40 40" class="ico"><path d="M19 11c0-4 2-6 5-7l1 2c-2 1-3 3-3 5z" fill="#4c7a2c"/><ellipse cx="12" cy="24" rx="9" ry="12" fill="#d96f17"/><ellipse cx="28" cy="24" rx="9" ry="12" fill="#d96f17"/><ellipse cx="20" cy="24" rx="8.5" ry="13" fill="#f59a2c"/><path d="M20 12v24" stroke="#c4651a" stroke-width="1.5"/></svg>',
 seed:'<svg viewBox="0 0 40 40" class="ico"><path d="M20 36V18" stroke="#9bd67a" stroke-width="3" stroke-linecap="round"/><path d="M20 22c-9 0-12-6-12-11 6 0 12 3 12 11z" fill="#7cc35a"/><path d="M20 19c0-7 5-11 12-11 0 6-4 11-12 11z" fill="#9bd67a"/><ellipse cx="20" cy="37" rx="9" ry="2.5" fill="#6b4a2a"/></svg>',
 fence:'<svg viewBox="0 0 40 40" class="ico"><g fill="#c9965a" stroke="#6b4a2a" stroke-width="1.5"><path d="M6 36V12l3-4 3 4v24z"/><path d="M17 36V12l3-4 3 4v24z"/><path d="M28 36V12l3-4 3 4v24z"/><rect x="3" y="16" width="34" height="4"/><rect x="3" y="27" width="34" height="4"/></g></svg>'
};
const stat=(icon,n,label)=>'<span class="stat" title="'+label+'">'+ICON[icon]+'<b>'+n+'</b></span>';
function pumpkinsRow(n){if(!n)return'<span class="muted">nessuna zucca</span>';let k=Math.min(n,8);return ICON.pumpkin.repeat(k)+(n>k?'<b class="more">+'+(n-k)+'</b>':"")}

function notice(t){let e=$("toast");e.textContent=t;e.classList.add("visible");setTimeout(()=>e.classList.remove("visible"),3500)}
const other=(g,id)=>g.players.find(p=>p.id===id);
function initial(){return {day:1,stage:0,board:[rand(),rand(),rand()],started:false,finished:false,players:[],farmer:0,boar:0,contracts:[],trades:[],history:[],last:"",room:roomCode}}
function log(t){game.history.push(t);game.history=game.history.slice(-45);game.last=t}
function publicState(id){let p=other(game,id);return {room:game.room,started:game.started,finished:game.finished,day:game.day,stage:game.stage,board:game.board.map((v,i)=>i<=game.stage?v:null),farmer:game.farmer,boar:game.boar,players:game.players.map(x=>({id:x.id,name:x.name,pumpkins:x.pumpkins,seeds:x.seeds,fence:x.fence,ready:x.ready,online:peers.has(x.id)})),contracts:game.contracts.map(c=>({...c})),trades:game.trades.map(t=>({...t})),history:game.history.slice(-15),me:p?{id:p.id,name:p.name,dice:p.dice,orders:p.orders,spent:p.spent,ready:p.ready}:null}}
function send(c,obj){try{if(c&&c.open)c.send(obj)}catch{}}
function saveHost(){if(mode!=="host"||!game)return;if(game.finished){store.del(SAVE_KEY);return}store.set(SAVE_KEY,JSON.stringify({room:roomCode,game,at:Date.now()}))}
function loadSaved(){try{let s=JSON.parse(store.get(SAVE_KEY)||"null");if(s&&s.room&&s.game&&!s.game.finished&&Date.now()-s.at<24*3600e3)return s}catch{}return null}
function update(){view=publicState(null);saveHost();if(mode==="host")draw();for(let [id,c] of peers)send(c,{type:"state",state:publicState(id)})}

/* ---------- Connessione: TV (host) ---------- */
function connectHost(saved){
 if(typeof Peer==="undefined"){codeError="Impossibile caricare la libreria di connessione PeerJS. Verifica Internet.";landing();return}
 mode="host";game=null;hostReady=false;peers.clear();
 roomCode=saved?saved.room:"cucuzze-"+uid();
 let attempts=0;
 const open=()=>{
  hostPeer=new Peer(roomCode);
  hostPeer.on("open",id=>{roomCode=id;if(!game){game=saved?saved.game:initial();game.room=roomCode;if(saved)log("La TV ha ripreso la partita: i telefoni si ricollegano da soli")}hostReady=true;history.replaceState({},"",location.pathname);update()});
  hostPeer.on("connection",c=>{c.on("data",d=>hostMessage(c,d));c.on("close",()=>{let id=[...peers].find(([i,v])=>v===c)?.[0];if(id)peers.delete(id);update()})});
  hostPeer.on("disconnected",()=>{notice("Connessione di rete interrotta: riconnessione...");try{hostPeer.reconnect()}catch{}});
  hostPeer.on("error",e=>{
   if(e&&e.type==="unavailable-id"&&saved&&attempts<20){attempts++;try{hostPeer.destroy()}catch{}root.innerHTML=intro("Recupero della stanza in corso... (tentativo "+attempts+" di 20)");setTimeout(open,3000);return}
   if(hostReady){notice("Problema di rete: "+(e&&e.message||e));return}
   codeError="Connessione fallita: "+(e&&e.message||e);notice(codeError);landing()});
 };
 root.innerHTML=intro(saved?"Ripresa della partita in corso...":"Creazione della stanza online...");
 open();
}

/* ---------- Connessione: telefono (guest) ---------- */
function connectGuest(code){
 if(typeof Peer==="undefined"){codeError="Connessione di rete non disponibile";landing();return}
 mode="guest";roomCode=code;me=store.get("cucuzze-id-"+code);
 root.innerHTML=intro("Connessione alla stanza...");
 guestPeer=new Peer();
 guestPeer.on("open",openLink);
 guestPeer.on("disconnected",()=>scheduleRetry());
 guestPeer.on("error",e=>{
  if(view){scheduleRetry();return}
  codeError=e&&e.type==="peer-unavailable"?"Stanza non trovata: controlla il codice e che la TV sia accesa.":"Stanza non raggiungibile: "+(e&&e.message||e);
  notice(codeError);landing()});
}
function scheduleRetry(){if(retryTimer)return;if(!offline){offline=true;draw()}retryTimer=setTimeout(()=>{retryTimer=null;if(guestPeer.disconnected){try{guestPeer.reconnect()}catch{}}else openLink()},3000)}
function openLink(){
 let c=guestPeer.connect(roomCode,{reliable:true});connection=c;
 c.on("open",()=>{let name=store.get("cucuzze-name")||"";if(me||name)send(c,{type:"join",id:me,name});else{view=view||{room:roomCode,started:false,me:null,players:[],contracts:[],trades:[],history:[]};offline=false;draw()}});
 c.on("data",msg=>{
  if(msg.type==="state"){offline=false;view=msg.state;if(me&&!view.me){notice("La TV non riconosce questa sessione: entra di nuovo");me=null;store.del("cucuzze-id-"+roomCode)}draw()}
  else if(msg.type==="joined"){me=msg.id;store.set("cucuzze-id-"+roomCode,me);draw()}
  else if(msg.type==="error"){notice(msg.message);if(!view){view={room:roomCode,started:false,me:null,players:[],contracts:[],trades:[],history:[]};offline=false;draw()}}});
 c.on("close",()=>{if(connection===c)scheduleRetry()});
 c.on("error",()=>{if(connection===c)scheduleRetry()});
}

/* ---------- Regole (eseguite solo sulla TV) ---------- */
function hostMessage(c,d){if(!d||typeof d!=="object")return;
 try{
 if(d.type==="join"){let p=d.id&&other(game,d.id);if(p){peers.set(p.id,c);send(c,{type:"joined",id:p.id});update();return}
 if(game.started)throw Error("La partita e' gia' iniziata");
 if(game.players.length>=10)throw Error("Stanza piena");
 let name=String(d.name||"").trim().slice(0,20);if(!name)throw Error("Inserisci un nome");
 p={id:uid(),name,pumpkins:5,seeds:0,fence:0,orders:[],dice:[],spent:[],ready:false};game.players.push(p);peers.set(p.id,c);send(c,{type:"joined",id:p.id});log(name+" entra nella valle");update();return}
 let id=[...peers].find(([pid,conn])=>conn===c)?.[0],p=other(game,id);
 if(!p||!game.started||game.finished)throw Error("Giocatore o partita non disponibili");
 if(d.type==="place"){
 if(p.ready)throw Error("Hai gia' confermato");
 if(!TYPES[game.stage].includes(d.action))throw Error("Azione non disponibile");
 let dice=d.dice;
 if(!Array.isArray(dice)||dice.length<1||dice.length>3||new Set(dice).size!==dice.length||dice.some(i=>!Number.isInteger(i)||i<0||i>=6))throw Error("Dadi non validi");
 let used=p.orders.flatMap(o=>o.dice);
 if(used.length+dice.length>3||dice.some(i=>p.spent.includes(i)||used.includes(i)))throw Error("Dadi gia' usati o limite di fase");
 if(["mercato","procioni","sabotaggio"].includes(d.action)&&!game.players.some(x=>x.id===d.target&&x!==p))throw Error("Seleziona il destinatario");
 p.orders.push({action:d.action,dice,target:d.target||null,direction:d.direction==="left"?"left":"right"});update();return}
 if(d.type==="undo"){if(p.ready)throw Error("Hai gia' confermato");p.orders.pop();update();return}
 if(d.type==="ready"){p.ready=true;update();return}
 if(d.type==="contract"){if(game.stage!==1||p.ready)throw Error("Le tregue si firmano al Tramonto");let q=other(game,d.target);if(!q||q===p)throw Error("Scegli un altro giocatore");if(game.contracts.some(x=>x.day===game.day&&x.status==="accepted"&&[x.a,x.b].includes(p.id)))throw Error("Hai gia' una tregua");if(game.contracts.some(x=>x.day===game.day&&x.status==="pending"&&x.a===p.id))throw Error("Hai una proposta in attesa");game.contracts.push({id:uid(),a:p.id,b:q.id,day:game.day,status:"pending"});log(p.name+" propone una tregua a "+q.name);update();return}
 if(d.type==="contractReply"){if(game.stage!==1||p.ready)throw Error("Troppo tardi per rispondere");let v=game.contracts.find(x=>x.id===d.id&&x.b===p.id&&x.status==="pending");if(!v)throw Error("Tregua non trovata");if(d.accept&&game.contracts.some(x=>x.day===game.day&&x.status==="accepted"&&[x.a,x.b].some(z=>z===v.a||z===v.b)))throw Error("Una sola tregua per giocatore");v.status=d.accept?"accepted":"rejected";log(d.accept?"Tregua firmata tra "+other(game,v.a).name+" e "+p.name:p.name+" rifiuta la tregua");update();return}
 if(d.type==="trade"){if(game.stage!==1||p.ready)throw Error("Gli scambi avvengono al Tramonto");let q=other(game,d.target),give=Number(d.give),receive=Number(d.receive);if(!q||q===p||![give,receive].every(x=>Number.isInteger(x)&&x>=0&&x<=3)||give+receive===0)throw Error("Offerta non valida");if(game.trades.some(t=>t.day===game.day&&t.status==="pending"&&t.a===p.id))throw Error("Hai gia' un'offerta in attesa");if(game.trades.some(t=>t.day===game.day&&t.status==="accepted"&&[t.a,t.b].includes(p.id)))throw Error("Hai gia' scambiato oggi");game.trades.push({id:uid(),a:p.id,b:q.id,give,receive,day:game.day,status:"pending"});update();return}
 if(d.type==="tradeReply"){if(game.stage!==1||p.ready)throw Error("Scambio fuori tempo");let t=game.trades.find(x=>x.id===d.id&&x.b===p.id&&x.status==="pending");if(!t)throw Error("Scambio non trovato");let a=other(game,t.a);if(d.accept){if(game.trades.some(x=>x!==t&&x.day===game.day&&x.status==="accepted"&&[x.a,x.b].some(z=>z===a.id||z===p.id)))throw Error("Hai gia' scambiato oggi");if(a.pumpkins<t.give||p.pumpkins<t.receive)throw Error("Zucche insufficienti");a.pumpkins+=t.receive-t.give;p.pumpkins+=t.give-t.receive;t.status="accepted";log(a.name+" e "+p.name+" concludono uno scambio")}else t.status="rejected";update();return}
 }catch(e){send(c,{type:"error",message:e.message})}}

/* Combinazioni: stessa funzione per TV (risoluzione) e telefono (anteprima). */
function comboOf(own,shared){let pool=own.concat(shared),c=n=>pool.filter(v=>v===n).length,unique=[...new Set(pool)];
 let three=unique.find(v=>c(v)>=3);
 let full=three!==undefined&&unique.some(v=>v!==three&&c(v)>=2)&&own.some(v=>c(v)>=2);
 let poker=own.some(v=>c(v)>=4),tris=own.some(v=>c(v)>=3),pair=own.some(v=>c(v)>=2);
 let straight=own.some(v=>[v-2,v-1,v].some(start=>start>=1&&start<=4&&[start,start+1,start+2].every(n=>pool.includes(n))));
 return{poker,full,tris,pair,straight,bonus:poker?5:full?4:tris?3:pair?2:0}}
function combo(p,o){return comboOf(o.dice.map(i=>p.dice[i]),game.board.slice(0,game.stage+1))}
const sum=v=>v.reduce((a,b)=>a+b,0);
function stealAmount(nDice,c){return 2+nDice-1+Math.ceil(c.bonus/2)}
function resolve(){let orders=game.players.flatMap(p=>p.orders.map(o=>({p,o,c:combo(p,o)}))),by=a=>orders.filter(x=>x.o.action===a),size=game.players.length;let find=other.bind(null,game);
 if(game.stage===0){
 for(let{p,o,c}of by("semina")){let n=Math.min(8,sum(o.dice.map(i=>p.dice[i])))+c.bonus;p.seeds+=n;log(p.name+" semina "+n+" semi")}
 for(let kind of ["contadino","cinghiale"])for(let{p,o,c}of by(kind)){let n=sum(o.dice.map(i=>p.dice[i]))+(c.straight?2:0),key=kind==="contadino"?"farmer":"boar";game[key]=((game[key]+(o.direction==="left"?-n:n))%size+size)%size;log(p.name+" sposta il "+LABEL[kind]+" verso "+game.players[game[key]].name)}
 let farmer=game.players[game.farmer],boar=game.players[game.boar];farmer.seeds+=2;let loss=Math.min(2,boar.seeds);boar.seeds-=loss;log("Il Contadino aiuta "+farmer.name+": +2 semi. Il Cinghiale devasta il campo di "+boar.name+": -"+loss+" semi");
 }else if(game.stage===1){
 for(let{p,o,c}of by("raccolto")){let n=Math.min(p.seeds,sum(o.dice.map(i=>p.dice[i]))+c.bonus);p.seeds-=n;p.pumpkins+=n;log(p.name+" raccoglie "+n+" zucche")}
 for(let{p,o}of by("recinto")){let n=Math.min(o.dice.length,2-p.fence,Math.floor(p.pumpkins/2));p.fence+=n;p.pumpkins-=2*n;log(p.name+" costruisce "+n+" livelli di recinto")}
 for(let{p,o}of by("mercato")){let t=find(o.target);if(t&&t!==p){let n=Math.min(p.pumpkins,o.dice.length);p.pumpkins-=n;t.pumpkins+=n;p.pumpkins+=Math.min(1,n);log(p.name+" regala "+n+" zucche a "+t.name)}}
 for(let c of game.contracts.filter(x=>x.day===game.day&&x.status==="pending"))c.status="expired";
 for(let t of game.trades.filter(x=>x.day===game.day&&x.status==="pending"))t.status="expired";
 }else{
 let guarded=new Set(by("guardia").map(x=>x.p.id));
 for(let{p,o}of by("sabotaggio")){let t=find(o.target);if(!t)continue;if(guarded.has(t.id))log(t.name+" e' di guardia e blocca il sabotaggio di "+p.name);else{t.fence=Math.max(0,t.fence-1);log(p.name+" sabota il recinto di "+t.name)}}
 for(let{p,o,c}of by("procioni")){let t=find(o.target);if(!t)continue;if(guarded.has(t.id)){log(t.name+" e' di guardia e scaccia i procioni di "+p.name);continue}let n=Math.min(t.pumpkins,Math.max(0,Math.min(stealAmount(o.dice.length,c),3-t.fence)));t.pumpkins-=n;p.pumpkins+=n;log("I procioni di "+p.name+" rubano "+n+" zucche a "+t.name)}
 for(let c of game.contracts.filter(x=>x.day===game.day&&x.status==="accepted")){let a=find(c.a),b=find(c.b),betray=orders.some(x=>[c.a,c.b].includes(x.p.id)&&["procioni","sabotaggio"].includes(x.o.action)&&[c.a,c.b].includes(x.o.target)&&x.p.id!==x.o.target);c.status=betray?"betrayed":"honored";if(betray)log("TRADIMENTO! La tregua tra "+a.name+" e "+b.name+" e' stata infranta");else{a.pumpkins++;b.pumpkins++;log(a.name+" e "+b.name+" rispettano la tregua: +1 zucca a testa")}}
 }
 for(let p of game.players){p.spent.push(...p.orders.flatMap(o=>o.dice));p.orders=[];p.ready=false}
 if(game.stage<2)game.stage++;else if(game.day<6){game.day++;game.stage=0;game.board=[rand(),rand(),rand()];for(let p of game.players){p.dice=Array.from({length:6},rand);p.spent=[]}log("Sorge il giorno "+game.day)}
 else{game.finished=true;let sorted=[...game.players].sort((a,b)=>b.pumpkins-a.pumpkins),w=sorted.filter(p=>p.pumpkins===sorted[0].pumpkins);log((w.length>1?"Pareggio: ":"Vince ")+w.map(p=>p.name).join(" e ")+" con "+w[0].pumpkins+" zucche")}
 forceArmed=false;update();
}
function hostStart(){if(!game||game.started||game.players.length<2)return;game.started=true;game.players.forEach(p=>{p.dice=Array.from({length:6},rand);p.spent=[];p.orders=[];p.ready=false});log("La partita comincia");update()}
function hostAdvance(force){if(!game?.started||game.finished)return;if(!force&&!game.players.every(p=>p.ready))return;resolve()}
function link(){return location.href.split("?")[0]+"?room="+encodeURIComponent(roomCode)}

/* ---------- Disegno ---------- */
function intro(text){return'<div class="intro"><h1>CUCUZZE</h1><div class="panel">'+escapeHTML(text)+'</div></div>'}
function farm(s){return'<div class="panel"><h2>La valle delle Cucuzze</h2><div class="farm">'+s.players.map((p,i)=>'<div class="plot"><div class="markers">'+(s.farmer===i&&s.started?'<span class="pill farmer">Contadino</span>':"")+(s.boar===i&&s.started?'<span class="pill boar">Cinghiale</span>':"")+'</div><strong>'+(i+1)+'. '+escapeHTML(p.name)+'</strong><div class="fruit">'+pumpkinsRow(p.pumpkins)+'</div><div class="stats">'+stat("pumpkin",p.pumpkins,"Zucche")+stat("seed",p.seeds,"Semi")+stat("fence",p.fence,"Recinto")+'</div><small>'+(p.online===false?'<span class="warn">telefono scollegato</span> - ':"")+(s.started&&!s.finished?(p.ready?"Pronto":"Sta scegliendo..."):"")+'</small></div>').join("")+'</div></div>'}
function historyPanel(s){return'<div class="panel"><h2>Cronaca</h2><div class="history">'+s.history.slice().reverse().map(x=>'<div class="'+(x.startsWith("TRADIMENTO")?"betray":"")+'">'+escapeHTML(x)+'</div>').join("")+'</div></div>'}
function board(s){return'<div class="panel center"><h2>Dadi comuni - '+STAGES[s.stage]+'</h2><div class="dice">'+s.board.map((n,i)=>'<div class="die '+(n===null?"hidden":"")+'">'+dieFace(n)+'<small>'+STAGES[i]+'</small></div>').join("")+'</div></div>'}
function agreements(s){let names=Object.fromEntries(s.players.map(p=>[p.id,p.name]));let rows=s.contracts.filter(t=>t.day===s.day).map(c=>'<div class="contract'+(c.status==="betrayed"?" betray":"")+'">Tregua '+escapeHTML(names[c.a])+' con '+escapeHTML(names[c.b])+': <b>'+escapeHTML(STATUS[c.status]||c.status)+'</b></div>').concat(s.trades.filter(t=>t.day===s.day).map(c=>'<div class="contract">Scambio '+escapeHTML(names[c.a])+' con '+escapeHTML(names[c.b])+' ('+c.give+' contro '+c.receive+'): <b>'+escapeHTML(STATUS[c.status]||c.status)+'</b></div>'));return rows.length?'<div class="panel"><h2>Patti e scambi di oggi</h2>'+rows.join("")+'</div>':""}
function landing(){if(remote&&!codeError){connectGuest(remote);return}mode=null;let saved=loadSaved();
 root.innerHTML='<div class="intro"><h1>CUCUZZE</h1><p>La guerra degli orti - da 4 a 10 giocatori</p><div class="panel">'+(saved?'<button id="resume">Riprendi la partita in corso (giorno '+saved.game.day+', '+saved.game.players.length+' giocatori)</button><p class="muted">I telefoni si ricollegano da soli.</p><hr>':"")+'<button id="create">Crea partita sulla TV</button><p class="muted">Non serve installare nulla ne\' avviare un server.</p><hr><h2>Entra con il telefono</h2><input id="name" placeholder="Il tuo nome" maxlength="20" value="'+escapeHTML(store.get("cucuzze-name")||"")+'"><input id="room" placeholder="Codice della stanza" value="'+escapeHTML(remote||"")+'"><button id="enter">Entra</button></div>'+(codeError?'<p class="warn">'+escapeHTML(codeError)+'</p>':"")+'</div>';
 codeError="";
 $("create").onclick=()=>{store.del(SAVE_KEY);connectHost(null)};
 if(saved)$("resume").onclick=()=>connectHost(saved);
 $("enter").onclick=()=>{let code=$("room").value.trim();if(!code)return notice("Inserisci il codice della stanza");store.set("cucuzze-name",$("name").value.trim());history.replaceState({},"",location.pathname+"?room="+encodeURIComponent(code));connectGuest(code)}}
function drawHost(){if(!game)return;let s=view||publicState(null),allReady=s.players.every(p=>p.ready),readyCount=s.players.filter(p=>p.ready).length;
 let top=!s.started?'<div class="panel center"><h2>Sala d\'attesa</h2><p>Scansiona il QR code con il telefono oppure apri il link</p><div id="qrcode"></div><a href="'+escapeHTML(link())+'">'+escapeHTML(link())+'</a><p class="tag">Codice '+escapeHTML(roomCode)+'</p><p class="tag">'+s.players.length+' giocatori nella stanza</p></div>'
  :'<div class="center"><h2>'+(s.finished?"FINE PARTITA":"Giorno "+s.day+" di 6 - "+STAGES[s.stage])+'</h2>'+(s.finished?"":'<p class="tag">'+readyCount+' su '+s.players.length+' pronti</p>')+'<p class="muted small">Stanza '+escapeHTML(roomCode)+'</p></div>';
 let ctrl=!s.started?'<button id="start" '+(s.players.length<2?"disabled":"")+'>Inizia la partita</button>'+(s.players.length<2?'<p class="muted">Servono almeno 2 giocatori.</p>':"")
  :s.finished?'<button id="again">Nuova partita</button>'
  :'<button id="advance" '+(!allReady?"disabled":"")+'>Rivela le azioni e continua</button>'+(!allReady?'<p><button id="force" class="outline">'+(forceArmed?"Premi ancora per avanzare senza aspettare":"Avanza senza aspettare chi manca")+'</button></p>':"");
 root.innerHTML='<header><h1>CUCUZZE</h1><span>TV</span></header>'+top+(s.started?board(s):"")+farm(s)+'<div class="panel center">'+ctrl+'</div>'+agreements(s)+historyPanel(s);
 if(!s.started&&typeof QRCode!=="undefined")try{new QRCode($("qrcode"),{text:link(),width:200,height:200,colorDark:"#17291f",colorLight:"#fff"})}catch{}
 $("start")?.addEventListener("click",hostStart);$("advance")?.addEventListener("click",()=>hostAdvance(false));
 $("force")?.addEventListener("click",()=>{if(forceArmed)hostAdvance(true);else{forceArmed=true;draw()}});
 $("again")?.addEventListener("click",()=>{try{hostPeer?.destroy()}catch{}store.del(SAVE_KEY);connectHost(null)})}
function preview(act,my,c,s){if(!act||!my.length)return"";let total=sum(my);
 if(act==="semina")return"Effetto: +"+(Math.min(8,total)+c.bonus)+" semi";
 if(act==="raccolto")return"Effetto: fino a "+(total+c.bonus)+" zucche raccolte (hai "+s.players.find(x=>x.id===s.me.id).seeds+" semi)";
 if(act==="contadino"||act==="cinghiale")return"Effetto: "+(total+(c.straight?2:0))+" passi";
 if(act==="procioni")return"Effetto: fino a "+stealAmount(my.length,c)+" zucche (meno il recinto del bersaglio)";
 if(act==="recinto")return"Effetto: fino a "+my.length+" livelli, 2 zucche ciascuno";
 if(act==="mercato")return"Effetto: regali fino a "+my.length+" zucche, ne ricevi 1";return""}
function comboText(c){let parts=[];if(c.poker)parts.push("POKER +5");else if(c.full)parts.push("FULL +4");else if(c.tris)parts.push("TRIS +3");else if(c.pair)parts.push("COPPIA +2");if(c.straight)parts.push("SCALA +2 passi");return parts.length?"Combinazione: "+parts.join(" e "):"Nessuna combinazione"}
function drawGuest(){
 if(!view){root.innerHTML=intro("Connessione alla TV...");return}
 let banner=offline?'<div class="offline">Connessione con la TV persa: ricollegamento in corso...</div>':"";
 let s=view,p=s.me;
 if(!p){root.innerHTML=banner+'<div class="intro"><h1>CUCUZZE</h1><div class="panel"><h2>Entra nella partita</h2><input id="name" maxlength="20" placeholder="Il tuo nome" value="'+escapeHTML(store.get("cucuzze-name")||"")+'"><button id="join">Entra</button></div></div>';$("join").onclick=()=>{let name=$("name").value.trim();if(!name)return notice("Scrivi il tuo nome");store.set("cucuzze-name",name);send(connection,{type:"join",name})};return}
 if(!s.started){root.innerHTML=banner+'<div class="intro"><h1>CUCUZZE</h1><div class="panel"><h2>Ciao, '+escapeHTML(p.name)+'!</h2><p>Sei nella stanza. Aspetta che la TV avvii la partita.</p><p>Parti con 5 zucche '+ICON.pumpkin+'</p></div></div>';return}
 if(s.finished){root.innerHTML=banner+'<div class="panel center"><h1>Partita terminata</h1></div>'+farm(s)+historyPanel(s);return}
 let key=s.day+"-"+s.stage;if(key!==phaseKey){phaseKey=key;chosen=[];action=""}
 let occupied=new Set([...p.spent,...p.orders.flatMap(o=>o.dice)]),limit=3-p.orders.reduce((a,o)=>a+o.dice.length,0),others=s.players.filter(x=>x.id!==p.id),mine=s.players.find(x=>x.id===p.id);
 chosen=chosen.filter(i=>!occupied.has(i)).slice(0,Math.max(0,limit));
 root.innerHTML=banner+'<header><h1>CUCUZZE</h1><span>'+escapeHTML(p.name)+'</span></header><div class="center"><h2>Giorno '+s.day+' - '+STAGES[s.stage]+'</h2><div class="stats big">'+stat("pumpkin",mine.pumpkins,"Zucche")+stat("seed",mine.seeds,"Semi")+stat("fence",mine.fence,"Recinto")+'</div></div>'+board(s)+
 '<div class="panel"><h2>I tuoi dadi</h2><div class="dice">'+p.dice.map((v,i)=>'<button data-die="'+i+'" class="die '+(occupied.has(i)?"spent":chosen.includes(i)?"selected":"")+'" '+(occupied.has(i)||p.ready?"disabled":"")+'>'+dieFace(v)+'</button>').join("")+'</div><p class="muted">Puoi piazzare ancora '+limit+' dadi in questa fase. Quelli non usati restano per le fasi successive di oggi.</p><p id="combo" class="combo"></p></div>'+
 '<div class="panel"><h2>Scegli un\'azione</h2><div class="actions">'+TYPES[s.stage].map(v=>'<button data-action="'+v+'" class="'+(v===action?"selected":"outline")+'" '+(p.ready?"disabled":"")+'>'+LABEL[v]+'</button>').join("")+'</div>'+(action?'<p class="muted">'+escapeHTML(HINT[action])+'</p>':"")+'<div id="extra"></div><p id="preview" class="combo"></p><button id="place" '+(!action||chosen.length<1||chosen.length>limit||p.ready?"disabled":"")+'>Piazza i dadi selezionati</button></div>'+
 '<div class="panel"><h2>Azioni piazzate</h2>'+(p.orders.length?p.orders.map(o=>'<div class="order"><b>'+LABEL[o.action]+'</b>'+(o.target?' su '+escapeHTML(other(s,o.target)?.name):"")+(["contadino","cinghiale"].includes(o.action)?(o.direction==="left"?" indietro":" avanti"):"")+'<span class="minidice">'+o.dice.map(i=>'<span class="die mini">'+dieFace(p.dice[i])+'</span>').join("")+'</span></div>').join(""):'<p class="muted">Nessuna azione: puoi anche confermare senza piazzare dadi.</p>')+'<div class="actions"><button class="outline" id="undo" '+(!p.orders.length||p.ready?"disabled":"")+'>Annulla l\'ultima</button><button id="ready" '+(p.ready?"disabled":"")+'>'+(p.ready?"Confermato: aspetta gli altri":"Conferma le scelte")+'</button></div></div>'+
 (s.stage===1&&!p.ready?'<div id="negotiation"></div>':"")+agreements(s)+historyPanel(s);
 document.querySelectorAll("[data-die]").forEach(b=>b.onclick=()=>{let i=Number(b.dataset.die);chosen=chosen.includes(i)?chosen.filter(x=>x!==i):chosen.length<Math.min(3,limit)?[...chosen,i]:chosen;draw()});
 document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{action=b.dataset.action;draw()});
 let extra=$("extra");
 if(["procioni","sabotaggio","mercato"].includes(action)){if(!others.some(x=>x.id===target))target=others[0]?.id||"";extra.innerHTML='<label>'+(action==="mercato"?"A chi regali?":"Chi colpisci?")+'</label><select id="target">'+others.map(x=>'<option value="'+escapeHTML(x.id)+'" '+(target===x.id?"selected":"")+'>'+escapeHTML(x.name)+'</option>').join("")+'</select>';$("target").onchange=e=>target=e.target.value}
 if(["contadino","cinghiale"].includes(action)){extra.innerHTML='<label>Direzione</label><select id="direction"><option value="right">Avanti (verso il numero successivo)</option><option value="left">Indietro (verso il numero precedente)</option></select>';$("direction").value=direction;$("direction").onchange=e=>direction=e.target.value}
 $("place").onclick=()=>{send(connection,{type:"place",action,target,dice:chosen,direction});chosen=[];action="";draw()};
 $("undo").onclick=()=>send(connection,{type:"undo"});$("ready").onclick=()=>send(connection,{type:"ready"});
 let my=chosen.map(i=>p.dice[i]),c=comboOf(my,s.board.filter(v=>v!==null));
 $("combo").textContent=!my.length?"Tocca i dadi da usare (da 1 a 3)":comboText(c);
 $("preview").textContent=preview(action,my,c,s);
 if(s.stage===1&&!p.ready)renderNegotiation(s,p,others);
}
function draw(){if(mode==="host")drawHost();else drawGuest()}
function renderNegotiation(s,p,others){let incoming=s.contracts.filter(c=>c.day===s.day&&c.b===p.id&&c.status==="pending"),incomingTrades=s.trades.filter(t=>t.day===s.day&&t.b===p.id&&t.status==="pending");
 let activeTruce=s.contracts.some(c=>c.day===s.day&&c.status==="accepted"&&[c.a,c.b].includes(p.id)),waitingTruce=s.contracts.some(c=>c.day===s.day&&c.status==="pending"&&c.a===p.id);
 let activeTrade=s.trades.some(t=>t.day===s.day&&t.status==="accepted"&&[t.a,t.b].includes(p.id)),waitingTrade=s.trades.some(t=>t.day===s.day&&t.status==="pending"&&t.a===p.id);
 if(!others.some(x=>x.id===form.partner))form.partner=others[0]?.id||"";if(!others.some(x=>x.id===form.trader))form.trader=others[0]?.id||"";
 const opts=(sel)=>others.map(x=>'<option value="'+escapeHTML(x.id)+'" '+(sel===x.id?"selected":"")+'>'+escapeHTML(x.name)+'</option>').join("");
 const nums=(sel)=>[0,1,2,3].map(i=>'<option value="'+i+'" '+(Number(sel)===i?"selected":"")+'>'+i+'</option>').join("");
 $("negotiation").innerHTML='<div class="panel"><h2>Tregua per stanotte</h2><p class="muted">Se la firmate e nessuno dei due attacca l\'altro di Notte, ricevete +1 zucca ciascuno. Tradire e\' permesso!</p>'+incoming.map(c=>'<div class="contract">Proposta di '+escapeHTML(other(s,c.a).name)+'<span><button data-contract="'+c.id+'">Accetta</button> <button data-decline="'+c.id+'" class="outline">Rifiuta</button></span></div>').join("")+(activeTruce||waitingTruce?"<p>Hai gia' una tregua o una proposta in attesa.</p>":'<label>Con chi?</label><select id="partner">'+opts(form.partner)+'</select><button id="offerTruce">Proponi tregua</button>')+'</div>'+
 '<div class="panel"><h2>Scambio di zucche</h2>'+incomingTrades.map(t=>'<div class="contract">'+escapeHTML(other(s,t.a).name)+' ti da\' '+t.give+' zucche e ne chiede '+t.receive+'<span><button data-trade="'+t.id+'">Accetta</button> <button data-no-trade="'+t.id+'" class="outline">Rifiuta</button></span></div>').join("")+(activeTrade||waitingTrade?"<p>Hai gia' concluso uno scambio o inviato un'offerta.</p>":'<label>Con chi?</label><select id="trader">'+opts(form.trader)+'</select><label>Zucche che offri</label><select id="give">'+nums(form.give)+'</select><label>Zucche che chiedi</label><select id="receive">'+nums(form.receive)+'</select><button id="offerTrade">Proponi scambio</button>')+'</div>';
 for(let k of ["partner","trader","give","receive"])if($(k))$(k).onchange=e=>form[k]=e.target.value;
 $("offerTruce")?.addEventListener("click",()=>send(connection,{type:"contract",target:form.partner}));
 document.querySelectorAll("[data-contract]").forEach(b=>b.onclick=()=>send(connection,{type:"contractReply",id:b.dataset.contract,accept:true}));
 document.querySelectorAll("[data-decline]").forEach(b=>b.onclick=()=>send(connection,{type:"contractReply",id:b.dataset.decline,accept:false}));
 $("offerTrade")?.addEventListener("click",()=>{send(connection,{type:"trade",target:form.trader,give:Number(form.give),receive:Number(form.receive)});form.give=0;form.receive=0});
 document.querySelectorAll("[data-trade]").forEach(b=>b.onclick=()=>send(connection,{type:"tradeReply",id:b.dataset.trade,accept:true}));
 document.querySelectorAll("[data-no-trade]").forEach(b=>b.onclick=()=>send(connection,{type:"tradeReply",id:b.dataset.noTrade,accept:false}));
}
if(remote)connectGuest(remote);else landing();
