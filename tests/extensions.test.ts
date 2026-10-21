import test from 'node:test';
import assert from 'node:assert/strict';
import { MixerService, CommandCancelled } from '../src/mixer-service.js';
import { ButtonController, type ButtonSink } from '../src/button-controller.js';
import { target, mutePath, levelPath, levelRequest, dbToLevel, levelToDb, parameterKind } from '../src/controls.js';
import { decodeParameter, decodeFaders, decodeState, parameterPacket, packet } from '../src/protocol.js';
import { StudioLiveTransport } from '../src/studiolive.js';
import { SimulatedMixer, tick, until } from './simulator.js';
import { syncState, tcpMixer, ub } from './protocol-fixture.js';
import { deflateSync } from 'node:zlib';
const opts={ackMs:50,backoffMs:5,maxBackoffMs:20,queueAgeMs:500};
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function setup(t:test.TestContext) {
  const devices:SimulatedMixer[]=[];
  const service=new MixerService(()=>{
    const mixer=new SimulatedMixer(); mixer.values=decodeState(syncState()); devices.push(mixer); return mixer;
  },opts);
  t.after(()=>service.stop()); service.configure('192.0.2.1'); await tick(); return {service,devices,mixer:devices[0]};
}
const request=(db:number,durationMs=0,operation:'set'|'step'|'stop'|'toggle'='set')=>levelRequest(target(),operation,db,durationMs);

test('toggle fades alternate confirmed endpoints and synchronize duplicate button previews',async t=>{
 const {service,mixer}=await setup(t),controller=new ButtonController(service);t.after(()=>controller.dispose());
 const images=new Map<string,string>();let alerts=0;
 const sink=(id:string):ButtonSink=>({async setTitle(){},async setImage(uri){images.set(id,Buffer.from(uri.split(',')[1],'base64').toString());},async showAlert(){alerts++;}});
 const settings={channel:1,actionType:'level',operation:'toggle',db:0,duration:0.12};
 controller.appear('a',sink('a'),settings);controller.appear('b',sink('b'),settings);await controller.flushed();
 const labels=()=>[...images.values()].map(svg=>svg.match(/<text data-role="function"[^>]*>(.*?)<\/text>/)![1]);
 assert.deepEqual(labels(),['FADE OUT','FADE OUT']);assert.equal(mixer.parameterWrites.length,0);
 const out=controller.press(settings,sink('a'));await controller.flushed();assert.deepEqual(labels(),['FADE IN','FADE IN']);
 await out;await controller.flushed();assert.equal(service.viewTarget(target(),true).level,0);
 const inside=controller.press(settings,sink('b'));await controller.flushed();assert.deepEqual(labels(),['FADE OUT','FADE OUT']);
 await inside;assert.equal(service.viewTarget(target(),true).level,dbToLevel(0));
 await controller.press(settings,sink('a'));assert.equal(service.viewTarget(target(),true).level,0);assert.equal(alerts,0);
 mixer.externalParameter('line/ch1/volume',dbToLevel(-12));await controller.flushed();assert.deepEqual(labels(),['FADE OUT','FADE OUT']);
});

test('rapid toggle presses reverse the intended fade even before its first step',async t=>{
 const {service,mixer}=await setup(t);
 const first=service.executeLevel(request(0,160,'toggle')).catch(error=>error);
 assert.equal(service.viewTarget(target(),true).fadeTarget,0);
 const second=service.executeLevel(request(0,160,'toggle')).catch(error=>error);
 assert.equal(service.viewTarget(target(),true).fadeTarget,dbToLevel(0));
 const third=service.executeLevel(request(0,160,'toggle'));
 assert.equal(service.viewTarget(target(),true).fadeTarget,0);
 assert.ok(await first instanceof CommandCancelled);assert.ok(await second instanceof CommandCancelled);
 await third;assert.equal(service.viewTarget(target(),true).level,0);
 assert.ok(mixer.parameterWrites.length>1);
});

test('toggle reversal waits for an outstanding echo and resumes from confirmed position',async t=>{
 const {service,mixer}=await setup(t);mixer.autoAck=false;
 const out=service.executeLevel(request(0,240,'toggle')).catch(error=>error);
 await until(()=>mixer.parameterWrites.length===1);const sent=mixer.parameterWrites[0].value as number;
 const inside=service.executeLevel(request(0,160,'toggle'));
 assert.equal(service.viewTarget(target(),true).fadeTarget,dbToLevel(0));assert.equal(mixer.parameterWrites.length,1);
 mixer.autoAck=true;mixer.externalParameter('line/ch1/volume',sent);
 assert.ok(await out instanceof CommandCancelled);await inside;
 assert.equal(service.viewTarget(target(),true).level,dbToLevel(0));
 const after=mixer.parameterWrites.slice(1).map(write=>write.value as number);
 assert.ok(after.length>1);assert.ok(after.every((value,index)=>value>= (index?after[index-1]:sent)));
});

test('instant toggles use queued confirmed values; unknown state rejects and reconnect never replays a toggle',async t=>{
 const {service,mixer,devices}=await setup(t);
 await Promise.all([service.executeLevel(request(0,0,'toggle')),service.executeLevel(request(0,0,'toggle'))]);
 assert.deepEqual(mixer.parameterWrites.map(write=>write.value),[0,dbToLevel(0)]);
 const fading=service.executeLevel(request(0,500,'toggle')).catch(error=>error);await until(()=>mixer.parameterWrites.length>2);
 mixer.disconnect();const offline=assert.rejects(service.executeLevel(request(0,100,'toggle')));
 await offline;await fading;
 await until(()=>devices.length===2 && service.status==='online');await pause(80);assert.equal(devices[1].parameterWrites.length,0);
 devices[1].externalParameter('line/ch1/volume',0);
 await service.executeLevel(request(0,100,'toggle'));assert.equal(service.viewTarget(target(),true).level,dbToLevel(0));
 assert.throws(()=>levelRequest(target('main'),'toggle',0,NaN));
 assert.throws(()=>levelRequest(target('group'),'toggle',0,100));
});
test('target paths, send inversion and strict write allowlist',()=>{
  assert.equal(mutePath(target('group',8)),'mutegroup/mutegroup8');
  assert.equal(mutePath(target('auxsend',24,16)),'line/ch24/assign_aux16');
  assert.equal(mutePath(target('fxsend',1,4)),'line/ch1/assign_fx4');
  for(const kind of ['main','sub','aux','fxbus','fxreturn']) assert.equal(mutePath(target(kind)),`${kind}/ch1/mute`);
  for(const input of [()=>target('group',9),()=>target('line',25),()=>target('auxsend',1,17),()=>target('__proto__'),()=>levelPath(target('group')),()=>parameterPacket('line/ch1/48v',true),()=>parameterPacket('line/ch1/volume',NaN),()=>levelRequest(target(),'set',-70,0),()=>levelRequest(target(),'set',0,Infinity)]) assert.throws(input);
  assert.equal(parameterKind('line/ch1/dca/volume'),undefined);
});
test('snapshot names/groups/faders and PV/PS/MS decode independently; DCA never overrides fader',()=>{
  const state=decodeState(syncState()); assert.equal(state.parameters!.get('line/ch1/username'),'Input 1'); assert.equal(state.parameters!.get('mutegroup/mutegroup1'),false);
  const custom=decodeState(deflateSync(ub({id:'Synchronize',children:{line:{children:{ch1:{values:{volume:0.5},children:{dca:{values:{volume:0.9}}}}}}}})));
  assert.equal(custom.parameters!.get('line/ch1/volume'),0.5);
  assert.deepEqual(decodeParameter('PV',parameterPacket('line/ch1/assign_aux1',false).subarray(12)),{path:'line/ch1/assign_aux1',value:false});
  assert.deepEqual(decodeParameter('PS',Buffer.from('line/ch1/username\0\0\0New\0')),{path:'line/ch1/username',value:'New'});
  const ms=Buffer.alloc(19); ms.write('fdrs'); ms.writeUInt16LE(2,6); ms.writeUInt16LE(32768,8); ms.writeUInt16LE(65535,10); ms[12]=1; ms.writeUInt16LE(0,13); ms.writeUInt16LE(0,15); ms.writeUInt16LE(2,17);
  const updates=decodeFaders(ms); assert.equal(updates[0].path,'line/ch1/volume'); assert.equal(updates[1].value,1); assert.throws(()=>decodeFaders(ms.subarray(0,17)));
});
test('all new mute targets confirm; Aux/FX assignments invert on/off/toggle',async t=>{
  const {service,mixer}=await setup(t);
  for(const kind of ['main','sub','aux','fxbus','fxreturn','group']) {await service.executeMute(target(kind),'on'); assert.equal(service.viewTarget(target(kind)).muted,true); await service.executeMute(target(kind),'off');}
  for(const kind of ['auxsend','fxsend']) {
    const t=target(kind); assert.equal(service.viewTarget(t).muted,false);
    await service.executeMute(t,'on'); assert.equal(mixer.parameterWrites.at(-1)!.value,false); assert.equal(service.viewTarget(t).muted,true);
    await service.executeMute(t,'toggle'); assert.equal(mixer.parameterWrites.at(-1)!.value,true);
  }
  const count=mixer.parameterWrites.length;
  await assert.rejects(service.executeMute(target('aux',16),'on')); assert.equal(mixer.parameterWrites.length,count);
});
test('names update on duplicate keys, custom label wins, disabling automatic names works',async t=>{
  const {service,mixer}=await setup(t), controller=new ButtonController(service); t.after(()=>controller.dispose());
  const images:string[]=[]; const sink:ButtonSink={async setTitle(){},async setImage(uri){images.push(Buffer.from(uri.split(',')[1],'base64').toString());},async showAlert(){}};
  controller.appear('a',sink,{channel:1}); await controller.flushed(); assert.match(images.at(-1)!,/<text data-role="heading"[^>]*>Input 1<\/text>/); assert.match(images.at(-1)!,/<text data-role="target"[^>]*>CHANNEL 1<\/text>/);
  mixer.externalParameter('line/ch1/username','<Vocal>'); await controller.flushed(); assert.match(images.at(-1)!,/&lt;Vocal&gt;/);
  controller.update('a',{channel:1,name:'Custom'}); await controller.flushed(); assert.match(images.at(-1)!,/<text data-role="heading"[^>]*>Custom<\/text>/);
  controller.update('a',{channel:1,autoName:false}); await controller.flushed(); assert.doesNotMatch(images.at(-1)!,/Vocal|Input/); assert.match(images.at(-1)!,/<text data-role="heading"[^>]*>CHANNEL 1<\/text>/);
});
test('fixed fades show inactive at the goal and restore direction on live changes/offline',async t=>{
  const {service,mixer}=await setup(t), controller=new ButtonController(service); t.after(()=>controller.dispose());
  let svg=''; const sink:ButtonSink={async setTitle(){},async setImage(uri){svg=Buffer.from(uri.split(',')[1],'base64').toString();},async showAlert(){}};
  const settings={channel:1,actionType:'level',operation:'set',db:0,duration:3};
  const label=()=>svg.match(/<text data-role="function"[^>]*>(.*?)<\/text>/)![1];
  const footer=()=>svg.match(/<text data-role="scope"[^>]*>(.*?)<\/text>/)![1];
  controller.appear('fade',sink,settings); await controller.flushed(); assert.equal(label(),'FADE UP');
  for(const [value,expected] of [[0,'FADE UP'],[1,'FADE DOWN'],[dbToLevel(0),'FADE --']] as const) {mixer.externalParameter('line/ch1/volume',value); await controller.flushed(); assert.equal(label(),expected); assert.equal(footer(),value===0?'−∞':`≈ ${levelToDb(value).toFixed(1)} dB`);}
  controller.update('fade',{...settings,db:-84}); await controller.flushed(); assert.equal(label(),'FADE DOWN');
  controller.update('fade',{...settings,operation:'step',db:-1}); await controller.flushed(); assert.equal(label(),'FADE DOWN');
  controller.update('fade',{...settings,operation:'step',db:1}); await controller.flushed(); assert.equal(label(),'FADE UP');
  const intermediate={...settings,db:-12,fadeLabel:'out'};
  controller.update('fade',intermediate); await controller.flushed(); assert.equal(label(),'FADE DOWN');
  mixer.externalParameter('line/ch1/volume',dbToLevel(-24));await controller.flushed();assert.equal(label(),'FADE UP');
  for(const value of [dbToLevel(-12),dbToLevel(-12)+2/65535,dbToLevel(-12)-2/65535]){mixer.externalParameter('line/ch1/volume',value);await controller.flushed();assert.equal(label(),'FADE --');}
  controller.appear('duplicate',sink,intermediate);await controller.flushed();assert.equal(label(),'FADE --');
  mixer.externalParameter('line/ch1/volume',dbToLevel(0));await controller.flushed();assert.equal(label(),'FADE DOWN');
  service.stop(); await controller.flushed(); assert.equal(label(),'FADE DOWN'); assert.equal(footer(),'OFFLINE');
  assert.equal(mixer.parameterWrites.length,0);
});

test('a completed fade lightens its current color, duplicates agree, and an already reached target sends no write',async t=>{
 const {service,mixer}=await setup(t),controller=new ButtonController(service);t.after(()=>controller.dispose());
 const images=new Map<string,string>();let alerts=0;
 const sink=(id:string):ButtonSink=>({async setTitle(){},async setImage(uri){images.set(id,Buffer.from(uri.split(',')[1],'base64').toString());},async showAlert(){alerts++;}});
 const settings={channel:1,actionType:'level',operation:'set',db:0,duration:0.12};
 controller.appear('a',sink('a'),settings);controller.appear('b',sink('b'),settings);
 await controller.press(settings,sink('a'));await controller.flushed();
 for(const svg of images.values()){assert.match(svg,/<rect[^>]*fill="#acb2b8"/);assert.match(svg,/<g fill="#303640"/);assert.match(svg,/>FADE --<\/text>/);}
 const count=mixer.parameterWrites.length;await controller.press(settings,sink('b'));await controller.flushed();assert.equal(mixer.parameterWrites.length,count);assert.equal(alerts,0);
 mixer.externalParameter('line/ch1/color','#ffff80');await controller.flushed();
 for(const svg of images.values()){
  assert.match(svg,/fill="#ffffd3"/);assert.match(svg,/>FADE --<\/text>/);
  assert.match(svg,/<text data-role="heading"[^>]*>Input 1<\/text>/);assert.match(svg,/>≈ 0\.0 dB<\/text>/);
 }
 mixer.external(1,true);await controller.flushed();assert.match(images.get('a')!,/fill="#e7b0b8"/);assert.match(images.get('a')!,/>MUTE<\/text>/);
 mixer.externalParameter('line/ch1/volume',dbToLevel(-6));await controller.flushed();
 for(const svg of images.values()){assert.match(svg,/>FADE UP<\/text>/);assert.match(svg,/fill="#b91c34"/);assert.doesNotMatch(svg,/fill="#e7b0b8"/);}
 mixer.external(1,false);await controller.flushed();for(const svg of images.values())assert.match(svg,/fill="#ffff80"/);
 service.stop();await controller.flushed();assert.doesNotMatch(images.get('a')!,/FADE --/);assert.match(images.get('a')!,/>OFFLINE<\/text>/);
});
test('fixed level and rapid dB steps derive from confirmed fader; bounds and floor',async t=>{
  const {service,mixer}=await setup(t);
  await service.executeLevel(request(0)); assert.equal(service.viewTarget(target(),true).level,0.74609375);
  assert.equal(mixer.parameterWrites.at(-1)!.value,0.74609375);
  await Promise.all([service.executeLevel(request(-1,0,'step')),service.executeLevel(request(-1,0,'step'))]);
  assert.ok(Math.abs(levelToDb(service.viewTarget(target(),true).level!)+2)<0.001);
  await service.executeLevel(request(10)); await service.executeLevel(request(12,0,'step')); assert.ok(service.viewTarget(target(),true).level!<=1);
  await service.executeLevel(request(-84)); assert.equal(service.viewTarget(target(),true).level,0);
  await service.executeLevel(request(1,0,'step')); assert.ok(Math.abs(levelToDb(service.viewTarget(target(),true).level!)+60)<0.001);
  assert.ok(mixer.parameterWrites.every(w=>typeof w.value==='number'&&w.value>=0&&w.value<=1));
});
test('fade has intermediate confirmed steps, exact final target and does not block mute',async t=>{
  const {service,mixer}=await setup(t);
  const fade=service.executeLevel(request(-24,220));
  await until(()=>mixer.parameterWrites.length>=1);
  assert.ok(service.viewTarget(target(),true).fading);
  await service.execute(2,'off'); assert.equal(service.view(2).muted,false); assert.ok(service.viewTarget(target(),true).fading);
  await fade; const values=mixer.parameterWrites.map(w=>w.value as number);
  assert.ok(values.length>=3); assert.ok(values.every((v,i)=>!i||v<=values[i-1])); assert.ok(Math.abs(values.at(-1)!-dbToLevel(-24))<1e-6);
  assert.equal(service.viewTarget(target(),true).pending,false);
});
test('second level command supersedes fade; explicit stop leaves last confirmed level',async t=>{
  const {service,mixer}=await setup(t);
  const first=service.executeLevel(request(-24,1000)).catch(error=>error); await until(()=>mixer.parameterWrites.length>0);
  await service.executeLevel(request(-6)); assert.ok(await first instanceof CommandCancelled);
  const count=mixer.parameterWrites.length; await pause(80); assert.equal(mixer.parameterWrites.length,count);
  const second=service.executeLevel(request(-30,1000)).catch(error=>error); await until(()=>mixer.parameterWrites.length>count);
  await service.executeLevel(request(0,0,'stop')); assert.ok(await second instanceof CommandCancelled);
  const stopped=mixer.parameterWrites.length; await pause(80); assert.equal(mixer.parameterWrites.length,stopped);
});
test('external fader override, disconnect and reconnect never resume old fade',async t=>{
  const {service,mixer,devices}=await setup(t);
  const first=service.executeLevel(request(-24,1000)).catch(error=>error); await until(()=>mixer.parameterWrites.length>0); await tick();
  mixer.externalParameter('line/ch1/volume',0.9); assert.ok(await first instanceof CommandCancelled);
  const count=mixer.parameterWrites.length; await pause(80); assert.equal(mixer.parameterWrites.length,count); assert.equal(service.viewTarget(target(),true).level,0.9);
  const second=service.executeLevel(request(-30,1000)).catch(error=>error); await until(()=>mixer.parameterWrites.length>count);
  mixer.disconnect(); await second; await until(()=>devices.length===2&&service.status==='online');
  await pause(80); assert.equal(devices[1].parameterWrites.length,0);
});
test('fader confirmation accepts quantized MS feedback; missing confirmation fails safely',async t=>{
  const {service,mixer,devices}=await setup(t); mixer.autoAck=false;
  const first=service.executeLevel(request(0)); const desired=mixer.parameterWrites.at(-1)!.value as number;
  assert.equal(service.viewTarget(target(),true).level,0.5); assert.ok(service.viewTarget(target(),true).pending);
  mixer.externalParameter('line/ch1/volume',Math.round(desired*65535)/65535); await first;
  await assert.rejects(service.executeLevel(request(-6,150)));
  await until(()=>devices.length===2&&service.status==='online'); assert.equal(devices[1].parameterWrites.length,0);
});
test('stop during an unconfirmed fade step does not send another value; next command waits for the echo',async t=>{
  const {service,mixer}=await setup(t); mixer.autoAck=false;
  const fade=service.executeLevel(request(-24,1000)).catch(error=>error);
  await until(()=>mixer.parameterWrites.length===1);
  const sent=mixer.parameterWrites[0].value as number;
  await service.executeLevel(request(0,0,'stop'));
  const next=service.executeLevel(request(-6));
  assert.equal(mixer.parameterWrites.length,1); assert.equal(service.viewTarget(target(),true).level,0.5);
  mixer.externalParameter('line/ch1/volume',sent); await until(()=>mixer.parameterWrites.length===2);
  mixer.externalParameter('line/ch1/volume',mixer.parameterWrites[1].value); await next;
  assert.ok(await fade instanceof CommandCancelled);
  await pause(60); assert.equal(mixer.parameterWrites.length,2);
});
test('extended adapter reads names, group and fader state; only explicit simulated writes produce PV',async t=>{
  const fixture=await tcpMixer(); t.after(()=>fixture.close());
  const transport=new StudioLiveTransport(500,fixture.port); t.after(()=>transport.close());
  const updates:any[]=[];
  const snapshot=await transport.open('127.0.0.1',{state(){},snapshot(){},disconnected(){},parameter:(path,value)=>updates.push({path,value})});
  assert.equal(snapshot.parameters!.get('line/ch1/username'),'Input 1'); assert.equal(fixture.controls.length,0);
  assert.equal(snapshot.parameters!.get('line/ch1/color'),'#112233');
  transport.setParameter('mutegroup/mutegroup1',true); transport.setParameter('line/ch1/volume',0.75);
  await until(()=>updates.length===2); assert.deepEqual(updates,[{path:'mutegroup/mutegroup1',value:true},{path:'line/ch1/volume',value:0.75}]);
  for(const socket of fixture.sockets) socket.write(packet('PS',Buffer.from('line/ch1/username\0\0\0Live\0')));
  await until(()=>updates.length===3); assert.equal(updates[2].value,'Live');
  for(const socket of fixture.sockets) socket.write(packet('PC',Buffer.concat([Buffer.from('line/ch1/color\0\0\0'),Buffer.from([255,220,50,255])])));
  await until(()=>updates.length===4);assert.deepEqual(updates[3],{path:'line/ch1/color',value:'#ffdc32'});
  assert.equal(fixture.controls.length,2);
});
