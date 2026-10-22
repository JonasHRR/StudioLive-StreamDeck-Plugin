import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {channelNumber,copySnapshot,hasCompleteInputState} from '../src/types.js';
import {target,levelRequest,parameterKind} from '../src/controls.js';
import {decodeState,decodeMute,decodeParameter,decodeFaders,mutePacket,parameterPacket,packet} from '../src/protocol.js';
import {MixerService} from '../src/mixer-service.js';
import {ButtonController,type ButtonSink} from '../src/button-controller.js';
import {StudioLiveTransport} from '../src/studiolive.js';
import {syncState,tcpMixer,ub} from './protocol-fixture.js';
import {SimulatedMixer,tick,until} from './simulator.js';

test('input paths and feedback support 1–64 and reject 65 without widening unrelated controls',()=>{
 for(const channel of [1,24,25,32,33,64]){
  assert.equal(channelNumber(String(channel)),channel);assert.equal(target('line',channel).channel,channel);
  const path=`line/ch${channel}`;assert.equal(parameterKind(`${path}/volume`),'number');assert.equal(parameterKind(`${path}/color`),'color');
  assert.deepEqual(decodeMute(mutePacket(channel,true).subarray(12)),{channel,muted:true});
  assert.deepEqual(decodeParameter('PV',parameterPacket(`${path}/volume`,0.5).subarray(12)),{path:`${path}/volume`,value:0.5});
  assert.equal(parameterKind(`${path}/assign_aux16`),'boolean');assert.equal(parameterKind(`${path}/assign_fx4`),'boolean');
 }
 for(const invalid of [0,65,100,NaN,1.5]){assert.throws(()=>channelNumber(invalid));assert.throws(()=>target('line',invalid));}
 for(const path of ['line/ch65/mute','line/ch65/color','line/ch64/48v','line/ch64/assign_aux17','line/ch64/assign_fx5'])assert.equal(parameterKind(path),undefined);
 assert.throws(()=>parameterPacket('line/ch65/volume',0));assert.throws(()=>target('aux',17));
});

test('snapshot completeness uses the declared bank, accepts smaller mixers and rejects holes or missing last mutes',()=>{
 for(const count of [16,24,32,64]){
  const state=decodeState(syncState(count,count));assert.equal(state.size,count);assert.equal(state.inputCount,count);assert.ok(hasCompleteInputState(state));
  assert.equal(copySnapshot(state).inputCount,count);assert.equal(state.get(count),true);
  const children=Object.fromEntries(Array.from({length:count},(_,index)=>[`ch${index+1}`,{values:index===count-1?{volume:0.5}:{mute:0}}]));
  const incomplete=decodeState(deflateSync(ub({id:'Synchronize',children:{line:{children}}})));
  assert.equal(incomplete.inputCount,count);assert.equal(incomplete.size,count-1);assert.equal(hasCompleteInputState(incomplete),false);
 }
 const state=decodeState(syncState(2,64));state.delete(33);assert.equal(hasCompleteInputState(state),false);
 assert.equal(hasCompleteInputState(new Map([[1,false]])),false);
});

test('64-channel fader batches and high-channel names/colors retain exact channel indices',()=>{
 const data=Buffer.alloc(8+64*2+1+6);data.write('fdrs');data.writeUInt16LE(64,6);data.writeUInt16LE(65535,8+63*2);
 const group=8+64*2;data[group]=1;data.writeUInt16LE(0,group+1);data.writeUInt16LE(0,group+3);data.writeUInt16LE(64,group+5);
 const updates=decodeFaders(data);assert.equal(updates.length,64);assert.deepEqual(updates.at(-1),{path:'line/ch64/volume',value:1});
 assert.deepEqual(decodeParameter('PS',Buffer.from('line/ch64/username\0\0\0High input\0')),{path:'line/ch64/username',value:'High input'});
 assert.deepEqual(decodeParameter('PC',Buffer.concat([Buffer.from('line/ch32/color\0\0\0'),Buffer.from([17,34,51,255])])),{path:'line/ch32/color',value:'#112233'});
});

test('model-size service startup, duplicate high keys and unavailable inputs remain authoritative',async t=>{
 for(const count of [16,24,32,64]){
  const mixer=new SimulatedMixer();mixer.values=decodeState(syncState(2,count));
  const service=new MixerService(()=>mixer);t.after(()=>service.stop());service.configure('192.0.2.1');await tick();assert.equal(service.status,'online');
  const controller=new ButtonController(service);t.after(()=>controller.dispose());const images=new Map<string,string>();
  const sink=(id:string):ButtonSink=>({async setTitle(){},async setImage(uri){images.set(id,Buffer.from(uri.split(',')[1],'base64').toString());},async showAlert(){}});
  controller.appear('a',sink('a'),{channel:count});controller.appear('b',sink('b'),{channel:count});await controller.flushed();
  assert.equal(service.targetNames().line[count-1],`Input ${count}`);
  await service.execute(count,'on');await controller.flushed();assert.equal(mixer.writes.at(-1)!.channel,count);assert.equal(images.get('a'),images.get('b'));assert.match(images.get('a')!,/>MUTE<\/text>/);
  await service.executeLevel(levelRequest(target('line',count),'set',0,0));assert.equal(mixer.parameterWrites.at(-1)!.path,`line/ch${count}/volume`);
  if(count<64){
   controller.appear('missing',sink('missing'),{channel:count+1});await controller.flushed();assert.match(images.get('missing')!,/>UNKNOWN<\/text>/);assert.doesNotMatch(images.get('missing')!,/>SETTINGS<\/text>/);
   const writes=mixer.writes.length;await assert.rejects(service.execute(count+1,'toggle'));assert.equal(mixer.writes.length,writes);
   await assert.rejects(service.executeLevel(levelRequest(target('line',count+1),'set',0,0)));
  }
  service.stop();
 }
 const incomplete=new SimulatedMixer();incomplete.values=decodeState(syncState(2,32));incomplete.values.delete(32);
 const service=new MixerService(()=>incomplete);t.after(()=>service.stop());service.configure('192.0.2.1');await tick();assert.equal(service.status,'offline');assert.equal(incomplete.writes.length,0);
});

for(const count of [32,64])test(`real TCP transport confirms high-channel mutes/levels and reconnects a ${count}-input simulator without replay`,async t=>{
 const fixture=await tcpMixer({channels:count});t.after(()=>fixture.close());
 const service=new MixerService(()=>new StudioLiveTransport(500,fixture.port),{ackMs:200,backoffMs:5,maxBackoffMs:20,queueAgeMs:500});t.after(()=>service.stop());
 service.configure('127.0.0.1');await until(()=>service.status==='online');assert.equal(service.targetNames().line[count-1],`Input ${count}`);
 await service.execute(count,'on');assert.equal(service.view(count).muted,true);
 await service.executeLevel(levelRequest(target('line',count),'set',0,0));assert.equal(service.viewTarget(target('line',count),true).level,0.74609375);
 const paths=fixture.controls.map(payload=>payload.subarray(0,payload.indexOf(0)).toString());assert.deepEqual(paths,[`line/ch${count}/mute`,`line/ch${count}/volume`]);
 for(const socket of fixture.sockets)socket.write(packet('PS',Buffer.from(`line/ch${count}/username\0\0\0Last input\0`)));
 await until(()=>service.targetNames().line[count-1]==='Last input');
 fixture.external(count,false);await until(()=>service.view(count).muted===false);
 for(const socket of fixture.sockets)socket.destroy();await until(()=>service.status!=='online');await until(()=>service.status==='online');assert.equal(fixture.controls.length,2);
});
