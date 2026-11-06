const {test}=require("node:test");
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const PORT=19138,base="http://127.0.0.1:"+PORT;
async function post(cmd,data={}){const r=await fetch(base+"/api/"+cmd,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const value=await r.json();if(!r.ok)throw Error(value.error);return value}
async function wait(){for(let i=0;i<80;i++){try{let r=await fetch(base+"/");if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,80))}throw Error("Server failed to start")}
test("TV + cellulari: stanza, giocatori, 3 fasi e dadi segreti",async()=>{
 const proc=spawn(process.execPath,["server.js"],{env:{...process.env,PORT:String(PORT),CUCUZZE_DATA_FILE:require("node:path").join(require("node:os").tmpdir(),"cucuzze-basic-"+process.pid+".json")},stdio:"pipe"});
 try{
  await wait();const {code,hostToken}=await post("create");assert.match(code,/^\d{4}$/);
  const a=await post("join",{code,name:"Anna"}),b=await post("join",{code,name:"Bruno"});
  await post("start",{code,hostToken});
  // Alba: each player can place dice and then confirms independently
  await post("place",{code,token:a.token,action:"semina",dice:[0]});
  await post("place",{code,token:b.token,action:"contadino",dice:[0],direction:"right"});
  await post("ready",{code,token:a.token});await post("ready",{code,token:b.token});
  await post("advance",{code,hostToken});
  // Tramonto
  await post("place",{code,token:a.token,action:"raccolto",dice:[1]});
  await post("place",{code,token:b.token,action:"mercato",dice:[1],target:(await getPlayerId(code,a.token))});
  await post("ready",{code,token:a.token});await post("ready",{code,token:b.token});
  await post("advance",{code,hostToken});
  // Notte
  await post("place",{code,token:a.token,action:"guardia",dice:[2]});
  await post("place",{code,token:b.token,action:"procioni",dice:[2],target:(await getPlayerId(code,a.token))});
  await post("ready",{code,token:a.token});await post("ready",{code,token:b.token});
  await post("advance",{code,hostToken});
  assert.equal((await post("create")).code.length,4);
 }finally{proc.kill("SIGTERM")}
});
async function getPlayerId(code,token){
 const response=await fetch(base+"/events?code="+code+"&token="+token);
 const reader=response.body.getReader();let chunk=await reader.read();await reader.cancel();
 const data=new TextDecoder().decode(chunk.value);let json=JSON.parse(data.slice(data.indexOf("data: ")+6).split("\n")[0]);
 return json.me.id;
}
