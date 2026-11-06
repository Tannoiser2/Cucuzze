const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../docs/game.js'),'utf8');
test('TV can create an online room without a browser history collision',()=>{
 const elements={};
 const element=()=>({innerHTML:'',value:'',onclick:null,textContent:'',classList:{add(){},remove(){}},addEventListener(){}});
 const document={getElementById(id){return elements[id]||(elements[id]=element())},querySelectorAll(){return []}};
 const changed=[];
 class Peer{constructor(id){this.id=id;this.listeners={};Peer.last=this}
   on(name,fn){this.listeners[name]=fn}
   destroy(){}
 }
 const context={document,location:{pathname:'/Cucuzze/',href:'https://example.com/Cucuzze/',search:''},
  localStorage:{getItem(){return null},setItem(){},removeItem(){}},
  history:{replaceState(...args){changed.push(args)}},URLSearchParams,
  Peer,console,Math,setTimeout(){}};
 vm.createContext(context);
 vm.runInContext(source,context);
 assert.equal(typeof elements.create.onclick,'function');
 elements.create.onclick();
 assert.ok(Peer.last,'the TV must create a Peer');
 assert.doesNotThrow(()=>Peer.last.listeners.open(Peer.last.id));
 assert.equal(changed.length,1,'the room opened and updated browser history');
 assert.match(elements.app.innerHTML,/Sala d'attesa/);
 assert.match(elements.app.innerHTML,/Codice/);
});
