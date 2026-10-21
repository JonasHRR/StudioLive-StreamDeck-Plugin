import test from 'node:test';
import assert from 'node:assert/strict';
import { MixerService } from '../src/mixer-service.js';
import { ButtonController, type ButtonSink } from '../src/button-controller.js';
import { SimulatedMixer, tick, until } from './simulator.js';
const ip = '192.0.2.1';
const options = { ackMs: 40, backoffMs: 5, maxBackoffMs: 20, queueAgeMs: 500 };
function setup(t: test.TestContext) {
  const devices: SimulatedMixer[] = [];
  const service = new MixerService(() => { const dev = new SimulatedMixer(); devices.push(dev); return dev; }, options);
  t.after(() => service.stop()); service.configure(ip);
  return {service, devices};
}
test('on, off and toggle use confirmed values; external changes are authoritative', async t => {
  const {service, devices} = setup(t); await tick(); const dev = devices[0];
  await service.execute(1, 'on'); assert.equal(service.view(1).muted, true);
  await service.execute(1, 'on'); assert.equal(dev.writes.length, 1);
  await service.execute(1, 'off'); await service.execute(1, 'toggle');
  assert.deepEqual(dev.writes.map(w => w.muted), [true,false,true]);
  dev.external(1, false); assert.equal(service.view(1).muted, false);
});
test('fast toggles serialize globally and wait for each feedback', async t => {
  const {service, devices} = setup(t); await tick(); const dev = devices[0]; dev.autoAck = false;
  const first = service.execute(1, 'toggle'); const second = service.execute(1, 'toggle'); const third = service.execute(2, 'on');
  assert.equal(dev.writes.length, 1); assert.equal(service.view(1).muted, false); assert.equal(service.view(1).pending, true);
  dev.external(1, true); await first; await tick(); assert.equal(dev.writes[1].muted, false);
  dev.external(1, false); await second; await tick(); assert.equal(dev.writes[2].channel, 2);
  dev.external(2, true); await third; assert.equal(service.view(1).pending, false);
});
test('unknown startup state rejects every operation and waits for full snapshot', async t => {
  const dev = new SimulatedMixer(); dev.deferred = true;
  const service = new MixerService(() => dev, options); t.after(() => service.stop()); service.configure(ip);
  for (const op of ['toggle','on','off']) await assert.rejects(service.execute(1, op));
  assert.equal(service.view(1).status, 'connecting'); assert.equal(dev.writes.length, 0);
  dev.ready(); await tick(); assert.equal(service.view(1).muted, false);
});
test('disconnect during command discards pending and queued presses; reconnect reads actual state', async t => {
  const {service, devices} = setup(t); await tick(); const first = devices[0]; first.autoAck = false;
  const results = Promise.allSettled([service.execute(1, 'toggle'), service.execute(1, 'toggle'), service.execute(2,'on')]);
  first.disconnect(); assert.equal(service.view(1).muted, undefined);
  assert.deepEqual((await results).map(r => r.status), ['rejected','rejected','rejected']);
  await assert.rejects(service.execute(3, 'on'));
  await until(() => devices.length === 2 && service.status === 'online');
  assert.equal(devices[1].writes.length, 0);
  first.external(1,true); assert.equal(service.view(1).muted, false);
  await service.execute(1,'toggle'); assert.equal(devices[1].writes.length, 1);
});
test('timeout is uncertain: no blind retry, queue discarded, fresh connection', async t => {
  const {service, devices} = setup(t); await tick(); devices[0].autoAck = false;
  const results = await Promise.allSettled([service.execute(1,'toggle'), service.execute(2,'on')]);
  assert.ok(results.every(r => r.status === 'rejected'));
  await until(() => devices.length >= 2 && service.status === 'online');
  assert.equal(devices[0].writes.length, 1); assert.equal(devices[1].writes.length, 0);
});
test('invalid IP/channel/mode cause no network writes; reconfiguration removes old connection', async t => {
  const {service, devices} = setup(t); await tick();
  for (const channel of [0,25,-1,NaN,1.5,'abc',null]) await assert.rejects(service.execute(channel,'on'));
  await assert.rejects(service.execute(1,'invalid'));
  for (const invalid of ['bad','256.1.1.1','224.0.0.1','0.0.0.0','01.2.3.4']) {
    service.configure(invalid); assert.equal(service.status, 'invalid');
  }
  assert.equal(devices.length, 1); assert.equal(devices[0].writes.length, 0); assert.ok(devices[0].closed);
  service.configure('192.0.2.2'); await tick(); assert.equal(devices.length, 2);
  service.configure('192.0.2.2'); assert.equal(devices.length, 2);
});
class Sink implements ButtonSink {
  images: string[] = []; alerts = 0;
  async setImage(image: string) { assert.ok(image.startsWith('data:image/svg+xml;base64,')); this.images.push(Buffer.from(image.split(',')[1],'base64').toString()); }
  async setTitle(_title: string) {}
  async showAlert() { this.alerts++; }
}
test('duplicate keys synchronize; folder/profile change and restart restore state', async t => {
  const {service, devices} = setup(t); await tick();
  const controller = new ButtonController(service); t.after(() => controller.dispose());
  const a = new Sink(), b = new Sink();
  controller.appear('a',a,{channel:4}); controller.appear('b',b,{channel:4}); await controller.flushed();
  devices[0].external(4,true); await controller.flushed();
  assert.match(a.images.at(-1)!, />MUTE</); assert.equal(a.images.at(-1), b.images.at(-1));
  controller.disappear('a'); const n = a.images.length;
  devices[0].external(4,false); await controller.flushed(); assert.equal(a.images.length,n);
  controller.appear('a',a,{channel:4,name:'<Vocal>'}); await controller.flushed(); assert.match(a.images.at(-1)!, />OPEN</);
  assert.match(a.images.at(-1)!, /&lt;Vocal&gt;/);
  controller.update('a',{channel:99}); await controller.flushed(); assert.match(a.images.at(-1)!, /SETTINGS/);
  service.stop(); service.configure(ip); await tick(); await controller.flushed(); assert.match(b.images.at(-1)!, />OPEN</);
  assert.equal(service.listenerCount('change'),1);
});
test('explicit Multi-Action on/off commands use event settings and stay deterministic', async t => {
  const {service, devices} = setup(t); await tick(); const controller = new ButtonController(service); t.after(() => controller.dispose());
  const sink = new Sink();
  await controller.press({channel:24,mode:'on'},sink); await controller.press({channel:24,mode:'on'},sink);
  await controller.press({channel:24,mode:'off'},sink); await controller.press({channel:24,mode:'off'},sink);
  assert.deepEqual(devices[0].writes, [{channel:24,muted:true},{channel:24,muted:false}]);
  service.stop(); await controller.press({channel:24,mode:'on'},sink); assert.equal(sink.alerts,1);
});
test('wrong-channel or mismatching feedback does not confirm pending write', async t => {
  const {service, devices} = setup(t); await tick(); const dev = devices[0]; dev.autoAck = false;
  const request = service.execute(1,'on'); dev.external(2,true); dev.external(1,false);
  assert.equal(service.view(1).pending,true); dev.external(1,true); await request; assert.equal(service.view(1).pending,false);
});
