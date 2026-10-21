import { copySnapshot, type MixerEvents, type MixerTransport, type Snapshot, type ParameterValue } from '../src/types.js';
export const states = (muted = false): Snapshot => new Map(Array.from({length:24}, (_, i) => [i+1, muted]));
export class SimulatedMixer implements MixerTransport {
  events?: MixerEvents;
  values = states();
  writes: { channel: number; muted: boolean }[] = [];
  parameterWrites: {path:string;value:boolean|number}[]=[];
  autoAck = true;
  opened = 0;
  closed = false;
  deferred = false;
  private resolveOpen?: (values: Snapshot) => void;
  async open(_ip: string, events: MixerEvents): Promise<Snapshot> {
    this.events = events; this.opened++;
    if (this.deferred) return new Promise(resolve => { this.resolveOpen = resolve; });
    return copySnapshot(this.values);
  }
  ready(): void { this.resolveOpen?.(copySnapshot(this.values)); }
  setMute(channel: number, muted: boolean): void {
    this.writes.push({channel, muted});
    if (this.autoAck) queueMicrotask(() => { if (!this.closed) this.external(channel, muted); });
  }
  external(channel: number, muted: boolean): void { this.values.set(channel, muted); this.events?.state(channel, muted); }
  setParameter(path:string,value:boolean|number):void {
    this.parameterWrites.push({path,value});
    if(this.autoAck) queueMicrotask(()=>{if(!this.closed)this.externalParameter(path,value);});
  }
  externalParameter(path:string,value:ParameterValue):void {this.values.parameters ??= new Map(); this.values.parameters.set(path,value); this.events?.parameter?.(path,value);}
  disconnect(): void { this.events?.disconnected('Simulierter Abbruch.'); }
  close(): void { this.closed = true; }
}
export const tick = () => new Promise<void>(resolve => setImmediate(resolve));
export async function until(condition: () => boolean, maxMs = 1000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (!condition()) { if (Date.now() > deadline) throw new Error('Test condition not reached.'); await new Promise(resolve => setTimeout(resolve, 2)); }
}
