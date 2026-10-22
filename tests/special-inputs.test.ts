import test from 'node:test';
import assert from 'node:assert/strict';
import { basePath, target, targetLabel, targetScope, mutePath, levelPath, levelRequest, parameterKind, dbToLevel } from '../src/controls.js';
import { decodeState, decodeParameter, decodeFaders, parameterPacket, packet } from '../src/protocol.js';
import { MixerService } from '../src/mixer-service.js';
import { StudioLiveTransport } from '../src/studiolive.js';
import { ButtonController, type ButtonSink } from '../src/button-controller.js';
import { syncState, tcpMixer } from './protocol-fixture.js';
import { SimulatedMixer, tick, until } from './simulator.js';

const inputs=[
 {target:target('auxinput',1),base:'return/ch1',label:'A1',name:'Aux In 1'},
 {target:target('auxinput',2),base:'return/ch2',label:'A2',name:'Aux In 2'},
 {target:target('tape'),base:'return/ch3',label:'TAPE',name:'Tape In'},
 {target:target('talkback'),base:'talkback/ch1',label:'TALKBACK',name:'Talkback'}
];
async function setup(t:test.TestContext,missing=false) {
 const mixer=new SimulatedMixer();mixer.values=decodeState(syncState());
 if(missing)for(const path of mixer.values.parameters!.keys())if(/^(return|talkback)\//.test(path))mixer.values.parameters!.delete(path);
 const service=new MixerService(()=>mixer);t.after(()=>service.stop());service.configure('192.0.2.1');await tick();
 return {service,mixer};
}

test('special input identifiers map only to the verified return/talkback paths',()=>{
 for(const input of inputs){
  assert.equal(basePath(input.target),input.base);assert.equal(mutePath(input.target),`${input.base}/mute`);assert.equal(levelPath(input.target),`${input.base}/volume`);
  assert.equal(targetLabel(input.target),input.label);assert.equal(targetScope(input.target),'INPUT');
  assert.equal(parameterKind(`${input.base}/username`),'string');assert.equal(parameterKind(`${input.base}/color`),'color');
  for(const field of ['48v','phantom','gain','preampgain','assign_aux1','assign_fx1','talk']){
   assert.equal(parameterKind(`${input.base}/${field}`),undefined);assert.throws(()=>parameterPacket(`${input.base}/${field}`,1));
  }
  for(const field of ['username','name','color'])assert.throws(()=>parameterPacket(`${input.base}/${field}`,1));
 }
 for(const [kind,channel] of [['auxinput',0],['auxinput',3],['tape',2],['talkback',2],['return',1]] as const)assert.throws(()=>target(kind,channel));
 for(const path of ['return/ch4/mute','return/ch0/volume','talkback/ch2/mute','tape/ch1/mute','auxinput/ch1/volume']){
  assert.equal(parameterKind(path),undefined);assert.throws(()=>parameterPacket(path,1));
 }
 assert.equal(mutePath(target('aux',2)),'aux/ch2/mute');assert.equal(mutePath(target('line',64)),'line/ch64/mute');
});

test('special input snapshots and PV/PS/PC/MS feedback retain names, colors and independent faders',()=>{
 const state=decodeState(syncState());assert.equal(state.inputCount,24);assert.equal(state.size,24);
 for(const input of inputs){
  assert.equal(state.parameters!.get(`${input.base}/name`),input.name);assert.equal(state.parameters!.get(`${input.base}/volume`),0.5);
  assert.equal(state.parameters!.get(`${input.base}/color`),'#112233');assert.equal(state.parameters!.get(`${input.base}/mute`),input.target.kind==='talkback');
  assert.deepEqual(decodeParameter('PV',parameterPacket(`${input.base}/mute`,true).subarray(12)),{path:`${input.base}/mute`,value:true});
  assert.deepEqual(decodeParameter('PV',parameterPacket(`${input.base}/volume`,0.25).subarray(12)),{path:`${input.base}/volume`,value:0.25});
  assert.deepEqual(decodeParameter('PS',Buffer.from(`${input.base}/username\0\0\0Renamed\0`)),{path:`${input.base}/username`,value:'Renamed'});
  assert.deepEqual(decodeParameter('PC',Buffer.concat([Buffer.from(`${input.base}/color\0\0\0`),Buffer.from([51,102,153,255])])),{path:`${input.base}/color`,value:'#336699'});
 }
 // Include out-of-range return 4 and talkback 2: these must not enter state.
 const ms=Buffer.alloc(33);ms.write('fdrs');ms.writeUInt16LE(6,6);
 for(let i=0;i<6;i++)ms.writeUInt16LE(1000+i*1000,8+i*2);
 ms[20]=2;ms.writeUInt16LE(1,21);ms.writeUInt16LE(0,23);ms.writeUInt16LE(4,25);ms.writeUInt16LE(3,27);ms.writeUInt16LE(4,29);ms.writeUInt16LE(2,31);
 assert.deepEqual(decodeFaders(ms),inputs.map((input,i)=>({path:`${input.base}/volume`,value:(i===3?5000:1000+i*1000)/65535})));
});

test('all four special inputs confirm mute, level, relative and toggle fade operations in simulation',async t=>{
 const {service,mixer}=await setup(t);
 assert.deepEqual(service.targetNames().auxinput,['Aux In 1','Aux In 2']);assert.deepEqual(service.targetNames().tape,['Tape In']);assert.deepEqual(service.targetNames().talkback,['Talkback']);
 for(const input of inputs){
  await service.executeMute(input.target,'on');assert.equal(service.viewTarget(input.target).muted,true);
  await service.executeMute(input.target,'off');assert.equal(service.viewTarget(input.target).muted,false);
  await service.executeMute(input.target,'toggle');assert.equal(service.viewTarget(input.target).muted,true);
  await service.executeLevel(levelRequest(input.target,'set',0,0));assert.equal(service.viewTarget(input.target,true).level,191/256);
  await service.executeLevel(levelRequest(input.target,'step',-6,0));assert.ok(Math.abs(service.viewTarget(input.target,true).level!-dbToLevel(-6))<1e-6);
  const before=mixer.parameterWrites.length;
  await service.executeLevel(levelRequest(input.target,'toggle',0,120));assert.equal(service.viewTarget(input.target,true).level,0);
  assert.ok(mixer.parameterWrites.length>before+1);
  await service.executeLevel(levelRequest(input.target,'toggle',0,120));assert.equal(service.viewTarget(input.target,true).level,191/256);
  assert.equal(service.viewTarget(input.target).muted,true);
 }
 assert.ok(mixer.parameterWrites.every(write=>inputs.some(input=>write.path===`${input.base}/mute`||write.path===`${input.base}/volume`)));
 assert.equal(mixer.writes.length,0);assert.equal(service.view(1).muted,false);assert.equal(service.viewTarget(target('aux')).muted,false);
});

test('special input buttons synchronize names, colors and state while retaining separate custom colors',async t=>{
 const {service,mixer}=await setup(t),controller=new ButtonController(service);t.after(()=>controller.dispose());
 const images=new Map<string,string>();
 const sink=(id:string):ButtonSink=>({async setTitle(){},async setImage(uri){images.set(id,Buffer.from(uri.split(',')[1],'base64').toString());},async showAlert(){assert.fail('Unexpected alert');}});
 for(const [i,input] of inputs.entries()){
  const settings={target:input.target.kind,channel:input.target.channel};
  controller.appear(`${i}a`,sink(`${i}a`),settings);controller.appear(`${i}b`,sink(`${i}b`),settings);
  mixer.externalParameter(`${input.base}/mute`,false);mixer.externalParameter(`${input.base}/username`,`Source ${i}`);mixer.externalParameter(`${input.base}/color`,'#336699');
 }
 await controller.flushed();
 for(const [i,input] of inputs.entries()){
  assert.equal(images.get(`${i}a`),images.get(`${i}b`));assert.match(images.get(`${i}a`)!,new RegExp(`>Source ${i}</text>`));
  assert.match(images.get(`${i}a`)!,new RegExp(`>${input.label}</text>`));assert.match(images.get(`${i}a`)!,/fill="#336699"/);
 }
 controller.update('0b',{target:'auxinput',channel:1,colorMode:'custom',customColor:'#123456'});await controller.flushed();assert.match(images.get('0b')!,/fill="#123456"/);
 mixer.externalParameter('return/ch1/mute',true);await controller.flushed();for(const id of ['0a','0b'])assert.match(images.get(id)!,/>MUTE<\/text>/);
 mixer.externalParameter('return/ch1/username','');assert.equal(service.targetNames().auxinput[0],'Aux In 1');
 assert.equal(mixer.parameterWrites.length,0);
});

test('missing optional special inputs do not prevent connection and reject commands without writes',async t=>{
 const {service,mixer}=await setup(t,true);assert.equal(service.status,'online');
 for(const input of inputs){
  assert.equal(service.viewTarget(input.target).available,false);assert.equal(service.viewTarget(input.target,true).available,false);
  await assert.rejects(service.executeMute(input.target,'toggle'));await assert.rejects(service.executeLevel(levelRequest(input.target,'toggle',0,120)));
 }
 assert.deepEqual(service.targetNames().auxinput,['','']);assert.equal(mixer.parameterWrites.length,0);assert.equal(mixer.writes.length,0);
});

test('TCP transport confirms special input writes and accepts live metadata and batch faders',async t=>{
 const fixture=await tcpMixer();t.after(()=>fixture.close());
 const service=new MixerService(()=>new StudioLiveTransport(300,fixture.port));t.after(()=>service.stop());
 service.configure('127.0.0.1');await until(()=>service.status==='online');
 for(const input of inputs){
  await service.executeMute(input.target,'off');await service.executeMute(input.target,'on');
  await service.executeLevel(levelRequest(input.target,'set',0,0));
  assert.equal(service.viewTarget(input.target).muted,true);assert.equal(service.viewTarget(input.target,true).level,191/256);
  assert.ok(fixture.controls.some(bytes=>bytes.subarray(0,bytes.indexOf(0)).toString()===`${input.base}/mute`));
  for(const socket of fixture.sockets)socket.write(packet('PS',Buffer.from(`${input.base}/username\0\0\0Live source\0`)));
  await until(()=>service.viewTarget(input.target).name==='Live source');
 }
 const ms=Buffer.alloc(29);ms.write('fdrs');ms.writeUInt16LE(4,6);[10000,20000,30000,40000].forEach((value,i)=>ms.writeUInt16LE(value,8+i*2));
 ms[16]=2;ms.writeUInt16LE(1,17);ms.writeUInt16LE(0,19);ms.writeUInt16LE(3,21);ms.writeUInt16LE(3,23);ms.writeUInt16LE(3,25);ms.writeUInt16LE(1,27);
 for(const socket of fixture.sockets)socket.write(packet('MS',ms));
 await until(()=>inputs.every((input,i)=>service.viewTarget(input.target,true).level===(i+1)*10000/65535));
});
