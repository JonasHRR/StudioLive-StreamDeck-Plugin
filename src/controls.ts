import { channelNumber } from './types.js';
export type TargetKind = 'line' | 'main' | 'sub' | 'aux' | 'fxbus' | 'fxreturn' | 'group' | 'auxsend' | 'fxsend';
export type Target = { kind: TargetKind; channel: number; mix: number };
export type LevelOperation = 'set' | 'step' | 'stop' | 'toggle';
export type LevelRequest = { target: Target; operation: LevelOperation; db: number; durationMs: number };
const limits: Record<TargetKind, number> = { line:24, main:1, sub:4, aux:16, fxbus:4, fxreturn:4, group:8, auxsend:24, fxsend:24 };
function integer(input: unknown, max: number): number {
  const value = typeof input === 'string' && /^\d+$/.test(input) ? Number(input) : input;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) throw new Error('Invalid target number.');
  return value;
}
export function target(kind: unknown = 'line', channel: unknown = 1, mix: unknown = 1): Target {
  if (typeof kind !== 'string' || !Object.hasOwn(limits, kind)) throw new Error('Invalid target type.');
  const type = kind as TargetKind;
  return {kind:type, channel:integer(channel,limits[type]), mix:type === 'auxsend' ? integer(mix,16) : type === 'fxsend' ? integer(mix,4) : 1};
}
export function validateTarget(input: Target): Target { return target(input.kind, input.channel, input.mix); }
export function basePath(input: Target): string {
  const t = validateTarget(input);
  return t.kind === 'group' ? `mutegroup/mutegroup${t.channel}` : `${t.kind.endsWith('send') ? 'line' : t.kind}/ch${t.channel}`;
}
export function mutePath(t: Target): string {
  const base = basePath(t);
  return t.kind === 'group' ? base : t.kind === 'auxsend' ? `${base}/assign_aux${t.mix}` : t.kind === 'fxsend' ? `${base}/assign_fx${t.mix}` : `${base}/mute`;
}
export function invertedMute(t: Target): boolean { return t.kind === 'auxsend' || t.kind === 'fxsend'; }
export function levelPath(t: Target): string {
  if (['group','auxsend','fxsend'].includes(t.kind)) throw new Error('This target does not support level actions.');
  return `${basePath(t)}/volume`;
}
export function targetLabel(t: Target): string {
  const labels: Record<TargetKind,string> = {line:'CHANNEL', main:'MAIN', sub:'SUB', aux:'AUX', fxbus:'FX BUS', fxreturn:'FX RETURN', group:'MUTE-GRP', auxsend:'CHANNEL', fxsend:'CHANNEL'};
  return `${labels[t.kind]} ${t.channel}`;
}
export function targetScope(t: Target): string {
  return t.kind === 'auxsend' ? `SEND → AUX ${t.mix}` : t.kind === 'fxsend' ? `SEND → FX ${'ABCD'[t.mix-1]}` : t.kind === 'group' ? 'MIXER GROUP' : t.kind === 'line' ? 'MAIN' : 'BUS / RETURN';
}
/** Only parameters needed by this plugin are retained. No arbitrary write paths. */
export function parameterKind(path: string): 'boolean' | 'number' | 'string' | 'color' | undefined {
  if (/^(line\/ch(?:[1-9]|1\d|2[0-4])|main\/ch1|sub\/ch[1-4]|aux\/ch(?:[1-9]|1[0-6])|fxbus\/ch[1-4]|fxreturn\/ch[1-4])\/(mute|volume|username|name|color)$/.test(path)) {
    const key=path.split('/').at(-1); return key==='mute'?'boolean':key==='volume'?'number':key==='color'?'color':'string';
  }
  if (/^line\/ch(?:[1-9]|1\d|2[0-4])\/assign_(aux(?:[1-9]|1[0-6])|fx[1-4])$/.test(path)) return 'boolean';
  if (/^mutegroup\/mutegroup[1-8]$/.test(path)) return 'boolean';
  if (/^mutegroup\/mutegroup[1-8]username$/.test(path)) return 'string';
  return undefined;
}
export function mainChannel(path: string): number | undefined {
  const match=/^line\/ch(\d+)\/mute$/.exec(path); return match ? channelNumber(match[1]) : undefined;
}
export function finiteNumber(value: unknown, min: number, max: number): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value.replace(',','.')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new Error('Number outside the allowed range.');
  return n;
}
// User confirmed channel 2 at exactly 0 dB; read-only StudioLive 24 snapshot,
// October 21, 2026: line/ch2/volume = 191/256. Other dB points remain approximate.
const UNITY_LEVEL=191/256;
// Andrew Wong's empirical curve (MIT), continuously rescaled on either side
// of unity to retain its shape without a jump at the corrected 0 dB anchor.
function empiricalCurve(db:number):number {return (72.5204177782 + 2.473473992*db + 0.026567557*db**2 + 0.0000880866*db**3)/100;}
function curve(db:number):number {
  const value=empiricalCurve(db),unity=empiricalCurve(0);
  return db<=0?value*UNITY_LEVEL/unity:UNITY_LEVEL+(value-unity)*(1-UNITY_LEVEL)/(empiricalCurve(10)-unity);
}
export function dbToLevel(db: number): number {
  if (db === -84) return 0;
  finiteNumber(db,-60,10);
  return Math.max(0,Math.min(1,curve(db)));
}
export function levelToDb(level: number): number {
  finiteNumber(level,0,1);
  if (level === 0) return -84;
  if (level === UNITY_LEVEL) return 0;
  let low=-64, high=10;
  for(let n=0;n<40;n++) { const middle=(low+high)/2; if(curve(middle)<level) low=middle; else high=middle; }
  return (low+high)/2;
}
export function relativeLevel(current:number,db:number):number {
  // A zero step preserves feedback exactly, including positions below -60 dB.
  if(db===0)return current;
  if(current===0)return db>0?dbToLevel(-60):0;
  const goal=levelToDb(current)+db;
  return goal < -60?0:dbToLevel(Math.min(10,goal));
}
export function levelRequest(t: Target, operation: unknown, db: unknown, durationMs: unknown): LevelRequest {
  levelPath(t);
  if (operation !== 'set' && operation !== 'step' && operation !== 'stop' && operation !== 'toggle') throw new Error('Invalid level operation.');
  if (operation === 'stop') return {target:t, operation, db:0, durationMs:0};
  if (operation === 'toggle') return {target:t, operation, db:0, durationMs:finiteNumber(durationMs,0,60000)};
  const value=finiteNumber(db, operation==='step' ? -12 : -84, operation==='step' ? 12 : 10);
  if (operation==='set' && value!==-84 && value < -60) throw new Error('Target: -60 to +10 dB, or -84 for the fader floor.');
  return {target:t, operation, db:value, durationMs:finiteNumber(durationMs,0,60000)};
}
/** Next endpoint follows the active fade's destination, otherwise confirmed position. */
export function toggleLevelDb(current:number|undefined,fadeTarget?:number): -84 | 0 | undefined {
  if(typeof current!=='number')return undefined;
  return (fadeTarget ?? current)<=4/65535?0:-84;
}
