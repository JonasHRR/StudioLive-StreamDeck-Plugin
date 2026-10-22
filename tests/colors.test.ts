import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {channelColor,decodeParameter,decodeState,parameterPacket} from '../src/protocol.js';
import {target,dbToLevel} from '../src/controls.js';
import {MixerService} from '../src/mixer-service.js';
import {ButtonController,type ButtonSink} from '../src/button-controller.js';
import {keySvg} from '../src/presentation.js';
import {SimulatedMixer,tick} from './simulator.js';
import {syncState,ub} from './protocol-fixture.js';

test('snapshot RGBA colors decode low little-endian bytes; absent, invalid and transparent values fall back',()=>{
  const state=decodeState(syncState());
  assert.equal(state.parameters!.get('line/ch1/color'),'#112233');
  assert.equal(state.parameters!.get('aux/ch1/color'),'#ffdd88');
  assert.equal(channelColor(0xff332211n),'#112233');
  assert.equal(channelColor(-13426159),'#112233');
  assert.equal(channelColor(0xff000000n),'#000000');
  assert.equal(channelColor(0),'');
  assert.equal(channelColor(0x00332211n),'');
  for(const invalid of [NaN,Infinity,1.5,'<svg/>',Buffer.alloc(3),4294967296])assert.equal(channelColor(invalid),undefined);
  const snapshot=decodeState(deflateSync(ub({id:'Synchronize',children:{line:{children:{ch1:{values:{color:'invalid',mute:0}}}}}})));
  assert.equal(snapshot.parameters!.get('line/ch1/color'),undefined);assert.equal(snapshot.get(1),false);
});

test('per-button custom colors override mixer colors, tint inactive fades and preserve mute/offline feedback',async t=>{
 const mixer=new SimulatedMixer();mixer.values=decodeState(syncState());
 const service=new MixerService(()=>mixer);t.after(()=>service.stop());service.configure('192.0.2.1');await tick();
 const controller=new ButtonController(service);t.after(()=>controller.dispose());const images=new Map<string,string>();
 const sink=(id:string):ButtonSink=>({async setTitle(){},async setImage(uri){images.set(id,Buffer.from(uri.split(',')[1],'base64').toString());},async showAlert(){}});
 const settings={channel:1,colorMode:'custom',customColor:'#336699'};
 controller.appear('custom',sink('custom'),settings);controller.appear('automatic',sink('automatic'),{channel:1});
 controller.appear('level',sink('level'),{...settings,actionType:'level',operation:'set',db:0,duration:3});await controller.flushed();
 for(const id of ['custom','level'])assert.match(images.get(id)!,/fill="#336699"/);assert.match(images.get('automatic')!,/fill="#112233"/);
 mixer.externalParameter('line/ch1/color','#00ffff');await controller.flushed();assert.match(images.get('automatic')!,/fill="#00ffff"/);assert.match(images.get('custom')!,/fill="#336699"/);
 mixer.externalParameter('line/ch1/volume',dbToLevel(0));await controller.flushed();assert.match(images.get('level')!,/fill="#b8c9db"/);assert.match(images.get('level')!,/>FADE --<\/text>/);
 mixer.external(1,true);await controller.flushed();assert.match(images.get('custom')!,/fill="#b91c34"/);assert.match(images.get('level')!,/fill="#e7b0b8"/);
 mixer.external(1,false);await controller.flushed();assert.match(images.get('custom')!,/fill="#336699"/);assert.match(images.get('level')!,/fill="#b8c9db"/);
 controller.update('custom',{...settings,colorMode:'auto'});await controller.flushed();assert.match(images.get('custom')!,/fill="#00ffff"/);
 controller.update('custom',{...settings,customColor:'" onload="bad'});await controller.flushed();assert.match(images.get('custom')!,/fill="#00ffff"/);assert.doesNotMatch(images.get('custom')!,/onload/);
 controller.update('custom',{...settings,customColor:'#ffffff'});await controller.flushed();assert.match(images.get('custom')!,/<g fill="#111827"/);
 service.stop();await controller.flushed();for(const svg of images.values())assert.match(svg,/fill="#454b54"/);
 assert.equal(mixer.parameterWrites.length,0);assert.equal(mixer.writes.length,0);
});

test('live PC colors are read-only, bounded and do not accept PV/PS or unsupported paths',()=>{
  const message=(path:string,bytes:Buffer)=>Buffer.concat([Buffer.from(`${path}\0\0\0`),bytes]);
  const bytes=Buffer.from([0x12,0xab,0xcd,0xff]);
  assert.deepEqual(decodeParameter('PC',message('line/ch1/color',bytes)),{path:'line/ch1/color',value:'#12abcd'});
  assert.deepEqual(decodeParameter('PC',message('line.ch1.color',Buffer.alloc(4))),{path:'line/ch1/color',value:''});
  for(const code of ['PV','PS'])assert.equal(decodeParameter(code,message('line/ch1/color',bytes)),undefined);
  for(const path of ['line/ch65/color','line/ch1/dca/color','mutegroup/mutegroup1/color','line/ch1/48v'])assert.equal(decodeParameter('PC',message(path,bytes)),undefined);
  for(const n of [0,3,5])assert.equal(decodeParameter('PC',message('line/ch1/color',Buffer.alloc(n))),undefined);
  assert.throws(()=>parameterPacket('line/ch1/color',0));assert.throws(()=>parameterPacket('aux/ch1/color',true));
});

test('channel backgrounds track confirmed colors on duplicate and level keys; mute/offline override and no color writes occur',async t=>{
  const mixer=new SimulatedMixer();mixer.values=decodeState(syncState());
  const service=new MixerService(()=>mixer);t.after(()=>service.stop());service.configure('192.0.2.1');await tick();
  const controller=new ButtonController(service);t.after(()=>controller.dispose());
  const images=new Map<string,string>();
  const sink=(id:string):ButtonSink=>({async setTitle(){},async setImage(uri){images.set(id,Buffer.from(uri.split(',')[1],'base64').toString());},async showAlert(){}});
  controller.appear('a',sink('a'),{channel:1});controller.appear('b',sink('b'),{channel:1});
  controller.appear('fade',sink('fade'),{channel:1,actionType:'level',operation:'set',db:0,duration:3});
  await controller.flushed();
  const assertBackground=(color:string)=>{for(const id of ['a','b','fade'])assert.match(images.get(id)!,new RegExp(`<rect[^>]*fill="${color}"`));};
  assertBackground('#112233');assert.match(images.get('a')!,/<g fill="#ffffff"/);
  mixer.externalParameter('line/ch1/color','#ffff80');await controller.flushed();assertBackground('#ffff80');assert.match(images.get('fade')!,/<g fill="#111827"/);
  mixer.external(1,true);await controller.flushed();assertBackground('#b91c34');assert.match(images.get('fade')!,/>MUTE<\/text>/);assert.match(images.get('fade')!,/>FADE UP<\/text>/);
  mixer.externalParameter('line/ch1/color','#00ffff');await controller.flushed();assertBackground('#b91c34');
  mixer.external(1,false);await controller.flushed();assertBackground('#00ffff');
  mixer.externalParameter('line/ch1/color','');await controller.flushed();assert.match(images.get('a')!,/fill="#06685c"/);assert.match(images.get('fade')!,/fill="#174e89"/);
  const unknown=keySvg(1,'',{status:'online',pending:false,reason:'',color:'#ffff80'});assert.match(unknown,/fill="#454b54"/);assert.match(unknown,/>UNKNOWN<\/text>/);
  const invalid=keySvg(1,'',{status:'online',muted:false,pending:false,reason:'',color:'" onload="bad'});assert.match(invalid,/fill="#06685c"/);assert.doesNotMatch(invalid,/onload/);
  service.stop();await controller.flushed();assertBackground('#454b54');assert.equal(service.viewTarget(target()).color,undefined);
  assert.equal(mixer.writes.length,0);assert.equal(mixer.parameterWrites.length,0);
});
