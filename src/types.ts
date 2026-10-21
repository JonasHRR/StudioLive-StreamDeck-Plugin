export type Mode = 'toggle' | 'on' | 'off';
export type Status = 'offline' | 'connecting' | 'online' | 'invalid';
export type ParameterValue = boolean | number | string;
export type Snapshot = Map<number, boolean> & { parameters?: Map<string, ParameterValue> };
export function copySnapshot(values: Snapshot): Snapshot {
  const copy: Snapshot = new Map(values);
  if (values.parameters) copy.parameters = new Map(values.parameters);
  return copy;
}
export interface MixerEvents {
  state(channel: number, muted: boolean): void;
  snapshot(values: Snapshot): void;
  disconnected(reason: string): void;
  parameter?(path: string, value: ParameterValue): void;
}
export interface MixerTransport {
  open(ip: string, events: MixerEvents): Promise<Snapshot>;
  setMute(channel: number, muted: boolean): void;
  setParameter?(path: string, value: boolean | number): void;
  close(): void;
}
export type TransportFactory = () => MixerTransport;
export function channelNumber(value: unknown): number {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 24) throw new Error('Channel must be between 1 and 24.');
  return n;
}
export function ipv4(value: unknown): string {
  if (typeof value !== 'string') throw new Error('IPv4 address is missing.');
  const ip = value.trim();
  const parts = ip.split('.');
  if (parts.length !== 4 || parts.some(p => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255) ||
    Number(parts[0]) === 0 || Number(parts[0]) >= 224 || ip === '255.255.255.255') {
    throw new Error('Enter a valid IPv4 unicast address.');
  }
  return ip;
}
export function mode(value: unknown): Mode {
  if (value === undefined) return 'toggle';
  if (value === 'toggle' || value === 'on' || value === 'off') return value;
  throw new Error('Unknown operation.');
}
