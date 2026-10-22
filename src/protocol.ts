import { inflateSync } from 'node:zlib';
import { decodeUBJSON } from './ubjson.js';
import {MAX_INPUT_CHANNELS, type Snapshot, type ParameterValue} from './types.js';
import { parameterKind } from './controls.js';

export const MAX_STATE = 8 * 1024 * 1024;
// MIT source: presonus-studiolive-api 1.9.1 constants/vendor/presonus.ts.
const PacketHeader = Buffer.from([0x55, 0x43, 0x00, 0x01]);
const CByte = { A: 0x68, B: 0x65 };
export function packet(code: string, data: Buffer = Buffer.alloc(0)): Buffer {
  if (code.length !== 2 || data.length > 65529) throw new Error('Invalid packet size.');
  const header = Buffer.alloc(12);
  PacketHeader.copy(header);
  header.writeUInt16LE(data.length + 6, 4); header.write(code, 6);
  header[8] = CByte.A; header[10] = CByte.B;
  return Buffer.concat([header, data]);
}
export function jsonPacket(value: object): Buffer {
  const json = Buffer.from(JSON.stringify(value)); const length = Buffer.alloc(4);
  length.writeUInt32LE(json.length); return packet('JM', Buffer.concat([length, json]));
}
export function mutePacket(channel: number, muted: boolean): Buffer {
  return parameterPacket(`line/ch${channel}/mute`, muted);
}
export function parameterPacket(path: string, value: boolean | number): Buffer {
  const kind=parameterKind(path);
  if ((kind==='boolean' && typeof value!=='boolean') || (kind==='number' && (typeof value!=='number' || !Number.isFinite(value) || value<0 || value>1)) || (kind!=='boolean' && kind!=='number')) throw new Error('Invalid write parameter.');
  const bytes=Buffer.alloc(4); bytes.writeFloatLE(typeof value==='boolean' ? (value ? 1 : 0) : value);
  return packet('PV',Buffer.concat([Buffer.from(`${path}\0\0\0`),bytes]));
}
export class Framer {
  private bytes: Buffer = Buffer.alloc(0);
  feed(data: Buffer, receive: (code: string, payload: Buffer) => void): void {
    this.bytes = Buffer.concat([this.bytes, data]);
    if (this.bytes.length > MAX_STATE) throw new Error('TCP buffer too large.');
    while (this.bytes.length >= 6) {
      if (!this.bytes.subarray(0, 4).equals(PacketHeader)) throw new Error('Invalid packet header.');
      const size = this.bytes.readUInt16LE(4) + 6;
      if (size < 12) throw new Error('Packet too short.');
      if (this.bytes.length < size) return;
      const frame = this.bytes.subarray(0, size); this.bytes = this.bytes.subarray(size);
      receive(frame.toString('ascii', 6, 8), frame.subarray(12));
    }
  }
}
export function boolean(value: unknown): boolean | undefined {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return undefined;
}
export function decodeState(compressed: Buffer): Snapshot {
  const raw = decodeUBJSON(inflateSync(compressed, { maxOutputLength: 32 * 1024 * 1024 })) as any;
  if (raw?.id !== 'Synchronize') throw new Error('Missing Synchronize initial state.');
  const result: Snapshot = new Map();
  result.parameters = new Map();
  function flatten(node: any, prefix: string, depth = 0): void {
    if (!node || typeof node !== 'object' || depth > 8) return;
    for (const [key,value] of Object.entries(node.values ?? {})) {
      const path=`${prefix}/${key}`.replace(/^\//,'');
      const decoded=parameterValue(path,value);
      if (decoded!==undefined) result.parameters!.set(path,decoded);
    }
    for (const [key,child] of Object.entries(node.children ?? {})) flatten(child,`${prefix}/${key}`.replace(/^\//,''),depth+1);
  }
  flatten(raw,'');
  result.inputCount=0;
  for (let channel = 1; channel <= MAX_INPUT_CHANNELS; channel++) {
    const node=raw.children?.line?.children?.[`ch${channel}`];
    if(node!==undefined)result.inputCount=channel;
    const muted = boolean(node?.values?.mute);
    if (muted !== undefined) result.set(channel, muted);
  }
  return result;
}
export function parameterValue(path: string, input: unknown): ParameterValue | undefined {
  const kind=parameterKind(path);
  if (kind==='color') return channelColor(input);
  if (kind==='boolean') return boolean(input);
  if (kind==='number' && typeof input==='number' && Number.isFinite(input) && input>=0 && input<=1) return input;
  if (kind==='string' && typeof input==='string') return input.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,128);
  return undefined;
}
/** UC snapshots store RGBA in the low 32 bits, little-endian; PC carries RGBA bytes. Read only. */
export function channelColor(input: unknown): string | undefined {
  let rgba:Buffer;
  if(Buffer.isBuffer(input)) {
    if(input.length!==4) return;
    rgba=input;
  } else if(typeof input==='bigint' || (typeof input==='number' && Number.isInteger(input) && input>=-2147483648 && input<=4294967295)) {
    rgba=Buffer.alloc(4); rgba.writeUInt32LE(Number(BigInt.asUintN(32,BigInt(input))));
  } else return;
  // Unassigned/transparent colors use the existing state background. Assigned colors use RGB.
  return rgba[3]===0?'':`#${rgba.subarray(0,3).toString('hex')}`;
}
export function decodeParameter(code: string, data: Buffer): {path:string; value:ParameterValue} | undefined {
  const end=data.indexOf(0);
  if (end<0) return;
  const path=data.toString('utf8',0,end).replaceAll('.','/');
  const kind=parameterKind(path);
  if (!kind) return;
  if (code==='PC' && kind==='color') {
    if(data.length!==end+7) return;
    const value=channelColor(data.subarray(end+3));
    return value===undefined?undefined:{path,value};
  }
  let input: unknown;
  if (code==='PS' && kind==='string') {
    if (data.length<end+4 || data.at(-1)!==0) throw new Error('Incomplete name message.');
    input=data.toString('utf8',end+3,data.length-1);
  } else if (code==='PV' && (kind==='boolean' || kind==='number')) {
    if (data.length!==end+7) throw new Error('Incomplete parameter feedback.');
    input=data.readFloatLE(end+3);
  } else return;
  const value=parameterValue(path,input);
  if (value===undefined) throw new Error('Invalid parameter value.');
  return {path,value};
}
/** TCP MS/fdrs batches contain 16-bit fader positions, not UDP audio meters. */
export function decodeFaders(data: Buffer): {path:string;value:number}[] {
  if (data.toString('ascii',0,4)!=='fdrs') return [];
  if (data.length<9) throw new Error('Incomplete fader packet.');
  const count=data.readUInt16LE(6), groupStart=8+count*2;
  if (groupStart>=data.length) throw new Error('Missing fader data.');
  const groups=data[groupStart];
  if (groupStart+1+groups*6>data.length) throw new Error('Missing fader groups.');
  const types=['line','return','fxreturn','talkback','aux','fxbus','sub','main'];
  const updates: {path:string;value:number}[]=[];
  for(let i=0;i<groups;i++) {
    const pos=groupStart+1+i*6, group=data.readUInt16LE(pos), offset=data.readUInt16LE(pos+2), size=data.readUInt16LE(pos+4);
    if (offset+size>count) throw new Error('Invalid fader index.');
    if (!types[group]) continue;
    for(let ch=0;ch<size;ch++) {
      const path=`${types[group]}/ch${ch+1}/volume`;
      if (parameterKind(path)==='number') updates.push({path,value:data.readUInt16LE(8+(offset+ch)*2)/65535});
    }
  }
  return updates;
}
export function decodeMute(data: Buffer): { channel: number; muted: boolean } | undefined {
  const end = data.indexOf(0);
  if (end < 0) return;
  const match = /^line[/.]ch([1-9]|[1-5]\d|6[0-4])[/.]mute$/.exec(data.toString('utf8', 0, end));
  if (!match) return;
  if (data.length !== end + 7) throw new Error('Incomplete mute feedback.');
  const muted = boolean(data.readFloatLE(end + 3));
  if (muted === undefined) throw new Error('Invalid mute value.');
  return { channel: Number(match[1]), muted };
}
