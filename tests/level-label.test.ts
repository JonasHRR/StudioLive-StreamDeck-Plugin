import test from 'node:test';
import assert from 'node:assert/strict';
import {dbToLevel,levelRequest,target} from '../src/controls.js';
import {levelLabel} from '../src/level-label.js';
const fixed=(db:number,ms=3000)=>levelRequest(target(),'set',db,ms);
const step=(db:number,ms=3000)=>levelRequest(target(),'step',db,ms);
test('fixed endpoints and relative steps use UP/DOWN; IN/OUT is reserved for toggle fades',()=>{
 for(const level of [undefined,0,dbToLevel(-24),dbToLevel(10)]){
  for(const db of [-84,0])assert.doesNotMatch(levelLabel(fixed(db),level).label,/FADE (IN|OUT)$/);
  assert.equal(levelLabel(step(-1),level).label,level===0?'FADE --':'FADE DOWN');assert.equal(levelLabel(step(1),level).label,level===1?'FADE --':'FADE UP');
 }
 assert.equal(levelLabel(fixed(-84),dbToLevel(0)).label,'FADE DOWN');
 assert.equal(levelLabel(fixed(0),0).label,'FADE UP');
 assert.equal(levelLabel(fixed(0),dbToLevel(6)).label,'FADE DOWN');
 assert.equal(levelLabel(fixed(-6),dbToLevel(-12)).label,'FADE UP');assert.equal(levelLabel(fixed(-6),dbToLevel(0)).label,'FADE DOWN');
 assert.equal(levelLabel(fixed(6),dbToLevel(10)).label,'FADE DOWN');assert.equal(levelLabel(fixed(6),dbToLevel(0)).label,'FADE UP');
 assert.equal(levelLabel(step(0),dbToLevel(-6)).label,'FADE --');assert.equal(levelLabel(step(-1,0),0).label,'-1 dB');
 assert.equal(levelLabel(fixed(-84,0),0).label,'→ −∞');assert.equal(levelLabel(levelRequest(target(),'stop',0,0),0).label,'FADE STOP');
});
test('reached targets show FADE -- within confirmation tolerance, retaining direction only as offline history',()=>{
 const request=fixed(-6),goal=dbToLevel(-6);
 for(const level of [goal,goal+4/65535,goal-4/65535]){
  for(const direction of ['up','down'] as const){const result=levelLabel(request,level,direction);assert.equal(result.label,'FADE --');assert.equal(result.inactive,true);assert.equal(result.direction,direction);}
 }
 assert.equal(levelLabel(request,undefined,'up').label,'FADE UP');assert.equal(levelLabel(request,undefined,'down').label,'FADE DOWN');
 assert.equal(levelLabel(request,goal+5/65535,'up').label,'FADE DOWN');assert.equal(levelLabel(request,goal-5/65535,'down').label,'FADE UP');
 assert.equal(levelLabel(request,undefined).label,'FADE');assert.equal(levelLabel(request,goal).label,'FADE --');
});

test('no-op detection includes floor/top relative bounds but excludes active work, instant changes and toggles',()=>{
 for(const current of [1/65535,0.005])assert.equal(levelLabel(step(0),current).label,'FADE --');
 for(const request of [fixed(-84),step(-1),step(0)])assert.equal(levelLabel(request,0).inactive,true);
 assert.equal(levelLabel(step(1),1).label,'FADE --');
 assert.equal(levelLabel(fixed(0),dbToLevel(0),undefined,0,true).inactive,undefined);
 assert.notEqual(levelLabel(fixed(0),dbToLevel(0),'up',0,true).label,'FADE --');
 assert.equal(levelLabel(fixed(0,0),dbToLevel(0)).label,'→ 0 dB');
 assert.equal(levelLabel(fixed(0),undefined).inactive,undefined);
 const toggle=levelRequest(target(),'toggle',0,3000);
 assert.equal(levelLabel(toggle,0).label,'FADE IN');assert.equal(levelLabel(toggle,dbToLevel(0)).label,'FADE OUT');
});

test('toggle fade labels show the next endpoint, including reversal before the first step',()=>{
 const request=levelRequest(target(),'toggle',-84,3000);
 assert.equal(request.db,0);
 assert.equal(levelLabel(request,dbToLevel(0)).label,'FADE OUT');
 assert.equal(levelLabel(request,0).label,'FADE IN');
 assert.equal(levelLabel(request,2/65535).label,'FADE IN');
 assert.equal(levelLabel(request,dbToLevel(0),undefined,0).label,'FADE IN');
 assert.equal(levelLabel(request,0,undefined,dbToLevel(0)).label,'FADE OUT');
 assert.equal(levelLabel(request,undefined).label,'FADE');
});
