const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../docs/game.js'),'utf8');

/* Finto PeerJS in memoria: collega i contesti TV e telefoni. */
function network(){
 const peers={};
 class Conn{constructor(owner,remoteId){this.owner=owner;this.remoteId=remoteId;this.l={};this.open=false}
  on(n,f){this.l[n]=f} send(m){const o=this.other;if(o&&o.open)o.l.data&&o.l.data(JSON.parse(JSON.stringify(m)))}
  close(){if(!this.open)return;this.open=false;this.other.open=false;this.l.close&&this.l.close();this.other.l.close&&this.other.l.close()}}
 class Peer{constructor(id){this.id=id||'guest-'+Math.random().toString(36).slice(2);this.l={};this.disconnected=false;this.conns=[];
   setImmediate(()=>{if(peers[this.id]){this.l.error&&this.l.error({type:'unavailable-id',message:'taken'});return}peers[this.id]=this;this.l.open&&this.l.open(this.id)})}
  on(n,f){this.l[n]=f}
  connect(id){const a=new Conn(this,id);this.conns.push(a);setImmediate(()=>{const host=peers[id];if(!host){this.l.error&&this.l.error({type:'peer-unavailable',message:'nope'});return}
   const b=new Conn(host,this.id);a.other=b;b.other=a;host.conns.push(b);host.l.connection&&host.l.connection(b);a.open=b.open=true;a.l.open&&a.l.open();b.l.open&&b.l.open()});return a}
  destroy(){if(peers[this.id]===this)delete peers[this.id];for(const c of this.conns)c.close()}
  reconnect(){} }
 return {Peer,peers};
}
function device(net,search,storage={}){
 const els={};
 const el=()=>({innerHTML:'',value:'',onclick:null,onchange:null,textContent:'',dataset:{},classList:{add(){},remove(){}},addEventListener(n,f){this['on'+n]=f}});
 const document={getElementById:id=>els[id]||(els[id]=el()),querySelectorAll:()=>[]};
 const ctx={document,location:{pathname:'/Cucuzze/',href:'https://x.org/Cucuzze/'+search,search},
  localStorage:{getItem:k=>k in storage?storage[k]:null,setItem:(k,v)=>{storage[k]=String(v)},removeItem:k=>{delete storage[k]}},
  history:{replaceState(){}},URLSearchParams,Peer:net.Peer,console,Math,JSON,Date,setTimeout:(f,ms)=>setTimeout(f,Math.min(ms,5)),setImmediate};
 vm.createContext(ctx);
 vm.runInContext(source+'\n;globalThis.__t={get game(){return game},get view(){return view},get me(){return me},get offline(){return offline},send:m=>send(connection,m),hostStart,hostAdvance,draw}',ctx);
 return {ctx,els,storage,t:ctx.__t};
}
const tick=(n=20)=>new Promise(r=>{let i=0;const f=()=>++i>=n?r():setImmediate(f);f()});
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('TV + 2 telefoni: ingresso, una giornata, ripresa dopo ricarica della TV',async()=>{
 const net=network();
 const tvStore={};
 let tv=device(net,'',tvStore);
 tv.els.create.onclick();await tick();
 const room=tv.t.game.room;assert.match(room,/^cucuzze-/);
 assert.match(tv.els.app.innerHTML,/Sala d'attesa/);
 const phones=['Anna','Bruno'].map(n=>device(net,'?room='+room,{'cucuzze-name':n}));
 await tick(40);
 assert.equal(tv.t.game.players.length,2);
 for(const ph of phones){assert.ok(ph.t.me);assert.match(ph.els.app.innerHTML,/Aspetta che la TV/)}
 tv.t.hostStart();await tick();
 assert.match(phones[0].els.app.innerHTML,/I tuoi dadi/);
 assert.match(phones[0].els.app.innerHTML,/<svg/);
 // Alba: semina con un dado, poi conferma
 for(const ph of phones){ph.t.send({type:'place',action:'semina',dice:[0],target:'',direction:'right'});ph.t.send({type:'ready'})}
 await tick();
 tv.t.hostAdvance(false);await tick();
 assert.equal(tv.t.game.stage,1);
 // Tramonto: tregua proposta e accettata, il form resta renderizzabile
 const [a,b]=tv.t.game.players;
 phones[0].t.send({type:'contract',target:b.id});await tick();
 const c=tv.t.game.contracts[0];
 phones[1].t.send({type:'contractReply',id:c.id,accept:true});await tick();
 assert.equal(tv.t.game.contracts[0].status,'accepted');
 assert.match(phones[1].els.negotiation.innerHTML,/Scambio di zucche/);
 phones[0].t.send({type:'place',action:'raccolto',dice:[1],target:'',direction:'right'});await tick();
 const savedBefore=JSON.parse(tvStore['cucuzze-host-save']);
 assert.equal(savedBefore.game.stage,1);
 // La TV "ricarica la pagina": distruggiamo il peer e creiamo un nuovo contesto con lo stesso storage
 net.peers[room].destroy();await tick();
 assert.equal(phones[0].t.offline,true,'il telefono si accorge della disconnessione');
 tv=device(net,'',tvStore);
 assert.match(tv.els.app.innerHTML,/Riprendi la partita/);
 tv.els.resume.onclick();await tick();
 assert.equal(tv.t.game.room,room);assert.equal(tv.t.game.stage,1);
 assert.equal(tv.t.game.players[0].orders.length,1,'gli ordini piazzati sopravvivono');
 await wait(60);await tick(60);
 for(const ph of phones)assert.equal(ph.t.offline,false,'i telefoni si ricollegano da soli');
 assert.match(tv.els.app.innerHTML,/Giorno 1 di 6 - Tramonto/);
 // Avanzamento forzato con un giocatore non pronto
 phones[0].t.send({type:'ready'});await tick();
 tv.t.hostAdvance(false);assert.equal(tv.t.game.stage,1,'senza force aspetta tutti');
 tv.t.hostAdvance(true);await tick();assert.equal(tv.t.game.stage,2);
 // Notte: tregua rispettata (+1 a testa)
 const before=tv.t.game.players.map(p=>p.pumpkins);
 for(const ph of phones){ph.t.send({type:'place',action:'guardia',dice:[2],target:'',direction:'right'});ph.t.send({type:'ready'})}
 await tick();tv.t.hostAdvance(false);await tick();
 assert.equal(tv.t.game.day,2);
 assert.deepEqual(tv.t.game.players.map(p=>p.pumpkins),before.map(x=>x+1));
 for(const p of [tv,...phones])assert.doesNotMatch(p.els.app.innerHTML,/[←-⯿\u{1F000}-\u{1FAFF}]/u,'nessun simbolo Unicode a rischio');
});
