const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const PORT=Number(process.env.PORT||8080),ROOT=path.join(__dirname,"public"),games=new Map();
const os=require("os");const ips=Object.values(os.networkInterfaces()).flat().filter(x=>x&&x.family==="IPv4"&&!x.internal);const LAN_IP=(ips[0]||{}).address||"localhost";
const DATA_FILE=process.env.CUCUZZE_DATA_FILE||path.join(__dirname,".cucuzze-sessions.json");
try{const saved=JSON.parse(fs.readFileSync(DATA_FILE,"utf8"));for(const x of saved){x.clients=new Set();if(!x.contracts)x.contracts=[];if(!x.trades)x.trades=[];games.set(x.code,x)}}catch{}
function persist(){const data=[...games.values()].map(({clients,...rest})=>rest);const tmp=DATA_FILE+".tmp";try{fs.writeFileSync(tmp,JSON.stringify(data));fs.renameSync(tmp,DATA_FILE)}catch(e){console.error("Non è possibile salvare la partita:",e.message)}}
const rand=()=>1+Math.floor(Math.random()*6),id=()=>crypto.randomBytes(8).toString("hex");
const stages=["Alba","Tramonto","Notte"];
const ACTIONS=[["semina","contadino","cinghiale"],["raccolto","recinto","mercato"],["procioni","guardia","sabotaggio"]];
const out=(res,code,obj)=>{res.writeHead(code,{"content-type":"application/json;charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(obj))};
const log=(g,s)=>{g.history.push(s);g.history=g.history.slice(-28)};
function view(g,token){let me=g.players.find(p=>p.token===token);return {joinUrl:"http://"+LAN_IP+":"+PORT+"/?code="+g.code,code:g.code,started:g.started,finished:g.finished,day:g.day,stage:g.stage,board:g.board.map((v,i)=>i<=g.stage?v:null),farmer:g.farmer,boar:g.boar,contracts:g.contracts.map(c=>({id:c.id,a:c.a,b:c.b,status:c.status,day:c.day})),trades:g.trades.map(t=>({id:t.id,a:t.a,b:t.b,give:t.give,receive:t.receive,status:t.status,day:t.day})),players:g.players.map(p=>({id:p.id,name:p.name,pumpkins:p.pumpkins,seeds:p.seeds,fence:p.fence,ready:p.ready})),me:me?{id:me.id,name:me.name,dice:me.dice,spent:me.spent,orders:me.orders,ready:me.ready}:null,history:g.history.slice(-12),host:!me}};
function broadcast(g){for(const c of [...g.clients]){try{c.res.write("data: "+JSON.stringify(view(g,c.token))+"\n\n")}catch{g.clients.delete(c)}}}
function newGame(){let code;do{code=String(Math.floor(1000+Math.random()*9000))}while(games.has(code));let g={code,hostToken:id(),started:false,finished:false,day:1,stage:0,board:[rand(),rand(),rand()],players:[],farmer:0,boar:0,history:[],contracts:[],trades:[],clients:new Set()};games.set(code,g);persist();return g}
function combination(g,p,order){
 const own=order.dice.map(i=>p.dice[i]),pool=own.concat(g.board.slice(0,g.stage+1));
 const count=n=>pool.filter(x=>x===n).length;
 const pair=own.some(n=>count(n)>=2),tris=own.some(n=>count(n)>=3),poker=own.some(n=>count(n)>=4);
 const straight=own.some(n=>[n-2,n-1,n].some(start=>start>=1&&start<=4&&[start,start+1,start+2].every(v=>pool.includes(v))));
 const full=own.some(n=>count(n)>=3)&&[...new Set(pool)].some(v=>count(v)>=3)&&[...new Set(pool)].some(v=>count(v)>=2&&v!==[...new Set(pool)].find(v=>count(v)>=3));
 return {pair,tris,poker,straight,full};
}
function boost(c){return c.poker?5:c.full?4:c.tris?3:c.pair?2:0};
function resolve(g){
 let orders=g.players.flatMap(p=>p.orders.map(o=>({p,o,c:combination(g,p,o)})));
 let by=a=>orders.filter(x=>x.o.action===a);
 let find=id=>g.players.find(p=>p.id===id);
 if(g.stage===0){
  for(let {p,o,c} of by("semina")){let n=Math.min(8,o.dice.reduce((z,i)=>z+p.dice[i],0))+boost(c);p.seeds+=n;log(g,"🌱 "+p.name+" semina "+n+" zucche")}
  for(let {p,o,c} of by("contadino")){let n=o.dice.reduce((z,i)=>z+p.dice[i],0)+(c.straight?2:0);g.farmer=(g.farmer+(o.direction==="left"?-n:n)%g.players.length+g.players.length*10)%g.players.length;log(g,"🚜 "+p.name+" sposta il Contadino da "+g.players[g.farmer].name)}
  for(let {p,o,c} of by("cinghiale")){let n=p.dice[o.dice[0]]+(c.straight?2:0);g.boar=(g.boar+(o.direction==="left"?-n:n)%g.players.length+g.players.length*10)%g.players.length;log(g,"🐗 "+p.name+" indirizza il Cinghiale verso "+g.players[g.boar].name)}
  let f=g.players[g.farmer];f.seeds+=2;log(g,"🚜 Il Contadino aiuta "+f.name+" (+2 semi)");
  let b=g.players[g.boar],lost=Math.min(2,b.seeds);b.seeds-=lost;log(g,"🐗 Il Cinghiale distrugge "+lost+" semi di "+b.name);
 } else if(g.stage===1){
  for(let {p,o,c} of by("raccolto")){let n=Math.min(p.seeds,o.dice.reduce((z,i)=>z+p.dice[i],0)+boost(c));p.seeds-=n;p.pumpkins+=n;log(g,"🎃 "+p.name+" raccoglie "+n)}
  for(let {p,o} of by("recinto")){let count=Math.min(o.dice.length,2-p.fence,Math.floor(p.pumpkins/2));p.pumpkins-=count*2;p.fence+=count;log(g,"🪵 "+p.name+" costruisce "+count+" livelli di recinto")}
  for(let {p,o} of by("mercato")){let t=find(o.target);if(t&&t!==p){let n=Math.min(p.pumpkins,o.dice.length);p.pumpkins-=n;t.pumpkins+=n;p.pumpkins+=Math.min(1,n);log(g,"🤝 "+p.name+" dona "+n+" zucche a "+t.name+" e ottiene un bonus di mercato di "+Math.min(1,n))}}
 }else{
  let guarded=new Set(by("guardia").map(x=>x.p.id));
  for(let {p,o} of by("sabotaggio")){let t=find(o.target);if(!t||t===p)continue;if(guarded.has(t.id))log(g,"🛡️ "+t.name+" blocca il sabotaggio di "+p.name);else{t.fence=Math.max(0,t.fence-1);log(g,"💣 "+p.name+" sabota "+t.name)}}
  let thefts=new Map();
  for(let {p,o,c} of by("procioni")){let t=find(o.target);if(!t||t===p)continue;if(guarded.has(t.id)){log(g,"🛡️ "+t.name+" respinge i procioni di "+p.name);continue}let amount=Math.max(0,Math.min(2+o.dice.length-1+Math.ceil(boost(c)/2),3-t.fence));if(!thefts.has(t.id))thefts.set(t.id,[]);thefts.get(t.id).push({p,amount})}
  for(let [tid,attackers] of thefts){let victim=find(tid);for(let {p,amount} of attackers.sort((a,b)=>a.p.id.localeCompare(b.p.id))){let n=Math.min(victim.pumpkins,amount);victim.pumpkins-=n;p.pumpkins+=n;log(g,"🦝 "+p.name+" ruba "+n+" zucche a "+victim.name)}}
  for(let {p} of by("guardia"))log(g,"🔦 "+p.name+" monta la guardia");
  for(let c of g.contracts.filter(c=>c.day===g.day&&c.status==="accepted")){let attacker=find(c.a),victim=find(c.b);let a=orders.some(x=>x.p.id===c.a&&["procioni","sabotaggio"].includes(x.o.action)&&x.o.target===c.b);let b=orders.some(x=>x.p.id===c.b&&["procioni","sabotaggio"].includes(x.o.action)&&x.o.target===c.a);c.status=a||b?"betrayed":"honored";if(a||b){let traitors=[a?attacker.name:null,b?victim.name:null].filter(Boolean).join(" e ");log(g,"💔 PATTO TRADITO! "+traitors+" viola la tregua")}else{attacker.pumpkins++;victim.pumpkins++;log(g,"🤝 Patto rispettato: +1 zucca a "+attacker.name+" e "+victim.name)}}
 }
 for(let p of g.players){p.spent.push(...p.orders.flatMap(o=>o.dice));p.orders=[];p.ready=false}
 log(g,"✅ "+stages[g.stage]+" conclusa");
 if(g.stage<2)g.stage++;else if(g.day<6){g.day++;g.stage=0;g.board=[rand(),rand(),rand()];for(let p of g.players){p.dice=Array.from({length:6},rand);p.spent=[]}log(g,"☀️ Inizia il giorno "+g.day)}
 else{g.finished=true;let winners=[...g.players].sort((a,b)=>b.pumpkins-a.pumpkins);log(g,"🏆 Vince "+winners[0].name+" con "+winners[0].pumpkins+" zucche")}
 persist();broadcast(g);
}
function requestBody(req){return new Promise((ok,bad)=>{let data="";req.on("data",x=>{data+=x;if(data.length>12000)bad(Error("Richiesta troppo grande"))});req.on("end",()=>{try{ok(JSON.parse(data||"{}"))}catch{bad(Error("JSON non valido"))}})})}
http.createServer(async(req,res)=>{
 try{
  let url=new URL(req.url,"http://localhost");
  if(req.method==="GET"&&url.pathname==="/events"){let g=games.get(url.searchParams.get("code"));if(!g)return out(res,404,{error:"Stanza inesistente"});res.writeHead(200,{"content-type":"text/event-stream","cache-control":"no-cache, no-transform","connection":"keep-alive"});let client={res,token:url.searchParams.get("token")};g.clients.add(client);res.write("data: "+JSON.stringify(view(g,client.token))+"\n\n");req.on("close",()=>g.clients.delete(client));return}
  if(req.method==="POST"&&url.pathname.startsWith("/api/")){
   let d=await requestBody(req),cmd=url.pathname.slice(5);
   if(cmd==="create"){let g=newGame();return out(res,200,{code:g.code,hostToken:g.hostToken})}
   let g=games.get(d.code);if(!g)throw Error("Stanza non trovata");
   if(cmd==="join"){if(g.started||g.players.length>=10)throw Error("Stanza già avviata o piena");let name=String(d.name||"").trim().slice(0,20);if(!name)throw Error("Inserisci il nome");let p={id:id(),token:id(),name,pumpkins:5,seeds:0,fence:0,dice:[],spent:[],orders:[],ready:false};g.players.push(p);persist();broadcast(g);return out(res,200,{token:p.token})}
   if(cmd==="start"){if(g.hostToken&&d.hostToken!==g.hostToken)throw Error("Solo chi ospita può avviare");if(g.started||g.players.length<2)throw Error("Servono almeno 2 giocatori");g.started=true;g.players.forEach(p=>p.dice=Array.from({length:6},rand));log(g,"🎲 Comincia Cucuzze!");persist();broadcast(g);return out(res,200,{ok:true})}
   if(!g.started||g.finished)throw Error("Partita non attiva");
   if(cmd==="advance"){if(g.hostToken&&d.hostToken!==g.hostToken)throw Error("Solo chi ospita può avanzare");if(!g.players.every(p=>p.ready))throw Error("Aspetta tutte le conferme");if(g.stage===1){for(const c of g.contracts.filter(c=>c.day===g.day&&c.status==="pending"))c.status="expired";for(const t of g.trades.filter(t=>t.day===g.day&&t.status==="pending"))t.status="expired"}resolve(g);return out(res,200,{ok:true})}
   let p=g.players.find(p=>p.token===d.token);if(!p)throw Error("Giocatore sconosciuto");
   if(cmd==="propose"){if(g.stage!==1||p.ready)throw Error("Proponi i patti soltanto al tramonto prima di confermare");let other=g.players.find(t=>t.id===d.target&&t!==p);if(!other)throw Error("Scegli un altro giocatore");if(g.contracts.some(c=>c.day===g.day&&c.status==="pending"&&c.a===p.id))throw Error("Hai già un patto in attesa");let contract={id:id(),a:p.id,b:other.id,day:g.day,status:"pending"};g.contracts.push(contract);log(g,"🤝 "+p.name+" propone una tregua a "+other.name);persist();broadcast(g);return out(res,200,{ok:true})}
   if(cmd==="respond"){if(g.stage!==1||p.ready)throw Error("Il patto si accetta al tramonto");let c=g.contracts.find(c=>c.id===d.contract&&c.b===p.id&&c.status==="pending");if(!c)throw Error("Proposta non trovata");if(d.accept&&g.contracts.some(other=>other.day===g.day&&other.status==="accepted"&&[other.a,other.b].some(id=>id===c.a||id===c.b)))throw Error("Un giocatore può avere una sola tregua al giorno");c.status=d.accept?"accepted":"rejected";log(g,d.accept?"🤝 "+p.name+" firma una tregua con "+g.players.find(z=>z.id===c.a).name:"❌ "+p.name+" rifiuta il patto");persist();broadcast(g);return out(res,200,{ok:true})}
   if(cmd==="tradePropose"){
     if(g.stage!==1||p.ready)throw Error("Puoi contrattare solo al tramonto");
     let other=g.players.find(q=>q.id===d.target&&q!==p);if(!other)throw Error("Scegli un partner");
     let give=Number(d.give),receive=Number(d.receive);
     if(!Number.isInteger(give)||!Number.isInteger(receive)||give<0||receive<0||give>3||receive>3||(give===0&&receive===0))throw Error("Offerta non valida: 0-3 zucche per lato");
     if(g.trades.some(t=>t.day===g.day&&t.status==="pending"&&t.a===p.id))throw Error("Hai già un'offerta in attesa");
     if(g.trades.some(t=>t.day===g.day&&t.status==="accepted"&&[t.a,t.b].includes(p.id)))throw Error("Hai già fatto uno scambio oggi");
     let trade={id:id(),a:p.id,b:other.id,give,receive,day:g.day,status:"pending"};g.trades.push(trade);
     log(g,"💰 "+p.name+" offre uno scambio a "+other.name);persist();broadcast(g);return out(res,200,{ok:true})
   }
   if(cmd==="tradeRespond"){
     if(g.stage!==1||p.ready)throw Error("Lo scambio va accettato prima della conferma");
     let t=g.trades.find(t=>t.id===d.trade&&t.b===p.id&&t.status==="pending");if(!t)throw Error("Offerta non trovata");
     let a=g.players.find(q=>q.id===t.a);
     if(d.accept){
       if(g.trades.some(other=>other!==t&&other.day===g.day&&other.status==="accepted"&&[other.a,other.b].some(id=>id===a.id||id===p.id)))throw Error("Un solo scambio per giocatore al giorno");
       if(a.pumpkins<t.give||p.pumpkins<t.receive)throw Error("Zucche insufficienti per lo scambio");
       a.pumpkins=a.pumpkins-t.give+t.receive;p.pumpkins=p.pumpkins-t.receive+t.give;t.status="accepted";
       log(g,"💰 Scambio concluso tra "+a.name+" e "+p.name+": "+t.give+" / "+t.receive+" zucche");
     }else{t.status="rejected";log(g,"❌ "+p.name+" rifiuta lo scambio di "+a.name)}
     persist();broadcast(g);return out(res,200,{ok:true})
   }
   if(cmd==="place"){if(p.ready)throw Error("Già confermato");if(!ACTIONS[g.stage].includes(d.action))throw Error("Azione non disponibile");let dice=d.dice;if(!Array.isArray(dice)||dice.length<1||dice.length>3||dice.some(i=>!Number.isInteger(i)||i<0||i>=6)||new Set(dice).size!==dice.length)throw Error("Dadi non validi");let occupied=p.orders.flatMap(o=>o.dice);if(occupied.length+dice.length>3||dice.some(i=>p.spent.includes(i)||occupied.includes(i)))throw Error("Dado occupato o limite di fase raggiunto");if(["mercato","procioni","sabotaggio"].includes(d.action)&&(!g.players.some(t=>t.id===d.target&&t!==p)))throw Error("Scegli un bersaglio");p.orders.push({action:d.action,dice,target:d.target||null,direction:d.direction==="left"?"left":"right"});persist();broadcast(g);return out(res,200,{ok:true})}
   if(cmd==="undo"){if(p.ready)throw Error("Scelta già confermata");p.orders.pop();persist();broadcast(g);return out(res,200,{ok:true})}
   if(cmd==="ready"){p.ready=true;persist();broadcast(g);return out(res,200,{ok:true})}
   throw Error("Comando sconosciuto");
  }
  if(req.method==="GET"){let relative=url.pathname==="/"?"/index.html":url.pathname,fp=path.resolve(ROOT,"."+relative);if(!fp.startsWith(ROOT+path.sep)||!fs.existsSync(fp)||!fs.statSync(fp).isFile()){res.writeHead(404);return res.end("Not found")}let ct=fp.endsWith(".html")?"text/html; charset=utf-8":fp.endsWith(".js")?"text/javascript; charset=utf-8":"text/css; charset=utf-8";res.writeHead(200,{"content-type":ct});return fs.createReadStream(fp).pipe(res)}
  out(res,405,{error:"Metodo non supportato"});
 }catch(e){out(res,400,{error:e.message})}
}).listen(PORT,"0.0.0.0",()=>console.log("CUCUZZE http://localhost:"+PORT));