const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../docs/game.js'),'utf8');
test('Browser-only Cucuzze: 6-player full six-day game without Node server',()=>{
 const dummy=()=>({innerHTML:'',textContent:'',value:'',onclick:null,classList:{add(){},remove(){}},addEventListener(){}});
 const nodes={app:dummy()};
 const document={getElementById:k=>nodes[k]||(nodes[k]=dummy()),querySelectorAll:()=>[]};
 const storage={getItem:()=>null,setItem(){},removeItem(){}};
 const context={document,localStorage:storage,location:{search:'',pathname:'/Cucuzze/',href:'https://example.org/Cucuzze/'},history:{replaceState(){}},URLSearchParams,setTimeout(){},console,Math};
 vm.createContext(context);
 vm.runInContext(code+'\n;globalThis.__test={initial,resolve,hostStart,setGame(g){game=g},setMode(m){mode=m},setRoom(r){roomCode=r}}',context);
 const api=context.__test;
 api.setMode('host');api.setRoom('cucuzze-ci');
 let game=api.initial();
 for(let i=0;i<6;i++)game.players.push({id:'test-'+i,name:'Player '+i,pumpkins:5,seeds:0,fence:0,spent:[],orders:[],dice:[],ready:false});
 api.setGame(game);api.hostStart();
 assert.equal(game.started,true);
 for(let day=1;day<=6;day++){
   for(let stage=0;stage<3;stage++){
     assert.equal(game.day,day);assert.equal(game.stage,stage);
     for(const p of game.players){p.orders=[{action:['semina','raccolto','guardia'][stage],dice:[stage],direction:'right'}];p.ready=true}
     api.resolve();
   }
 }
 assert.equal(game.finished,true);assert.equal(game.players.length,6);
 assert.ok(game.history.some(t=>t.includes('Vince')||t.includes('Pareggio')));
});
