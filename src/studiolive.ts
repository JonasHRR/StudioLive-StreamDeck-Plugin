import { Socket } from 'node:net';
import { randomBytes } from 'node:crypto';
import { decodeMute, decodeParameter, decodeFaders, decodeState, Framer, jsonPacket, MAX_STATE, mutePacket, parameterPacket, packet } from './protocol.js';
import { channelNumber, copySnapshot, hasCompleteInputState, ipv4, type ParameterValue, type MixerEvents, type MixerTransport, type Snapshot } from './types.js';

/** One owned socket per attempt. No discovery, UDP metering or library reconnect loop. */
export class StudioLiveTransport implements MixerTransport {
  private socket?: Socket;
  private heartbeat?: ReturnType<typeof setInterval>;
  private deadline?: ReturnType<typeof setTimeout>;
  private failOpen?: (error: Error) => void;
  private ended = false;
  private ready = false;
  constructor(private readonly timeoutMs = 8000, private readonly port = 53000) {}

  open(ip: string, events: MixerEvents): Promise<Snapshot> {
    ipv4(ip);
    if (this.socket || this.ended) return Promise.reject(new Error('Transport already used.'));
    return new Promise((resolve, reject) => {
      this.failOpen = reject;
      const socket = this.socket = new Socket();
      const framer = new Framer();
      let subscribed = false;
      let values: Snapshot | undefined;
      const early = new Map<number, boolean>();
      const earlyParameters = new Map<string,ParameterValue>();
      let chunks: Buffer[] = []; let chunkOffset = 0; let chunkTotal = 0;
      let lastReply = Date.now(); let requestId = 0;
      const outstanding = new Set<number>();
      const fail = (reason: string) => {
        if (this.ended) return;
        this.close(); events.disconnected(reason);
      };
      const tryReady = () => {
        if (!subscribed || !values || this.ready || this.ended) return;
        if (!hasCompleteInputState(values)) { fail('Initial input mute state is incomplete.'); return; }
        this.ready = true; clearTimeout(this.deadline); this.failOpen = undefined;
        lastReply = Date.now();
        this.heartbeat = setInterval(() => {
          if (Date.now() - lastReply > 5000) { fail('Keepalive timed out.'); return; }
          requestId = (requestId + 1) % 65536; outstanding.add(requestId);
          const id = Buffer.alloc(2); id.writeUInt16BE(requestId);
          socket.write(packet('KA'));
          socket.write(packet('FR', Buffer.concat([id, Buffer.from('Ftbr\0\0')])));
        }, 1000);
        resolve(copySnapshot(values));
      };
      const synchronize = (data: Buffer) => {
        const next = decodeState(data);
        if (!this.ready) for (const [channel, muted] of early) next.set(channel, muted);
        if (!this.ready) for (const [path,value] of earlyParameters) next.parameters!.set(path,value);
        if (!hasCompleteInputState(next)) throw new Error('Incomplete mixer state.');
        values = next;
        if (this.ready) events.snapshot(copySnapshot(next));
        tryReady();
      };
      socket.on('data', data => {
        try {
          framer.feed(data, (code, payload) => {
            if (this.ended) return;
            if (code === 'JM') {
              if (payload.length < 4) throw new Error('Incomplete JSON packet.');
              const message = JSON.parse(payload.subarray(4).toString());
              if (message.id === 'SubscriptionReply') { subscribed = true; tryReady(); }
            } else if (code === 'ZB') {
              synchronize(payload.subarray(4));
            } else if (code === 'CK') {
              if (payload.length < 16) throw new Error('Incomplete chunk.');
              const offset = payload.readUInt32LE(4); const total = payload.readUInt32LE(8);
              const size = payload.readUInt32LE(12); const part = payload.subarray(16);
              if (offset === 0) { chunks = []; chunkOffset = 0; chunkTotal = total; }
              if (total > MAX_STATE || total !== chunkTotal || offset !== chunkOffset || size !== part.length || offset + size > total) throw new Error('Invalid chunk sequence.');
              chunks.push(part); chunkOffset += size;
              if (chunkOffset === total) { const full = Buffer.concat(chunks); chunks = []; synchronize(full); }
            } else if (code === 'PV' || code === 'PS' || code === 'PC' || code === 'MS') {
              const parameters = code==='MS' ? decodeFaders(payload) : [decodeParameter(code,payload)].filter((value): value is NonNullable<typeof value> => value!==undefined);
              for (const update of parameters) {
                if (!this.ready) { earlyParameters.set(update.path,update.value); values?.parameters?.set(update.path,update.value); }
                else events.parameter?.(update.path,update.value);
              }
              const update = code==='PV' ? decodeMute(payload) : undefined;
              if (update) {
                if (!this.ready) { early.set(update.channel, update.muted); values?.set(update.channel, update.muted); }
                else events.state(update.channel, update.muted);
              }
            } else if (code === 'FD' && payload.length >= 14) {
              const id = payload.readUInt16BE(0);
              if (outstanding.delete(id)) { lastReply = Date.now(); }
            }
          });
        } catch { fail('Invalid or incompatible protocol data.'); }
      });
      socket.on('error', () => fail('TCP connection failed.'));
      socket.on('close', () => fail('TCP connection closed.'));
      socket.setNoDelay(true);
      this.deadline = setTimeout(() => fail('Connection or initial state timed out.'), this.timeoutMs);
      socket.connect(this.port, ip, () => {
        socket.write(jsonPacket({ id: 'Subscribe', clientName: 'UC-Surface', clientInternalName: 'ucremoteapp',
          clientType: 'StudioLive API', clientDescription: 'Stream Deck Main Mutes',
          clientIdentifier: randomBytes(8).toString('hex'), clientOptions: 'perm users levl redu rtan', clientEncoding: 23106 }));
      });
    });
  }
  setMute(channel: number, muted: boolean): void {
    channelNumber(channel);
    if (!this.ready || this.ended || !this.socket?.writable) throw new Error('Mixer is not ready.');
    this.socket.write(mutePacket(channel, muted));
  }
  setParameter(path: string, value: boolean | number): void {
    if (!this.ready || this.ended || !this.socket?.writable) throw new Error('Mixer is not ready.');
    this.socket.write(parameterPacket(path,value));
  }
  close(): void {
    if (this.ended) return;
    this.ended = true; this.ready = false;
    clearInterval(this.heartbeat); clearTimeout(this.deadline);
    this.failOpen?.(new Error('Connection closed.')); this.failOpen = undefined;
    this.socket?.destroy();
  }
}
