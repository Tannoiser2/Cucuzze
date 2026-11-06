const {test}=require("node:test");
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {tmpdir}=require("node:os");
const path=require("node:path");
const fs=require("node:fs");
const PORT=19139,base="http://127.0.0.1:"+PORT;
const sleep=n=>new Promise(resolve=>setTimeout(resolve,n));
async function api(op,params={}){let r=await fetch(base+"/api/"+op,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(params)});let j=await r.json();if(!r.ok)throw Error(j.error);return j}
async function snap(code,token){let r=await fetch(base+"/events?code="+code+"&token="+token);let reader=r.body.getReader(),chunk=await reader.read();await reader.cancel();let line=new TextDecoder().decode(chunk.value).split("\n").find(x=>x.startsWith("data: "));return JSON.parse(line.slice(6))}
async function alive(){for(let i=0;i<60;i++){try{if((await fetch(base+"/")).ok)return}catch{}await sleep(75)}throw Error("Server not ready")}
test("Six-player game: contracts, dice placement, 6 complete days and winner",async()=>{
 let tmp=path.join(tmpdir(),"cucuzze-test-"+process.pid+"-"+Date.now()+".json");
 let child=spawn(process.execPath,["server.js"],{env:{...process.env,PORT:String(PORT),CUCUZZE_DATA_FILE:tmp},stdio:"pipe"});
 try{
 await alive();
 const {code}=await api("create");
 let ps=[];
 for(let i=0;i<6;i++)ps.push(await api("join",{code,name:"Player "+i}));
 await api("start",{code});
 let ids=await Promise.all(ps.map(p=>snap(code,p.token).then(x=>x.me.id)));
 let p=(i,more={})=>({code,token:ps[i].token,...more});
 for(let day=1;day<=6;day++){
  let state=await snap(code,ps[0].token);
  assert.equal(state.day,day);assert.equal(state.stage,0);assert.equal(state.board.filter(x=>x!==null).length,1);
  for(let i=0;i<6;i++)await api("place",p(i,{action:"semina",dice:[0]}));
  for(let i=0;i<6;i++)await api("ready",p(i));
  await api("advance",{code});
  state=await snap(code,ps[0].token);assert.equal(state.stage,1);assert.equal(state.board.filter(x=>x!==null).length,2);
  if(day===1){await api("propose",p(0,{target:ids[1]}));let offered=await snap(code,ps[1].token);let contract=offered.contracts.find(c=>c.a===ids[0]&&c.b===ids[1]);assert.equal(contract.status,"pending");await api("respond",p(1,{contract:contract.id,accept:true}))}
  for(let i=0;i<6;i++)await api("place",p(i,{action:"raccolto",dice:[1]}));
  for(let i=0;i<6;i++)await api("ready",p(i));
  await api("advance",{code});
  state=await snap(code,ps[0].token);assert.equal(state.stage,2);assert.equal(state.board.filter(x=>x!==null).length,3);
  for(let i=0;i<6;i++)await api("place",p(i,{action:"guardia",dice:[2]}));
  for(let i=0;i<6;i++)await api("ready",p(i));
  await api("advance",{code});
 }
 let end=await snap(code,ps[0].token);
 assert.equal(end.finished,true);
 assert.equal(end.players.length,6);
 assert(end.history.some(line=>line.includes("Vince")));
 assert.equal(end.contracts.find(c=>c.day===6),undefined);
 assert(fs.existsSync(tmp),"Saved session should exist");
 }finally{child.kill();try{fs.unlinkSync(tmp)}catch{}}
});
