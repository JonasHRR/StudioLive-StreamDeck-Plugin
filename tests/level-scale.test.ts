import test from 'node:test';
import assert from 'node:assert/strict';
import {dbToLevel,levelToDb} from '../src/controls.js';
import {parameterPacket} from '../src/protocol.js';
import {keySvg} from '../src/presentation.js';

test('zero dB uses the independently read unity position and exact Float32 wire value',()=>{
 // Real read-only snapshot at user-confirmed 0 dB, not a computed round trip.
 assert.equal(dbToLevel(0),0.74609375);
 assert.equal(levelToDb(0.74609375),0);
 const wire=parameterPacket('line/ch2/volume',dbToLevel(0));
 assert.equal(wire.subarray(-4).toString('hex'),'00003f3f');
 const quantized=Math.round(0.74609375*65535)/65535;
 const svg=keySvg(2,'',{status:'online',pending:false,reason:'',level:quantized},false,{level:true});
 assert.match(svg,/>≈ 0\.0 dB<\/text>/);assert.doesNotMatch(svg,/-0\.0/);
});

test('unity correction is continuous and monotonic, preserves endpoints and supports relative steps',()=>{
 assert.equal(dbToLevel(-84),0);assert.equal(dbToLevel(10),1);assert.equal(levelToDb(0),-84);
 let previous=0;
 for(let tenth=-600;tenth<=100;tenth++){
  const db=tenth/10,level=dbToLevel(db);
  assert.ok(level>previous,`Increasing position at ${db} dB`);previous=level;
  assert.ok(Math.abs(levelToDb(level)-db)<1e-8,`Inverse at ${db} dB`);
 }
 assert.ok(dbToLevel(-0.000001)<0.74609375);assert.ok(dbToLevel(0.000001)>0.74609375);
 assert.ok(dbToLevel(0.000001)-dbToLevel(-0.000001)<1e-6);
 for(const invalid of [-85,-70,11,NaN,Infinity])assert.throws(()=>dbToLevel(invalid));
});
