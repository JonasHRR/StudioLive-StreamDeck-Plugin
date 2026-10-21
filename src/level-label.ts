import {dbToLevel,relativeLevel,toggleLevelDb,type LevelRequest} from './controls.js';
export type FadeDirection='up'|'down';
export function levelLabel(request:LevelRequest,currentLevel:number|undefined,previousDirection?:FadeDirection,fadeTarget?:number,busy=false):{label:string;direction?:FadeDirection;inactive?:boolean}{
  const {operation,db,durationMs}=request;
  if(operation==='stop')return {label:'FADE STOP'};
  if(operation==='toggle'){
    const next=toggleLevelDb(currentLevel,fadeTarget);
    return {label:next===undefined?'FADE':next===0?'FADE IN':'FADE OUT'};
  }
  const numeric=operation==='step'?`${db>0?'+':''}${db} dB`:`→ ${db===-84?'−∞':`${db} dB`}`;
  if(!durationMs)return {label:numeric};
  if(!busy && typeof currentLevel==='number'){
    const goal=operation==='set'?dbToLevel(db):relativeLevel(currentLevel,db);
    // Same tolerance as command confirmation: an already reached goal sends no write.
    if(Math.abs(goal-currentLevel)<=4/65535)return {label:'FADE --',direction:previousDirection,inactive:true};
  }
  if(operation==='step' && db===0)return {label:numeric};
  let direction=previousDirection;
  if(operation==='step')direction=db<0?'down':'up';
  else if(typeof currentLevel==='number'){
    const difference=dbToLevel(db)-currentLevel;
    // Match confirmation tolerance so quantized final echoes cannot flip the label.
    if(Math.abs(difference)>4/65535)direction=difference<0?'down':'up';
  }
  return {label:direction==='down'?'FADE DOWN':direction==='up'?'FADE UP':'FADE',direction};
}
