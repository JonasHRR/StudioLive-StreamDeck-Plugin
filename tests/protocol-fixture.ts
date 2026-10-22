import { createServer, type Socket } from 'node:net';
import { deflateSync } from 'node:zlib';
import { Framer, jsonPacket, mutePacket, packet } from '../src/protocol.js';

// Fixture encoder intentionally independent from production decoder.
export function ub(value: any): Buffer {
  const length = (s: string) => Buffer.concat([Buffer.from([105, Buffer.byteLength(s)]),Buffer.from(s)]);
  if (typeof value === 'string') return Buffer.concat([Buffer.from('S'),length(value)]);
  if (typeof value === 'bigint') {const b=Buffer.alloc(9);b[0]=76;b.writeBigInt64BE(value,1);return b;}
  if (typeof value === 'number') { const b = Buffer.alloc(5); if(Number.isInteger(value)) {b[0]=108; b.writeInt32BE(value,1);} else {b[0]=100; b.writeFloatBE(value,1);} return b; }
  return Buffer.concat([Buffer.from('{'),...Object.entries(value).flatMap(([key,val]) => [length(key),ub(val)]),Buffer.from('}')]);
}
export function syncState(muteChannel = 2,inputCount=24): Buffer {
  const channels=Object.fromEntries(Array.from({length:inputCount},(_,i)=>[`ch${i+1}`,{values:{mute:i+1===muteChannel?1:0,volume:0.5,username:`Input ${i+1}`,color:0xff332211n,assign_aux1:1,assign_fx1:1}}]));
  const bus={children:{ch1:{values:{mute:0,volume:0.5,username:'Bus',color:0xff88ddffn}}}};
  const returns={children:Object.fromEntries(['Aux In 1','Aux In 2','Tape In'].map((name,i)=>[`ch${i+1}`,{values:{mute:0,volume:0.5,username:'',name,color:0xff332211n}}]))};
  const talkback={children:{ch1:{values:{mute:1,volume:0.5,username:'',name:'Talkback',color:0xff332211n}}}};
  return deflateSync(ub({id:'Synchronize',children:{line:{children:channels},return:returns,talkback,main:bus,sub:bus,aux:bus,fxbus:bus,fxreturn:bus,mutegroup:{values:{mutegroup1:0,mutegroup1username:'Band'}}}}));
}
export async function tcpMixer(options: {chunked?:boolean; silence?:boolean; echo?:boolean; port?:number; channels?:number} = {}) {
  const sockets = new Set<Socket>(); const writes: Buffer[] = []; const controls: Buffer[] = [];
  const server = createServer(socket => {
    sockets.add(socket); socket.on('error',()=>{}); socket.on('close',()=>sockets.delete(socket));
    const framer = new Framer();
    socket.on('data', data => framer.feed(data,(code,payload) => {
      writes.push(packet(code,payload));
      if (code === 'JM' && JSON.parse(payload.subarray(4).toString()).id === 'Subscribe' && !options.silence) {
        socket.write(jsonPacket({id:'SubscriptionReply'}));
        const compressed = syncState(2,options.channels ?? 24);
        if (options.chunked) {
          const middle = Math.floor(compressed.length/2);
          for (const [offset,part] of [[0,compressed.subarray(0,middle)],[middle,compressed.subarray(middle)]] as const) {
            const header = Buffer.alloc(16); header.write('ZB'); header.writeUInt32LE(offset,4); header.writeUInt32LE(compressed.length,8); header.writeUInt32LE(part.length,12);
            const frame = packet('CK',Buffer.concat([header,part]));
            // Fragment even the UC header; this is a known weakness of upstream DataClient.
            socket.write(frame.subarray(0,2)); socket.write(frame.subarray(2,5)); socket.write(frame.subarray(5));
          }
        } else socket.write(packet('ZB',Buffer.concat([Buffer.alloc(4),compressed])));
      }
      if (code === 'PV') { controls.push(payload); if (options.echo !== false) socket.write(packet('PV',payload)); }
      if (code === 'FR' && !options.silence) { const header = Buffer.alloc(14); payload.copy(header,0,0,2); socket.write(packet('FD',header)); }
    }));
  });
  await new Promise<void>((resolve,reject) => { server.once('error',reject); server.listen(options.port ?? 0,'127.0.0.1',resolve); });
  return { port:(server.address() as any).port as number, sockets, writes, controls,
    external(channel:number, muted:boolean) { for(const socket of sockets) socket.write(mutePacket(channel,muted)); },
    async close() { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
  };
}
