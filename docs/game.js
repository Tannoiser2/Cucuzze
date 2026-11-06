/* Cucuzze Browser Edition: host-authoritative PeerJS multiplayer.
 * GitHub Pages serves only static assets; PeerJS Cloud is used for signaling.
 */
"use strict";
const $=id=>document.getElementById(id),root=$("app");
const F=["⚀","⚁","⚂","⚃","⚄","⚅"],N=["🌅 Alba","🌇 Tramonto","🌙 Notte"];
const TYPES=[["semina","contadino","cinghiale"],["raccolto","recinto","mercato"],["procioni","guardia","sabotaggio"]];
const LABEL={semina:"🌱 Semina",contadino:"🚜 Contadino",cinghiale:"🐗 Cinghiale",raccolto:"🎃 Raccolto",recinto:"🪵 Recinto",mercato:"🤝 Mercato",procioni:"🦝 Procioni",guardia:"🔦 Guardia",sabotaggio:"💣 Sabotaggio"};
const rand=()=>1+Math.floor(Math.random()*6),uid=()=>Math.random().toString(36).slice(2,11),escapeHTML=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let mode=null,hostPeer=null,guestPeer=null,connection=null,peers=new Map(),game=null,me=null,view=null,chosen=[],action="",target="",direction="right",roomCode="",hostReady=false,codeError="";
const remote=new URLSearchParams(location.search).get("room");
function notice(t){let e=$("toast");e.textContent=t;e.classList.add("visible");setTimeout(()=>e.classList.remove("visible"),3500)}
const other=(g,id)=>g.players.find(p=>p.id===id);
function initial(){return {day:1,stage:0,board:[rand(),rand(),rand()],started:false,finished:false,players:[],farmer:0,boar:0,contracts:[],trades:[],history:[],last:"",room:roomCode}}
function log(t){game.history.push(t);game.history=game.history.slice(-45);game.last=t}
function publicState(id){let p=other(game,id);return {room:game.room,started:game.started,finished:game.finished,day:game.day,stage:game.stage,board:game.board.map((v,i)=>i<=game.stage?v:null),farmer:game.farmer,boar:game.boar,players:game.players.map(x=>({id:x.id,name:x.name,pumpkins:x.pumpkins,seeds:x.seeds,fence:x.fence,ready:x.ready})),contracts:game.contracts.map(c=>({...c})),trades:game.trades.map(t=>({...t})),history:game.history.slice(-15),me:p?{id:p.id,name:p.name,dice:p.dice,orders:p.orders,spent:p.spent,ready:p.ready}:null}}
function send(c,obj){try{if(c&&c.open)c.send(obj)}catch{}}
function update(){view=publicState(null);if(mode==="host")draw();for(let [id,c] of peers)send(c,{type:"state",state:publicState(id)})}
function connectHost(){if(typeof Peer==="undefined"){codeError="Impossibile caricare la libreria di connessione PeerJS. Verifica Internet.";landing();return}
 roomCode="cucuzze-"+uid();hostPeer=new Peer(roomCode);
 hostPeer.on("open",id=>{roomCode=id;game=initial();hostReady=true;history.replaceState({},"",location.pathname);update()});
 hostPeer.on("connection",c=>{c.on("data",d=>hostMessage(c,d));c.on("close",()=>{let id=[...peers].find(([i,v])=>v===c)?.[0];if(id)peers.delete(id);update()})});
 hostPeer.on("disconnected",()=>{notice("Connessione di rete interrotta: riconnessione…");try{hostPeer.reconnect()}catch{}});
 hostPeer.on("error",e=>{codeError="Connessione fallita: "+e.message;notice(codeError);landing()});
 root.innerHTML='<div class="intro"><h1>🎃 CUCUZZE</h1><div class="panel">Creazione della stanza online…</div></div>';
}
function connectGuest(code){if(typeof Peer==="undefined"){codeError="Connessione di rete non disponibile";landing();return}
 mode="guest";roomCode=code;root.innerHTML='<div class="intro"><h1>🎃 CUCUZZE</h1><p>Connessione alla stanza…</p></div>';
 guestPeer=new Peer();
 guestPeer.on("open",()=>{connection=guestPeer.connect(code,{reliable:true});connection.on("open",()=>{let name=localStorage.getItem("cucuzze-name")||"";guestJoin(name)});connection.on("data",msg=>{if(msg.type==="state"){view=msg.state;if(me&&!view.me){notice("La tua sessione non è riconosciuta");me=null}draw()}else if(msg.type==="joined"){me=msg.id;localStorage.setItem("cucuzze-id-"+roomCode,me);draw()}else if(msg.type==="error")notice(msg.message)});connection.on("close",()=>notice("Collegamento con la TV terminato. Ricarica la pagina."));connection.on("error",e=>notice(e.message))});
 guestPeer.on("error",e=>{codeError="Stanza non raggiungibile: "+e.message;notice(codeError);landing()});
}
function guestJoin(name){if(!connection?.open)return;me=localStorage.getItem("cucuzze-id-"+roomCode)||null;send(connection,{type:"join",id:me,name:name||""})}
function hostMessage(c,d){if(!d||typeof d!=="object")return;
 try{
 if(d.type==="join"){let p=d.id&&other(game,d.id);if(p){peers.set(p.id,c);send(c,{type:"joined",id:p.id});send(c,{type:"state",state:publicState(p.id)});return}
 if(game.started)throw Error("La partita è già iniziata");
 if(game.players.length>=10)throw Error("Stanza piena");
 let name=String(d.name||"").trim().slice(0,20);if(!name)throw Error("Inserisci un nome");
 p={id:uid(),name,pumpkins:5,seeds:0,fence:0,orders:[],dice:[],spent:[],ready:false};game.players.push(p);peers.set(p.id,c);send(c,{type:"joined",id:p.id});log("🎃 "+name+" entra nel campo");update();return}
 let id=[...peers].find(([pid,conn])=>conn===c)?.[0],p=other(game,id);
 if(!p||!game.started||game.finished)throw Error("Giocatore o partita non disponibili");
 if(d.type==="place"){
 if(p.ready)throw Error("Hai già confermato");
 if(!TYPES[game.stage].includes(d.action))throw Error("Azione non disponibile");
 let dice=d.dice;
 if(!Array.isArray(dice)||dice.length<1||dice.length>3||new Set(dice).size!==dice.length||dice.some(i=>!Number.isInteger(i)||i<0||i>=6))throw Error("Dadi non validi");
 let used=p.orders.flatMap(o=>o.dice);
 if(used.length+dice.length>3||dice.some(i=>p.spent.includes(i)||used.includes(i)))throw Error("Dadi già usati o limite di fase");
 if(["mercato","procioni","sabotaggio"].includes(d.action)&&!game.players.some(x=>x.id===d.target&&x!==p))throw Error("Seleziona il destinatario");
 p.orders.push({action:d.action,dice,target:d.target||null,direction:d.direction==="left"?"left":"right"});update();return}
 if(d.type==="undo"){if(p.ready)throw Error("Hai già confermato");p.orders.pop();update();return}
 if(d.type==="ready"){p.ready=true;update();return}
 if(d.type==="contract"){if(game.stage!==1||p.ready)throw Error("Le tregue si firmano al Tramonto");let q=other(game,d.target);if(!q||q===p)throw Error("Scegli un vicino");if(game.contracts.some(x=>x.day===game.day&&x.status==="accepted"&&[x.a,x.b].includes(p.id)))throw Error("Hai già una tregua");if(game.contracts.some(x=>x.day===game.day&&x.status==="pending"&&x.a===p.id))throw Error("Hai una proposta in attesa");game.contracts.push({id:uid(),a:p.id,b:q.id,day:game.day,status:"pending"});log("🤝 "+p.name+" propone una tregua a "+q.name);update();return}
 if(d.type==="contractReply"){if(game.stage!==1||p.ready)throw Error("Troppo tardi per accettare");let v=game.contracts.find(x=>x.id===d.id&&x.b===p.id&&x.status==="pending");if(!v)throw Error("Tregua non trovata");if(d.accept&&game.contracts.some(x=>x.day===game.day&&x.status==="accepted"&&[x.a,x.b].some(z=>z===v.a||z===v.b)))throw Error("Una sola tregua per giocatore");v.status=d.accept?"accepted":"rejected";log(d.accept?"🤝 Tregua firmata tra "+other(game,v.a).name+" e "+p.name:"❌ "+p.name+" rifiuta la tregua");update();return}
 if(d.type==="trade"){if(game.stage!==1||p.ready)throw Error("Gli scambi avvengono al Tramonto");let q=other(game,d.target),give=Number(d.give),receive=Number(d.receive);if(!q||q===p||![give,receive].every(x=>Number.isInteger(x)&&x>=0&&x<=3)||give+receive===0)throw Error("Offerta non valida");if(game.trades.some(t=>t.day===game.day&&t.status==="pending"&&t.a===p.id))throw Error("Hai già un'offerta");if(game.trades.some(t=>t.day===game.day&&t.status==="accepted"&&[t.a,t.b].includes(p.id)))throw Error("Hai già scambiato");game.trades.push({id:uid(),a:p.id,b:q.id,give,receive,day:game.day,status:"pending"});update();return}
 if(d.type==="tradeReply"){if(game.stage!==1||p.ready)throw Error("Scambio fuori tempo");let t=game.trades.find(x=>x.id===d.id&&x.b===p.id&&x.status==="pending");if(!t)throw Error("Scambio non trovato");let a=other(game,t.a);if(d.accept){if(game.trades.some(x=>x!==t&&x.day===game.day&&x.status==="accepted"&&[x.a,x.b].some(z=>z===a.id||z===p.id)))throw Error("Hai già scambiato");if(a.pumpkins<t.give||p.pumpkins<t.receive)throw Error("Zucche insufficienti");a.pumpkins+=t.receive-t.give;p.pumpkins+=t.give-t.receive;t.status="accepted";log("💰 "+a.name+" e "+p.name+" completano uno scambio")}else t.status="rejected";update();return}
 }catch(e){send(c,{type:"error",message:e.message})}}
function combo(p,o){let own=o.dice.map(i=>p.dice[i]),pool=own.concat(game.board.slice(0,game.stage+1));let c=n=>pool.filter(v=>v===n).length,unique=[...new Set(pool)];
 let three=unique.find(v=>c(v)>=3);
 let full=three!==undefined&&unique.some(v=>v!==three&&c(v)>=2)&&own.some(v=>c(v)>=2);
 let poker=own.some(v=>c(v)>=4),tris=own.some(v=>c(v)>=3),pair=own.some(v=>c(v)>=2);
 let straight=own.some(v=>[v-2,v-1,v].some(start=>start>=1&&start<=4&&[start,start+1,start+2].every(n=>pool.includes(n))));
 return{poker,full,tris,pair,straight,bonus:poker?5:full?4:tris?3:pair?2:0}}
function resolve(){let orders=game.players.flatMap(p=>p.orders.map(o=>({p,o,c:combo(p,o)}))),by=a=>orders.filter(x=>x.o.action===a),size=game.players.length;let find=other.bind(null,game);
 if(game.stage===0){
 for(let{p,o,c}of by("semina")){let n=Math.min(8,o.dice.reduce((a,i)=>a+p.dice[i],0))+c.bonus;p.seeds+=n;log("🌱 "+p.name+" semina "+n)}
 for(let kind of ["contadino","cinghiale"])for(let{p,o,c}of by(kind)){let n=o.dice.reduce((a,i)=>a+p.dice[i],0)+(c.straight?2:0),key=kind==="contadino"?"farmer":"boar";game[key]=((game[key]+(o.direction==="left"?-n:n))%size+size)%size;log((kind==="contadino"?"🚜 ":"🐗 ")+p.name+" muove verso "+game.players[game[key]].name)}
 let farmer=game.players[game.farmer],boar=game.players[game.boar];farmer.seeds+=2;let loss=Math.min(2,boar.seeds);boar.seeds-=loss;log("🚜 "+farmer.name+" riceve +2 semi; 🐗 "+boar.name+" perde "+loss+" semi");
 }else if(game.stage===1){
 for(let{p,o,c}of by("raccolto")){let n=Math.min(p.seeds,o.dice.reduce((a,i)=>a+p.dice[i],0)+c.bonus);p.seeds-=n;p.pumpkins+=n;log("🎃 "+p.name+" raccoglie "+n)}
 for(let{p,o}of by("recinto")){let n=Math.min(o.dice.length,2-p.fence,Math.floor(p.pumpkins/2));p.fence+=n;p.pumpkins-=2*n;log("🪵 "+p.name+" costruisce "+n+" recinti")}
 for(let{p,o}of by("mercato")){let t=find(o.target);if(t&&t!==p){let n=Math.min(p.pumpkins,o.dice.length);p.pumpkins-=n;t.pumpkins+=n;p.pumpkins+=Math.min(1,n);log("🤝 "+p.name+" regala "+n+" a "+t.name)}}
 for(let c of game.contracts.filter(x=>x.day===game.day&&x.status==="pending"))c.status="expired";
 for(let t of game.trades.filter(x=>x.day===game.day&&x.status==="pending"))t.status="expired";
 }else{
 let guarded=new Set(by("guardia").map(x=>x.p.id));
 for(let{p,o}of by("sabotaggio")){let t=find(o.target);if(!t)continue;if(guarded.has(t.id))log("🛡️ "+t.name+" blocca il sabotaggio di "+p.name);else{t.fence=Math.max(0,t.fence-1);log("💣 "+p.name+" danneggia il recinto di "+t.name)}}
 for(let{p,o,c}of by("procioni")){let t=find(o.target);if(!t)continue;if(guarded.has(t.id)){log("🛡️ "+t.name+" respinge i procioni di "+p.name);continue}let n=Math.min(t.pumpkins,Math.max(0,Math.min(2+o.dice.length-1+Math.ceil(c.bonus/2),3-t.fence)));t.pumpkins-=n;p.pumpkins+=n;log("🦝 "+p.name+" ruba "+n+" zucche a "+t.name)}
 for(let c of game.contracts.filter(x=>x.day===game.day&&x.status==="accepted")){let a=find(c.a),b=find(c.b),betray=orders.some(x=>[c.a,c.b].includes(x.p.id)&&["procioni","sabotaggio"].includes(x.o.action)&&[c.a,c.b].includes(x.o.target)&&x.p.id!==x.o.target);c.status=betray?"betrayed":"honored";if(betray)log("💔 TRADIMENTO tra "+a.name+" e "+b.name);else{a.pumpkins++;b.pumpkins++;log("🤝 "+a.name+" e "+b.name+" rispettano il patto: +1 zucca")}}
 }
 for(let p of game.players){p.spent.push(...p.orders.flatMap(o=>o.dice));p.orders=[];p.ready=false}
 if(game.stage<2)game.stage++;else if(game.day<6){game.day++;game.stage=0;game.board=[rand(),rand(),rand()];for(let p of game.players){p.dice=Array.from({length:6},rand);p.spent=[]}log("☀️ Inizia il giorno "+game.day)}
 else{game.finished=true;let sorted=[...game.players].sort((a,b)=>b.pumpkins-a.pumpkins),w=sorted.filter(p=>p.pumpkins===sorted[0].pumpkins);log("🏆 "+(w.length>1?"Pareggio: ":"Vince ")+w.map(p=>p.name).join(" e ")+" con "+w[0].pumpkins+" zucche")}
 update();
}
function hostStart(){if(!game||game.started||game.players.length<2)return;game.started=true;game.players.forEach(p=>{p.dice=Array.from({length:6},rand);p.spent=[];p.orders=[];p.ready=false});log("🎲 La partita comincia");update()}
function hostAdvance(){if(!game?.started||game.finished||!game.players.every(p=>p.ready))return;resolve()}
function link(){return location.href.split("?")[0]+"?room="+encodeURIComponent(roomCode)}
function farm(s){let names=s.players;return'<div class="panel"><h2>🌾 La valle delle Cucuzze</h2><div class="farm">'+names.map((p,i)=>'<div class="plot"><div>'+(s.farmer===i?"🚜 ":"")+(s.boar===i?"🐗":"")+'</div><strong>'+escapeHTML(p.name)+'</strong><div class="fruit">'+("🎃".repeat(Math.min(p.pumpkins,7))||"🌱")+'</div><small>🎃 '+p.pumpkins+' · 🌱 '+p.seeds+' · 🪵 '+p.fence+'</small><small>'+(p.ready?"✅ Pronto":"⏳ Sceglie")+'</small></div>').join("")+'</div></div>'}
function history(s){return'<div class="panel"><h2>📜 Cronaca</h2><div class="history">'+s.history.slice().reverse().map(x=>'<div>'+escapeHTML(x)+'</div>').join("")+'</div></div>'}
function board(s){return'<div class="panel center"><h2>🎲 Board comune — '+N[s.stage]+'</h2><div class="dice">'+s.board.map((n,i)=>'<div class="die '+(n===null?"hidden":"")+'">'+(n===null?"?":F[n-1])+'<small>'+["Alba","Tramonto","Notte"][i]+'</small></div>').join("")+'</div></div>'}
function agreements(s){let names=Object.fromEntries(s.players.map(p=>[p.id,p.name]));return'<div class="panel"><h2>🤝 Patti e scambi</h2>'+(s.contracts.filter(t=>t.day===s.day).map(c=>'<div class="contract">'+escapeHTML(names[c.a])+' ⇄ '+escapeHTML(names[c.b])+' · Tregua: '+escapeHTML(c.status)+'</div>')).join("")+(s.trades.filter(t=>t.day===s.day).map(c=>'<div class="contract">'+escapeHTML(names[c.a])+' ⇄ '+escapeHTML(names[c.b])+' · Scambio '+c.give+'/'+c.receive+': '+escapeHTML(c.status)+'</div>')).join("")+'</div>'}
function landing(){if(remote&&!codeError){connectGuest(remote);return}mode=null;root.innerHTML='<div class="intro"><h1>🎃 CUCUZZE</h1><p>La guerra degli orti · 4–10 giocatori</p><div class="panel"><button id="create">📺 Crea partita sulla TV</button><p class="muted">Non serve installare nulla né avviare un server.</p><hr><h2>📱 Entra con il telefono</h2><input id="name" placeholder="Il tuo nome" maxlength="20" value="'+escapeHTML(localStorage.getItem("cucuzze-name")||"")+'"><input id="room" placeholder="Codice della stanza" value="'+escapeHTML(remote||"")+'"><button id="enter">Entra</button></div>'+(codeError?'<p>'+escapeHTML(codeError)+'</p>':"")+'</div>'; $("create").onclick=()=>{mode="host";connectHost()};$("enter").onclick=()=>{let code=$("room").value.trim();if(!code)return notice("Inserisci il codice stanza");localStorage.setItem("cucuzze-name",$("name").value.trim());history.replaceState({},"",location.pathname+"?room="+encodeURIComponent(code));connectGuest(code)}}
function draw(){if(mode==="host"){if(!game)return;let s=view||publicState(null);root.innerHTML='<header><h1>🎃 CUCUZZE</h1><span>TV · Online</span></header><div class="center"><h2>'+(s.finished?"🏆 FINE PARTITA":s.started?"Giorno "+s.day+" di 6 · "+N[s.stage]:"📺 Sala d’attesa")+'</h2><p>Scansiona il QR code oppure visita il link</p><div id="qrcode"></div><a href="'+escapeHTML(link())+'">'+escapeHTML(link())+'</a><p class="tag">Codice '+escapeHTML(roomCode)+'</p><p class="tag">'+s.players.filter(p=>p.ready).length+' / '+s.players.length+' pronti</p></div>'+board(s)+farm(s)+'<div class="panel center">'+(!s.started?'<button id="start" '+(s.players.length<2?"disabled":"")+'>▶ Inizia la partita</button>':s.finished?'<button id="again">🎃 Nuova partita</button>':'<button id="advance" '+(!s.players.every(p=>p.ready)?"disabled":"")+'>✨ Rivela le azioni e continua</button>')+'</div>'+agreements(s)+history(s);
 if(typeof QRCode!=="undefined")new QRCode($("qrcode"),{text:link(),width:180,height:180,colorDark:"#17291f",colorLight:"#fff"});
 $("start")?.addEventListener("click",hostStart);$("advance")?.addEventListener("click",hostAdvance);$("again")?.addEventListener("click",()=>{hostPeer?.destroy();peers.clear();mode="host";connectHost()});return}
 if(!view){root.innerHTML='<div class="intro">Connessione alla TV…</div>';return}
 let s=view,p=s.me;if(!p){root.innerHTML='<div class="intro"><h1>🎃 CUCUZZE</h1><div class="panel"><h2>Entra nella partita</h2><input id="name" maxlength="20" placeholder="Il tuo nome" value="'+escapeHTML(localStorage.getItem("cucuzze-name")||"")+'"><button id="join">🎃 Entra</button></div></div>';$("join").onclick=()=>{let name=$("name").value.trim();if(!name)return notice("Scrivi il nome");localStorage.setItem("cucuzze-name",name);send(connection,{type:"join",name})};return}
 if(!s.started){root.innerHTML='<div class="intro"><h1>🎃 CUCUZZE</h1><div class="panel"><h2>Ciao, '+escapeHTML(p.name)+'!</h2><p>Sei nella stanza. Aspetta che l’host avvii il gioco.</p><p>🎃 Parti con 5 zucche.</p></div></div>';return}
 if(s.finished){root.innerHTML='<div class="panel"><h1>🏆 Partita terminata</h1></div>'+farm(s)+history(s);return}
 let occupied=new Set([...p.spent,...p.orders.flatMap(o=>o.dice)]),limit=3-p.orders.reduce((a,o)=>a+o.dice.length,0),others=s.players.filter(x=>x.id!==p.id);
 root.innerHTML='<header><h1>🎃 CUCUZZE</h1><span>'+escapeHTML(p.name)+'</span></header><div class="center"><h2>Giorno '+s.day+' · '+N[s.stage]+'</h2><p>🎃 '+s.players.find(x=>x.id===p.id).pumpkins+' zucche</p></div>'+board(s)+
 '<div class="panel"><h2>🎲 I tuoi dadi</h2><div class="dice">'+p.dice.map((v,i)=>'<button data-die="'+i+'" class="die '+(occupied.has(i)?"spent":chosen.includes(i)?"selected":"")+'" '+(occupied.has(i)||p.ready?"disabled":"")+'>'+F[v-1]+'</button>').join("")+'</div><p class="muted">Massimo '+limit+' dadi ancora piazzabili in questa fase.</p><p id="combo"></p></div>'+
 '<div class="panel"><h2>🧺 Scegli un’azione</h2><div class="actions">'+TYPES[s.stage].map(v=>'<button data-action="'+v+'" class="'+(v===action?"selected":"outline")+'" '+(p.ready?"disabled":"")+'>'+LABEL[v]+'</button>').join("")+'</div><div id="extra"></div><button id="place" '+(!action||chosen.length<1||chosen.length>limit||p.ready?"disabled":"")+'>➕ Piazza dadi</button></div>'+
 '<div class="panel"><h2>📋 Azioni piazzate</h2>'+p.orders.map(o=>'<p>'+LABEL[o.action]+' · '+o.dice.map(i=>F[p.dice[i]-1]).join(" ")+'</p>').join("")+'<div class="actions"><button class="outline" id="undo" '+(!p.orders.length||p.ready?"disabled":"")+'>↶ Annulla ultima</button><button id="ready" '+(p.ready?"disabled":"")+'>'+(p.ready?"✅ Confermato":"✅ Conferma le scelte")+'</button></div></div>'+
 (s.stage===1&&!p.ready?'<div id="negotiation"></div>':"")+agreements(s)+history(s);
 document.querySelectorAll("[data-die]").forEach(b=>b.onclick=()=>{let i=Number(b.dataset.die);chosen=chosen.includes(i)?chosen.filter(x=>x!==i):chosen.length<3?[...chosen,i]:chosen;draw()});
 document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{action=b.dataset.action;draw()});
 let extra=$("extra");
 if(["procioni","sabotaggio","mercato"].includes(action)){if(!others.some(x=>x.id===target))target=others[0]?.id||"";extra.innerHTML='<label>Chi scegli?</label><select id="target">'+others.map(x=>'<option value="'+escapeHTML(x.id)+'" '+(target===x.id?"selected":"")+'>'+escapeHTML(x.name)+'</option>').join("")+'</select>';$("target").onchange=e=>target=e.target.value}
 if(["contadino","cinghiale"].includes(action)){extra.innerHTML='<label>Direzione</label><select id="direction"><option value="right">Destra →</option><option value="left">← Sinistra</option></select>';$("direction").value=direction;$("direction").onchange=e=>direction=e.target.value}
 $("place").onclick=()=>{send(connection,{type:"place",action,target,dice:chosen,direction});chosen=[];action="";draw()};
 $("undo").onclick=()=>send(connection,{type:"undo"});$("ready").onclick=()=>send(connection,{type:"ready"});
 let my=chosen.map(i=>p.dice[i]),pool=my.concat(s.board.filter(v=>v!==null)),pair=my.some(v=>pool.filter(n=>n===v).length>=2),tris=my.some(v=>pool.filter(n=>n===v).length>=3),poker=my.some(v=>pool.filter(n=>n===v).length>=4);
 $("combo").textContent=!my.length?"Seleziona i tuoi dadi":poker?"🎲 POKER!":tris?"🎲 TRIS!":pair?"🎲 COPPIA!":"Azione normale";
 if(s.stage===1&&!p.ready)renderNegotiation(s,p,others);
}
function renderNegotiation(s,p,others){let incoming=s.contracts.filter(c=>c.day===s.day&&c.b===p.id&&c.status==="pending"),incomingTrades=s.trades.filter(t=>t.day===s.day&&t.b===p.id&&t.status==="pending");
 let activeTruce=s.contracts.some(c=>c.day===s.day&&c.status==="accepted"&&[c.a,c.b].includes(p.id)),waitingTruce=s.contracts.some(c=>c.day===s.day&&c.status==="pending"&&c.a===p.id);
 let activeTrade=s.trades.some(t=>t.day===s.day&&t.status==="accepted"&&[t.a,t.b].includes(p.id)),waitingTrade=s.trades.some(t=>t.day===s.day&&t.status==="pending"&&t.a===p.id);
 $("negotiation").innerHTML='<div class="panel"><h2>🤝 Patti di non aggressione</h2><p>Se firmate e nessuno dei due attacca l’altro durante la Notte, ricevete +1 zucca ciascuno. Il tradimento è consentito!</p>'+incoming.map(c=>'<div class="contract">Proposta di '+escapeHTML(other(s,c.a).name)+'<button data-contract="'+c.id+'">Accetta</button><button data-decline="'+c.id+'" class="outline">Rifiuta</button></div>').join("")+(activeTruce||waitingTruce?"<p>Hai già una tregua o proposta in attesa.</p>":'<select id="partner">'+others.map(x=>'<option value="'+x.id+'">'+escapeHTML(x.name)+'</option>').join("")+'</select><button id="offerTruce">Proponi tregua</button>')+'</div>'+
 '<div class="panel"><h2>💰 Scambi immediati</h2>'+incomingTrades.map(t=>'<div class="contract">'+escapeHTML(other(s,t.a).name)+' offre '+t.give+' 🎃 e chiede '+t.receive+' 🎃<button data-trade="'+t.id+'">Accetta</button><button data-no-trade="'+t.id+'" class="outline">Rifiuta</button></div>').join("")+(activeTrade||waitingTrade?"<p>Hai già concluso uno scambio o inviato un'offerta.</p>":'<label>Giocatore</label><select id="trader">'+others.map(x=>'<option value="'+x.id+'">'+escapeHTML(x.name)+'</option>').join("")+'</select><label>Offri zucche</label><select id="give">'+[0,1,2,3].map(i=>'<option>'+i+'</option>').join("")+'</select><label>Chiedi zucche</label><select id="receive">'+[0,1,2,3].map(i=>'<option>'+i+'</option>').join("")+'</select><button id="offerTrade">Proponi scambio</button>')+'</div>';
 $("offerTruce")?.addEventListener("click",()=>send(connection,{type:"contract",target:$("partner").value}));
 document.querySelectorAll("[data-contract]").forEach(b=>b.onclick=()=>send(connection,{type:"contractReply",id:b.dataset.contract,accept:true}));
 document.querySelectorAll("[data-decline]").forEach(b=>b.onclick=()=>send(connection,{type:"contractReply",id:b.dataset.decline,accept:false}));
 $("offerTrade")?.addEventListener("click",()=>send(connection,{type:"trade",target:$("trader").value,give:Number($("give").value),receive:Number($("receive").value)}));
 document.querySelectorAll("[data-trade]").forEach(b=>b.onclick=()=>send(connection,{type:"tradeReply",id:b.dataset.trade,accept:true}));
 document.querySelectorAll("[data-no-trade]").forEach(b=>b.onclick=()=>send(connection,{type:"tradeReply",id:b.dataset.noTrade,accept:false}));
}
if(remote)connectGuest(remote);else landing();
