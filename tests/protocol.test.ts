import test from 'node:test';
import assert from 'node:assert/strict';
import { Framer, decodeState, decodeMute, mutePacket, packet } from '../src/protocol.js';
import { decodeUBJSON } from '../src/ubjson.js';
import { StudioLiveTransport } from '../src/studiolive.js';
import { tcpMixer, syncState } from './protocol-fixture.js';
import { until } from './simulator.js';

test('wire encoding: main channel mute is PV float 1/0 with exact path', () => {
  assert.deepEqual(mutePacket(24,true).subarray(12), Buffer.concat([Buffer.from('line/ch24/mute\0\0\0'),Buffer.from([0,0,128,63])]));
  assert.deepEqual(decodeMute(mutePacket(24,false).subarray(12)),{channel:24,muted:false});
  assert.equal(decodeMute(Buffer.from('line/ch1/assign_aux1\0\0\0abcd')),undefined);
});
test('framing accepts every byte boundary and coalesced packets; bad headers fail', () => {
  const frames = new Framer(); const codes:string[]=[];
  const bytes = Buffer.concat([packet('KA'),mutePacket(2,true)]);
  for (const byte of bytes) frames.feed(Buffer.from([byte]),code=>codes.push(code));
  assert.deepEqual(codes,['KA','PV']);
  assert.throws(()=>new Framer().feed(Buffer.alloc(12),()=>{}));
  assert.throws(()=>decodeUBJSON(Buffer.from('{i\x05a')));
  assert.throws(()=>decodeUBJSON(Buffer.from('{i\x01aSiz')));
});
test('snapshot decoding requires Synchronize and extracts 24 distinct channel mutes', () => {
  const states = decodeState(syncState(24)); assert.equal(states.size,24); assert.equal(states.get(24),true); assert.equal(states.get(1),false);
});
for (const chunked of [false,true]) test(`real TCP adapter against simulated mixer (${chunked?'CK chunks':'ZB state'})`, async t => {
  const fixture = await tcpMixer({chunked}); t.after(()=>fixture.close());
  const transport = new StudioLiveTransport(500,fixture.port); t.after(()=>transport.close());
  const events: {channel:number;muted:boolean}[]=[];
  const state = await transport.open('127.0.0.1',{state:(channel,muted)=>events.push({channel,muted}),snapshot(){},disconnected(){}});
  assert.equal(state.get(2),true); assert.equal(state.get(1),false);
  assert.equal(fixture.controls.length,0); // read-only until explicit test instruction below (simulator only)
  transport.setMute(1,true); await until(()=>events.length===1);
  assert.deepEqual(events[0],{channel:1,muted:true});
  fixture.external(24,true); await until(()=>events.length===2); assert.equal(events[1].channel,24);
  assert.equal(fixture.controls.length,1);
});
test('silent handshake is bounded and close removes live sockets', async t => {
  const fixture = await tcpMixer({silence:true}); t.after(()=>fixture.close());
  const transport = new StudioLiveTransport(30,fixture.port); t.after(()=>transport.close());
  await assert.rejects(transport.open('127.0.0.1',{state(){},snapshot(){},disconnected(){}}));
  await until(()=>fixture.sockets.size===0);
  assert.equal(fixture.controls.length,0);
});
test('keepalive reaches simulator and clean close prevents reconnect', async t => {
  const fixture=await tcpMixer(); t.after(()=>fixture.close());
  const transport=new StudioLiveTransport(500,fixture.port); t.after(()=>transport.close());
  await transport.open('127.0.0.1',{state(){},snapshot(){},disconnected(){}});
  await until(()=>fixture.writes.some(b=>b.toString('ascii',6,8)==='FR'),1500);
  transport.close(); await until(()=>fixture.sockets.size===0);
  assert.equal(fixture.controls.length,0);
});
