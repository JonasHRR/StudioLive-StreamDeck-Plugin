import { EventEmitter } from 'node:events';
import { channelNumber, ipv4, mode, type MixerTransport, type Snapshot, type Status, type TransportFactory, type ParameterValue } from './types.js';
import { basePath, dbToLevel, invertedMute, levelPath, levelRequest, mainChannel, mutePath, parameterKind, relativeLevel, target, toggleLevelDb, type LevelRequest, type Target } from './controls.js';

type Writable = boolean | number;
type Fade = { path:string; epoch:number; abort:AbortController; expected:number[]; destination:number };
type Command = { path:string; compute(current:Writable):Writable; epoch:number; expires:number; owner?:Fade; resolve():void; reject(error:Error):void };
type Pending = { path:string; desired:Writable; owner?:Fade; finish(error?:Error):void };
export class CommandCancelled extends Error {}
export type ChannelView = { status:Status; muted?:boolean; pending:boolean; reason:string; name?:string; color?:string; available?:boolean; level?:number; fading?:boolean; fadeTarget?:number };
const equal = (a:ParameterValue|undefined,b:Writable) => typeof a==='number' && typeof b==='number' ? Math.abs(a-b)<=4/65535 : a===b;
export class MixerService extends EventEmitter {
  private transport?: MixerTransport;
  private ip?: string;
  private epoch = 0;
  private parameters = new Map<string,ParameterValue>();
  private queue: Command[] = [];
  private pending?: Pending;
  private fades = new Map<string,Fade>();
  private retry?: ReturnType<typeof setTimeout>;
  private failures = 0;
  private draining = false;
  private stopped = true;
  status: Status = 'offline';
  reason = 'Not connected yet.';
  constructor(private readonly factory:TransportFactory, private readonly options = {ackMs:2000, backoffMs:500, maxBackoffMs:10000, queueAgeMs:5000}) { super(); }

  configure(input:unknown): void {
    let ip:string;
    try { ip=ipv4(input); }
    catch { this.stop(); this.status='invalid'; this.reason='Invalid mixer IP address.'; this.emit('change'); return; }
    if (!this.stopped && this.ip===ip) return;
    this.stop(); this.ip=ip; this.stopped=false; this.failures=0; this.attempt();
  }
  stop(): void {
    this.stopped=true; this.epoch++; clearTimeout(this.retry);
    this.cancel('Connection closed; command discarded.');
    const old=this.transport; this.transport=undefined; old?.close();
    this.parameters.clear(); this.status='offline'; this.reason='Not connected.'; this.emit('change');
  }
  private adopt(values:Snapshot): void {
    this.parameters=new Map(values.parameters);
    for(const [channel,muted] of values) this.parameters.set(`line/ch${channel}/mute`,muted);
  }
  private attempt(): void {
    if(this.stopped || !this.ip) return;
    const epoch=++this.epoch;
    this.parameters.clear(); this.status='connecting'; this.reason='Reading initial state.';
    const transport=this.transport=this.factory(); this.emit('change');
    const active=()=>!this.stopped && epoch===this.epoch && transport===this.transport;
    void transport.open(this.ip,{
      state:(channel,muted)=>{if(active() && this.status==='online') this.receive(`line/ch${channel}/mute`,muted);},
      parameter:(path,value)=>{if(active() && this.status==='online') this.receive(path,value);},
      snapshot:values=>{
        if(!active() || this.status!=='online') return;
        if(!this.complete(values)) {this.lost('Incomplete mixer state.'); return;}
        for(const path of [...this.fades.keys()]) this.stopFade(path);
        this.adopt(values); this.emit('change');
      },
      disconnected:reason=>{if(active()) this.lost(reason);}
    }).then(values=>{
      if(!active()) return;
      if(!this.complete(values)) {this.lost('Not all 24 channel states are known.'); return;}
      this.adopt(values); this.status='online'; this.reason='Mixer state received.'; this.failures=0; this.emit('change');
    }).catch(()=>{if(active()) this.lost('Connection or initial state failed.');});
  }
  private complete(values:Snapshot): boolean {return Array.from({length:24},(_,i)=>i+1).every(ch=>typeof values.get(ch)==='boolean');}
  private lost(reason:string): void {
    this.epoch++; const old=this.transport; this.transport=undefined;
    this.cancel('Execution unconfirmed; queue discarded.'); old?.close();
    this.parameters.clear(); this.status='offline'; this.reason=reason; this.emit('change');
    if(!this.stopped) this.retry=setTimeout(()=>this.attempt(),Math.min(this.options.maxBackoffMs,this.options.backoffMs*2**Math.min(this.failures++,8)));
  }
  private cancel(reason:string): void {
    for(const path of [...this.fades.keys()]) this.stopFade(path);
    const error=new Error(reason); this.pending?.finish(error); this.pending=undefined;
    for(const command of this.queue.splice(0)) command.reject(error);
  }
  private receive(path:string,value:ParameterValue): void {
    if(!parameterKind(path)) return;
    this.parameters.set(path,value);
    const fade=this.fades.get(path);
    if(fade && typeof value==='number' && !fade.expected.some(expected=>equal(value,expected))) this.stopFade(path);
    if(this.pending?.path===path && equal(value,this.pending.desired)) this.pending.finish();
    this.emit('change');
  }
  private name(t:Target): string | undefined {
    const base=basePath(t);
    const value=this.parameters.get(t.kind==='group'?`${base}username`:`${base}/username`) || this.parameters.get(`${base}/name`);
    return typeof value==='string' ? value : undefined;
  }
  view(channel:number): ChannelView {return this.viewTarget(target('line',channel));}
  viewTarget(t:Target, level=false): ChannelView {
    const path=level?levelPath(t):mutePath(t), raw=this.status==='online'?this.parameters.get(path):undefined;
    const mute=this.status==='online'?this.parameters.get(mutePath(t)):undefined;
    const color=this.status==='online'?this.parameters.get(`${basePath(t)}/color`):undefined;
    const known=level?typeof raw==='number':typeof raw==='boolean';
    return {status:this.status, muted:typeof mute==='boolean'?(invertedMute(t)?!mute:mute):undefined,
      color:typeof color==='string' && /^#[0-9a-f]{6}$/i.test(color)?color:undefined,
      level:typeof raw==='number'?raw:undefined, name:this.status==='online'?this.name(t):undefined,
      available:known, pending:this.pending?.path===path || this.fades.has(path), fading:this.fades.has(path), fadeTarget:this.fades.get(path)?.destination, reason:this.reason};
  }
  execute(channel:unknown, operation:unknown): Promise<void> {
    try {return this.executeMute(target('line',channelNumber(channel)),operation);} catch(error) {return Promise.reject(error);}
  }
  executeMute(t:Target, input:unknown): Promise<void> {
    try {
      const path=mutePath(t), operation=mode(input);
      return this.enqueue(path,current=>{
        if(typeof current!=='boolean') throw new Error('Mute state unknown.');
        const muted=invertedMute(t)?!current:current;
        const desired=operation==='toggle'?!muted:operation==='on';
        return invertedMute(t)?!desired:desired;
      });
    } catch(error) {return Promise.reject(error);}
  }
  executeLevel(input:LevelRequest): Promise<void> {
    try {
      const request=levelRequest(input.target,input.operation,input.db,input.durationMs), path=levelPath(request.target);
      const previousDestination=this.fades.get(path)?.destination;
      this.stopFade(path);
      if(request.operation==='stop') return Promise.resolve();
      if(this.status!=='online' || typeof this.parameters.get(path)!=='number') throw new Error('Level state unknown.');
      const currentLevel=this.parameters.get(path) as number;
      const toggleDb=toggleLevelDb(currentLevel,previousDestination)!;
      const goal=(current:Writable):number=>{
        if(typeof current!=='number') throw new Error('Level state unknown.');
        if(request.operation==='toggle')return dbToLevel(request.durationMs || previousDestination!==undefined?toggleDb:toggleLevelDb(current)!);
        if(request.operation==='set') return dbToLevel(request.db);
        return relativeLevel(current,request.db);
      };
      if(!request.durationMs) return this.enqueue(path,goal);
      // A superseded fade's outstanding echo still belongs to this target. Accept it
      // while the replacement waits in the queue, then start from that confirmed level.
      const expected=[currentLevel];
      if(this.pending?.path===path && typeof this.pending.desired==='number')expected.push(this.pending.desired);
      const fade:Fade={path,epoch:this.epoch,abort:new AbortController(),expected,destination:goal(currentLevel)};
      this.fades.set(path,fade); this.emit('change');
      return this.runFade(fade,goal,request.durationMs);
    } catch(error) {return Promise.reject(error);}
  }
  private async runFade(fade:Fade, goal:(current:Writable)=>number, duration:number):Promise<void> {
    try {
      let from=0, to=0;
      await this.enqueue(fade.path,current=>{ if(typeof current!=='number') throw new Error('Level unknown.'); from=current; to=goal(current); fade.destination=to; fade.expected=[current]; return current; },fade);
      const started=performance.now();
      while(!equal(from,to)) {
        await this.pause(50,fade);
        if(fade.epoch!==this.epoch || fade.abort.signal.aborted) throw new CommandCancelled('Fade stopped.');
        const progress=Math.min(1,(performance.now()-started)/duration);
        const value=progress===1?to:from+(to-from)*(1-Math.cos(Math.PI*progress))/2;
        await this.enqueue(fade.path,()=>value,fade);
        if(progress===1) break;
      }
    } finally {
      if(this.fades.get(fade.path)===fade) this.fades.delete(fade.path);
      this.emit('change');
    }
  }
  private pause(ms:number,fade:Fade):Promise<void> {
    return new Promise((resolve,reject)=>{
      if(fade.abort.signal.aborted) {reject(new CommandCancelled('Fade stopped.')); return;}
      const cancel=()=>{clearTimeout(timer); reject(new CommandCancelled('Fade stopped.'));};
      const timer=setTimeout(()=>{fade.abort.signal.removeEventListener('abort',cancel); resolve();},ms);
      fade.abort.signal.addEventListener('abort',cancel,{once:true});
    });
  }
  private stopFade(path:string):void {
    const fade=this.fades.get(path); if(!fade) return;
    this.fades.delete(path); fade.abort.abort();
    const keep:Command[]=[];
    for(const command of this.queue) {if(command.owner===fade) command.reject(new CommandCancelled('Fade stopped.')); else keep.push(command);}
    this.queue=keep; this.emit('change');
  }
  private enqueue(path:string,compute:Command['compute'],owner?:Fade):Promise<void> {
    const current=this.parameters.get(path);
    if(this.status!=='online' || (typeof current!=='number' && typeof current!=='boolean')) return Promise.reject(new Error('Mixer state unknown; no command sent.'));
    if(owner?.abort.signal.aborted) return Promise.reject(new CommandCancelled('Fade stopped.'));
    if(this.queue.length>=32) return Promise.reject(new Error('Too many key presses; command discarded.'));
    return new Promise((resolve,reject)=>{
      this.queue.push({path,compute,epoch:this.epoch,expires:Date.now()+this.options.queueAgeMs,owner,resolve,reject}); void this.drain();
    });
  }
  private async drain():Promise<void> {
    if(this.draining) return; this.draining=true;
    try {
      while(this.queue.length) {
        const command=this.queue.shift()!;
        if(command.epoch!==this.epoch || this.status!=='online' || Date.now()>command.expires || command.owner?.abort.signal.aborted) {
          command.reject(command.owner?.abort.signal.aborted?new CommandCancelled('Fade stopped.'):new Error('Expired command discarded.')); continue;
        }
        try {
          const current=this.parameters.get(command.path);
          if(typeof current!=='boolean' && typeof current!=='number') throw new Error('State unknown.');
          const desired=command.compute(current);
          if(equal(current,desired)) {command.resolve(); continue;}
          if(command.owner && typeof desired==='number') command.owner.expected=[...command.owner.expected,desired].slice(-3);
          await new Promise<void>((resolve,reject)=>{
            let done=false;
            const finish=(error?:Error)=>{if(done)return; done=true; clearTimeout(timer); this.pending=undefined; error?reject(error):resolve();};
            const timer=setTimeout(()=>{finish(new Error('No confirmation.')); this.lost('Change unconfirmed; reading state again.');},this.options.ackMs);
            this.pending={path:command.path,desired,owner:command.owner,finish}; this.emit('change');
            try {
              const channel=mainChannel(command.path);
              if(channel!==undefined && typeof desired==='boolean') this.transport!.setMute(channel,desired);
              else if(this.transport!.setParameter) this.transport!.setParameter(command.path,desired);
              else throw new Error('Transport does not support parameters.');
            } catch {finish(new Error('Send failed.')); this.lost('Send failed.');}
          });
          command.resolve();
        } catch(error) {command.reject(error as Error);}
        this.emit('change');
      }
    } finally {this.draining=false;}
  }
}
