import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MixerSettings,type MixerSettingsHost} from '../src/mixer-settings.js';
import {FileMixerAddressStore,mixerAddressFile} from '../src/mixer-address-store.js';

test('Windows mixer address retains LOCALAPPDATA and the existing home fallback',()=>{
 assert.equal(mixerAddressFile('win32','C:\\TestHome',{LOCALAPPDATA:'D:\\LocalData'}),'D:\\LocalData\\StudioLive-StreamDeck-Plugin\\mixer-settings.json');
 assert.equal(mixerAddressFile('win32','C:\\TestHome',{}),'C:\\TestHome\\AppData\\Local\\StudioLive-StreamDeck-Plugin\\mixer-settings.json');
});
test('macOS mixer address uses Application Support regardless of LOCALAPPDATA',()=>{
 assert.equal(mixerAddressFile('darwin','/Users/Test Person',{LOCALAPPDATA:'D:\\LocalData'}),'/Users/Test Person/Library/Application Support/StudioLive-StreamDeck-Plugin/mixer-settings.json');
 assert.equal(mixerAddressFile('darwin','/Users/Jörg',{}),'/Users/Jörg/Library/Application Support/StudioLive-StreamDeck-Plugin/mixer-settings.json');
});
test('macOS-style settings path creates directories, replaces a saved address and survives restart',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'studiolive-mac-settings-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const path=join(directory,'Test Person','Library','Application Support','StudioLive-StreamDeck-Plugin','mixer-settings.json');
 const disk=new FileMixerAddressStore(path);await disk.write('192.0.2.2');await disk.write('192.0.2.3');
 assert.equal(await new FileMixerAddressStore(path).read(),'192.0.2.3');
});

async function store(t:test.TestContext){const directory=await mkdtemp(join(tmpdir(),'studiolive-settings-'));t.after(()=>rm(directory,{recursive:true,force:true}));const path=join(directory,'mixer-settings.json');return {path,store:new FileMixerAddressStore(path)};}
test('migrate an existing SDK address once and recover it on restart without reading broken SDK settings',async t=>{
 const disk=await store(t),applied:(string|undefined)[]=[];let writes=0;
 const first=new MixerSettings({async get(){return {ip:'192.0.2.2',other:true};},async set(){writes++;}},disk.store,ip=>applied.push(ip));
 assert.deepEqual(await first.load(),{ip:'192.0.2.2'});assert.equal(writes,0);
 const second=new MixerSettings({async get(){throw new Error('SDK credentials unavailable');},async set(){throw new Error('unavailable');}},disk.store,ip=>applied.push(ip));
 assert.deepEqual(await second.load(),{ip:'192.0.2.2'});assert.deepEqual(applied,['192.0.2.2','192.0.2.2']);
});
test('empty, invalid and example global settings never persist defaults or replace a known address',async t=>{
 const disk=await store(t);let globals:Record<string,unknown>={};const applied:(string|undefined)[]=[];let writes=0;
 const config=new MixerSettings({async get(){return globals;},async set(){writes++;}},disk.store,ip=>applied.push(ip));
 for(const value of [undefined,'','not-an-ip','192.0.2.1']){globals={ip:value};assert.deepEqual(await config.load(),{ip:''});}
 assert.equal(await disk.store.read(),undefined);assert.equal(writes,0);assert.ok(applied.every(ip=>ip===undefined));
 await config.save('192.0.2.3');for(const ip of [undefined,'192.0.2.1','bad'])await config.changed({ip});
 assert.deepEqual(config.value(),{ip:'192.0.2.3'});assert.equal(await disk.store.read(),'192.0.2.3');
 await assert.rejects(config.save('192.0.2.1'));assert.equal(await disk.store.read(),'192.0.2.3');
});
test('verified local save survives failed SDK mirror and overrides stale SDK state after restart',async t=>{
 const disk=await store(t);const host:MixerSettingsHost={async get(){return {ip:'192.0.2.2'};},async set(){throw new Error('SDK write failed');}};
 const current=new MixerSettings(host,disk.store,()=>{});assert.deepEqual(await current.save(' 192.0.2.3 '),{ip:'192.0.2.3'});
 const fresh=new MixerSettings(host,new FileMixerAddressStore(disk.path),()=>{});assert.deepEqual(await fresh.load(),{ip:'192.0.2.3'});
 assert.deepEqual(JSON.parse(await readFile(disk.path,'utf8')),{version:1,ip:'192.0.2.3'});
});
test('failed local write is not reported as saved and does not change the current connection',async()=>{
 let applied=0,mirrored=0;const config=new MixerSettings({async get(){return {};},async set(){mirrored++;}},{async read(){return undefined;},async write(){throw new Error('disk write denied');}},()=>{applied++;});
 await assert.rejects(config.save('192.0.2.3'));assert.equal(applied,0);assert.equal(mirrored,0);assert.deepEqual(config.value(),{ip:''});
});
test('corrupt file can migrate a valid SDK value; saves serialize and retain other global fields',async t=>{
 const disk=await store(t);await writeFile(disk.path,'not json');let globals:Record<string,unknown>={ip:'192.0.2.2',other:'keep'};
 const config=new MixerSettings({async get(){return globals;},async set(next){globals=next;}},disk.store,()=>{});
 await config.load();await Promise.all([config.save('192.0.2.3'),config.save('192.0.2.4')]);
 assert.deepEqual(globals,{ip:'192.0.2.4',other:'keep'});assert.equal(await disk.store.read(),'192.0.2.4');
});
