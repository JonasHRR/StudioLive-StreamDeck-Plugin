import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function inspector(level=false,settings:Record<string,unknown>={}) {
 const elements=new Map<string,any>();
 const get=(id:string)=>{
  if(!elements.has(id)){
   const element:any={value:'',checked:true,hidden:false,disabled:true,textContent:'',options:[],add(option:any){this.options.push(option);}};
   Object.defineProperty(element,'innerHTML',{set(){element.options=[];}});elements.set(id,element);
  }
  return elements.get(id);
 };
 const sent:any[]=[],timers=new Map<number,()=>void>();let ws:any,nextTimer=0;
 class FakeWebSocket {static OPEN=1;readyState=1;constructor(){ws=this;}send(text:string){sent.push(JSON.parse(text));}}
 const box:any={document:{getElementById:get},Option:class{constructor(public text:string,public value:unknown){}},WebSocket:FakeWebSocket,window:{STUDIOLIVE_DEFAULT_IP:'192.0.2.1'},setTimeout:(fn:()=>void)=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:(id:number)=>timers.delete(id)};
 vm.createContext(box);vm.runInContext(readFileSync('de.local.studiolive-mutes.sdPlugin/ui/settings.js','utf8'),box);
 const action=`de.local.studiolive-mutes.${level?'level':'channel'}`;
 box.window.connectElgatoStreamDeckSocket('12345','pi-registration','registerPropertyInspector','{}',JSON.stringify({action,context:'button-context',payload:{settings}}));ws.onopen();
 const reply=(payload:any)=>ws.onmessage({data:JSON.stringify({event:'sendToPropertyInspector',payload})});
 const acknowledge=(ip:string,requestId=sent.at(-1).payload.requestId)=>reply({type:'mixerSettings',requestId,ok:true,settings:{ip}});
 const load=sent.find(m=>m.event==='sendToPlugin');
 return {get,sent,ws,reply,acknowledge,load,action,timers};
}
test('inspector uses its registration context even when actionInfo.context differs; waits for save confirmation',()=>{
 const {get,sent,ws,acknowledge,load,action}=inspector(false,{channel:24,mode:'on',name:'Voice'});
 assert.deepEqual(sent[0],{event:'registerPropertyInspector',uuid:'pi-registration'});
 assert.equal(load.context,'pi-registration');assert.equal(load.action,action);
 assert.equal(sent.some(m=>m.event==='getGlobalSettings'||m.event==='setGlobalSettings'),false);
 assert.equal(get('save').disabled,true);acknowledge('192.0.2.2',load.payload.requestId);
 assert.equal(get('ip').value,'192.0.2.2');assert.equal(get('save').disabled,false);
 get('channel').value='5';get('mode').value='off';get('name').value='Vocal';get('channel').onchange();
 assert.deepEqual(sent.at(-1),{event:'setSettings',action,context:'pi-registration',payload:{channel:5,mode:'off',name:'Vocal'}});
 for(const ip of ['not-an-ip','192.0.2.1']){get('ip').value=ip;const count=sent.length;get('save').onclick();assert.equal(sent.length,count);}
 get('ip').value='192.0.2.3';get('save').onclick();assert.equal(sent.at(-1).payload.operation,'save');assert.equal(sent.at(-1).payload.ip,'192.0.2.3');
 assert.equal(get('save').disabled,true);assert.equal(get('message').textContent,'Saving mixer IP …');
 acknowledge('192.0.2.3');assert.match(get('message').textContent,/saved on this computer/);assert.equal(get('save').disabled,false);
 ws.onclose();assert.equal(get('save').disabled,true);
});
test('inspector leaves missing address blank and never reports failure, timeout or stale reply as a successful save',()=>{
 const {get,sent,reply,acknowledge,load,timers}=inspector();
 acknowledge('',load.payload.requestId);assert.equal(get('ip').value,'');
 get('ip').value='192.0.2.3';get('save').onclick();const id=sent.at(-1).payload.requestId;
 reply({type:'mixerSettings',requestId:'stale',ok:true,settings:{ip:'192.0.2.4'}});assert.equal(get('message').textContent,'Saving mixer IP …');
 reply({type:'mixerSettings',requestId:id,ok:false,message:'Disk write failed.'});assert.equal(get('message').textContent,'Disk write failed.');assert.equal(get('ip').value,'192.0.2.3');
 get('save').onclick();for(const callback of [...timers.values()])callback();assert.match(get('message').textContent,/No confirmation/);
 acknowledge('192.0.2.4');assert.equal(get('ip').value,'192.0.2.3');assert.doesNotMatch(get('message').textContent,/saved/);
});
test('property inspector persists inverted send target and automatic name preference',()=>{
 const {get,sent}=inspector();get('target').value='auxsend';get('target').onchange();
 assert.equal(get('sendRow').hidden,false);assert.equal(get('channel').value,1);
 get('channel').value='24';get('mix').value='16';get('autoName').checked=false;get('channel').onchange();
 assert.deepEqual(sent.at(-1).payload,{target:'auxsend',channel:24,mix:16,mode:'toggle',name:'',autoName:false});
});
test('level inspector persists step/fade duration and exposes stop without a new value',()=>{
 const {get,sent}=inspector(true);assert.equal(get('levelFields').hidden,false);assert.equal(get('muteFields').hidden,true);
 get('operation').value='step';get('operation').onchange();assert.equal(get('db').value,1);assert.equal(get('floorRow').hidden,true);
 get('db').value='-1';get('duration').value='2.5';get('duration').onchange();assert.equal(sent.at(-1).payload.db,-1);assert.equal(sent.at(-1).payload.duration,2.5);
 assert.equal(get('floorRow').hidden,true);assert.equal(sent.at(-1).payload.fadeLabel,undefined);
 get('operation').value='stop';get('operation').onchange();assert.equal(get('levelValues').hidden,true);assert.equal(sent.at(-1).payload.operation,'stop');
});
test('infinity checkbox stores the existing -84 floor value, restores old settings and never becomes a relative -84 step',()=>{
 const {get,sent}=inspector(true,{operation:'set',db:-84,duration:3,fadeLabel:'out'});
 assert.equal(get('floorRow').hidden,false);assert.equal(get('floor').checked,true);assert.equal(get('db').disabled,true);
 get('duration').value=4;get('duration').onchange();assert.equal(sent.at(-1).payload.db,-84);assert.equal(sent.at(-1).payload.fadeLabel,'out');
 get('floor').checked=false;get('floor').onchange();assert.equal(sent.at(-1).payload.db,0);assert.equal(get('db').disabled,false);assert.equal(get('db').min,-60);
 get('floor').checked=true;get('floor').onchange();assert.equal(sent.at(-1).payload.db,-84);assert.equal(get('db').disabled,true);
 get('operation').value='step';get('operation').onchange();assert.equal(get('floorRow').hidden,true);assert.equal(get('floor').checked,false);assert.equal(get('db').disabled,false);assert.equal(sent.at(-1).payload.db,1);assert.equal(get('db').min,-12);
});

test('toggle fade inspector hides endpoint controls, saves duration and restores saved toggles',()=>{
 const {get,sent}=inspector(true,{operation:'set',db:-84,duration:0});
 get('operation').value='toggle';get('operation').onchange();
 assert.equal(sent.at(-1).payload.operation,'toggle');assert.equal(sent.at(-1).payload.db,0);assert.equal(sent.at(-1).payload.duration,3);
 assert.equal(get('floorRow').hidden,true);assert.equal(get('db').hidden,true);assert.equal(get('dbLabel').hidden,true);assert.equal(get('db').disabled,true);
 assert.equal(get('toggleHelp').hidden,false);assert.equal(get('levelValues').hidden,false);
 get('duration').value='1.5';get('duration').onchange();assert.equal(sent.at(-1).payload.duration,1.5);
 const restored=inspector(true,sent.at(-1).payload);assert.equal(restored.get('operation').value,'toggle');assert.equal(restored.get('duration').value,1.5);
 assert.equal(restored.get('db').disabled,true);assert.equal(restored.get('toggleHelp').hidden,false);
 get('duration').value='0';get('duration').onchange();assert.equal(sent.at(-1).payload.duration,0);
 get('operation').value='set';get('operation').onchange();assert.equal(get('db').hidden,false);assert.equal(get('db').disabled,false);assert.equal(get('toggleHelp').hidden,true);
});

test('mute and level inspectors persist custom button color independently, restore it and return to automatic color',()=>{
 for(const level of [false,true]){
  const {get,sent,ws}=inspector(level,{channel:2,mode:'off',operation:'set',db:-6,duration:3});
  assert.equal(get('colorMode').value,'auto');assert.equal(get('colorRow').hidden,true);assert.equal(get('customColor').disabled,true);
  get('colorMode').value='custom';get('colorMode').onchange();assert.equal(get('colorRow').hidden,false);assert.equal(get('customColor').disabled,false);
  get('customColor').value='#336699';get('customColor').onchange();assert.equal(sent.at(-1).context,'pi-registration');assert.equal(sent.at(-1).payload.customColor,'#336699');
  get('channel').value='3';get('channel').onchange();assert.equal(sent.at(-1).payload.customColor,'#336699');assert.equal(sent.at(-1).payload.colorMode,'custom');
  const restored=inspector(level,sent.at(-1).payload);assert.equal(restored.get('customColor').value,'#336699');assert.equal(restored.get('colorRow').hidden,false);
  get('colorMode').value='auto';get('colorMode').onchange();assert.equal(sent.at(-1).payload.colorMode,'auto');assert.equal(sent.at(-1).payload.customColor,'#336699');assert.equal(get('colorRow').hidden,true);
  get('colorMode').value='custom';get('colorMode').onchange();assert.equal(get('customColor').value,'#336699');
  ws.onclose();assert.equal(get('customColor').disabled,true);assert.equal(get('colorMode').disabled,true);
 }
 const invalid=inspector(false,{colorMode:'custom',customColor:'bad'});assert.equal(invalid.get('customColor').value,'#06685c');
});

test('target lists append live mixer names, keep numeric values and preserve selection and unsaved edits',()=>{
 for(const level of [false,true]){
  const {get,sent,reply}=inspector(level,{channel:2,autoName:false,name:'Custom'});
  const request=sent.find(message=>message.payload?.type==='targetNames');assert.equal(request.context,'pi-registration');
  const publish=(names:any,requestId=request.payload.requestId)=>reply({type:'targetNames',requestId,names});
  const label=(index:number)=>get('channel').options[index].text;
  assert.equal(label(0),'No. 1');publish({line:['Ignored']},'old-session');assert.equal(label(0),'No. 1');
  get('name').value='Still typing';get('duration').value='2.7';const count=sent.length;
  publish({line:['Mic 1','<Mic 2>'],aux:['Monitor'],fxbus:['Hall'],group:['Band'],main:['Main mix']});
  assert.equal(label(0),'No. 1 · Mic 1');assert.equal(label(1),'No. 2 · <Mic 2>');assert.equal(label(2),'No. 3');
  assert.equal(get('channel').value,2);assert.equal(get('name').value,'Still typing');assert.equal(get('duration').value,'2.7');assert.equal(sent.length,count);
  assert.equal(Number(get('channel').options[1].value),2);
  publish({line:['Lead','Updated']});assert.equal(label(1),'No. 2 · Updated');assert.equal(get('channel').value,2);
  publish({});assert.equal(label(1),'No. 2');assert.equal(get('channel').value,2);
 }
 const {get,sent,reply}=inspector(false,{target:'auxsend',channel:2,mix:1});
 const request=sent.find(message=>message.payload?.type==='targetNames');
 const names={line:['Mic 1','Mic 2'],aux:['Monitor'],fxbus:['Hall'],group:['Band'],main:['Main mix'],sub:['Drums'],fxreturn:['Reverb']};
 reply({type:'targetNames',requestId:request.payload.requestId,names});
 assert.equal(get('channel').options[1].text,'No. 2 · Mic 2');assert.equal(get('mix').options[0].text,'Aux 1 · Monitor');
 get('target').value='fxsend';get('target').onchange();assert.equal(get('mix').options[0].text,'FX 1 · Hall');
 for(const [type,label] of [['group','Group 1 · Band'],['main','No. 1 · Main mix'],['sub','No. 1 · Drums'],['fxreturn','No. 1 · Reverb']]){
  get('target').value=type;get('target').onchange();assert.equal(get('channel').options[0].text,label);assert.equal(sent.at(-1).payload.channel,1);
 }
});

test('mute and level inputs include channel 64; sends also retain 64 sources and existing destination limits',()=>{
 for(const level of [false,true]){
  const {get,sent,reply}=inspector(level,{channel:32});assert.equal(get('channel').options.length,64);assert.equal(get('channel').value,32);
  const request=sent.find(message=>message.payload?.type==='targetNames');
  const names=Array.from({length:64},(_,index)=>`Input ${index+1}`);reply({type:'targetNames',requestId:request.payload.requestId,names:{line:names}});
  assert.equal(get('channel').options[63].text,'No. 64 · Input 64');get('channel').value='64';get('channel').onchange();assert.equal(sent.at(-1).payload.channel,64);
 }
 const {get}=inspector();for(const [kind,destinations] of [['auxsend',16],['fxsend',4]] as const){get('target').value=kind;get('target').onchange();assert.equal(get('channel').options.length,64);assert.equal(get('mix').options.length,destinations);}
});

test('mute and level inspectors group A1/A2, Tape and Talkback and retain existing saved targets',()=>{
 for(const level of [false,true]){
  const {get,sent,reply}=inspector(level,{channel:64,operation:'toggle',duration:2,colorMode:'custom',customColor:'#336699'});
  const request=sent.find(message=>message.payload?.type==='targetNames');
  reply({type:'targetNames',requestId:request.payload.requestId,names:{auxinput:['Playback','Laptop','Outside limit'],tape:['Recorder'],talkback:['Stage']}});
  assert.equal(get('target').options.find((option:any)=>option.value==='additionalinput').text,'Additional inputs');
  assert.equal(get('target').options.find((option:any)=>option.value==='aux').text,'Mix bus');
  assert.equal(get('target').options.some((option:any)=>['auxinput','tape','talkback'].includes(option.value)),false);
  get('target').value='additionalinput';get('target').onchange();assert.equal(get('sendRow').hidden,true);
  assert.deepEqual(get('channel').options.map((option:any)=>option.text),['A1 · Playback','A2 · Laptop','Tape · Recorder','Talkback · Stage']);
  for(const [index,kind,channel,label] of [[1,'auxinput',1,'A1'],[2,'auxinput',2,'A2'],[3,'tape',1,'Tape'],[4,'talkback',1,'Talkback']] as const){
   get('channel').value=String(index);get('channel').onchange();
   const settings=sent.at(-1).payload;assert.equal(settings.channel,channel);assert.equal(settings.target,kind);assert.equal(settings.customColor,'#336699');assert.equal(settings.duration,2);
   const restored=inspector(level,settings);assert.equal(restored.get('target').value,'additionalinput');assert.equal(Number(restored.get('channel').value),index);
   assert.equal(restored.get('channel').options[index-1].text,label);
   get('name').value='Still typing';const before=sent.length;
   reply({type:'targetNames',requestId:request.payload.requestId,names:{auxinput:['Playback','Laptop'],tape:['Updated recorder'],talkback:['Updated stage']}});
   assert.equal(Number(get('channel').value),index);assert.equal(get('name').value,'Still typing');assert.equal(sent.length,before);
  }
  get('target').value='aux';get('target').onchange();get('channel').value='16';get('channel').onchange();
  assert.equal(sent.at(-1).payload.target,'aux');assert.equal(sent.at(-1).payload.channel,16);
  const bus=inspector(level,{target:'aux',channel:16});assert.equal(bus.get('target').value,'aux');assert.equal(Number(bus.get('channel').value),16);
 }
});
