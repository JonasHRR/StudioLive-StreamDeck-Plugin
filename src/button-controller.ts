import { mode } from './types.js';
import { CommandCancelled, MixerService, type ChannelView } from './mixer-service.js';
import { levelRequest, target, targetLabel, targetScope,type LevelRequest } from './controls.js';
import { keySvg } from './presentation.js';
import {levelLabel,type FadeDirection} from './level-label.js';
export type ButtonSettings = { channel?:number|string; mode?:string; name?:string; target?:string; mix?:number|string; autoName?:boolean; actionType?:string; operation?:string; db?:number|string; duration?:number|string; fadeLabel?:string; colorMode?:string; customColor?:string };
export interface ButtonSink { setImage(image: string): Promise<void>; setTitle(title: string): Promise<void>; showAlert(): Promise<void> }
type Button = { sink: ButtonSink; settings: ButtonSettings; chain: Promise<void>; alive: boolean; last?: string };
export class ButtonController {
  private buttons = new Map<string, Button>();
  private fadeDirections=new Map<string,FadeDirection>();
  private readonly changed = () => { for (const button of this.buttons.values()) this.render(button); };
  constructor(private readonly mixer: MixerService) { mixer.on('change', this.changed); }
  appear(id: string, sink: ButtonSink, settings: ButtonSettings): void {
    this.disappear(id);
    const button: Button = { sink, settings, chain: Promise.resolve(), alive: true };
    this.buttons.set(id, button); this.render(button);
  }
  disappear(id: string): void { const old = this.buttons.get(id); if (old) old.alive = false; this.buttons.delete(id); }
  update(id: string, settings: ButtonSettings): void { const button = this.buttons.get(id); if (button) { button.settings = settings; this.render(button); } }
  async press(settings: ButtonSettings, sink: ButtonSink): Promise<void> {
    try {
      const t=target(settings.target ?? 'line',settings.channel ?? 1,settings.mix ?? 1);
      if(settings.actionType==='level') await this.mixer.executeLevel(levelRequest(t,settings.operation ?? 'stop',settings.db ?? 0,Number(settings.duration ?? 0)*1000));
      else await this.mixer.executeMute(t,mode(settings.mode));
    }
    catch(error) { if(!(error instanceof CommandCancelled)) await sink.showAlert().catch(() => {}); }
  }
  private render(button: Button): void {
    button.chain = button.chain.then(async () => {
      if (!button.alive) return;
      let t=target(); let invalid=false;
      let request:LevelRequest|undefined;
      const settings=button.settings, level=settings.actionType==='level';
      let view:ChannelView={status:this.mixer.status,pending:false,reason:this.mixer.reason};
      try {
        t=target(settings.target ?? 'line',settings.channel ?? 1,settings.mix ?? 1);
        if(level) request=levelRequest(t,settings.operation ?? 'stop',settings.db ?? 0,Number(settings.duration ?? 0)*1000); else mode(settings.mode);
        view=this.mixer.viewTarget(t,level);
      } catch { invalid=true; }
      const own=typeof settings.name==='string'?settings.name.trim():'';
      const name=own || (settings.autoName===false?'':view.name ?? '');
      let badge='LEVEL';
      let inactive=false;
      if(request){
        const key=JSON.stringify(request);
        const result=levelLabel(request,view.level,this.fadeDirections.get(key),view.fadeTarget,view.pending);badge=result.label;inactive=result.inactive===true;
        if(result.direction){
          this.fadeDirections.delete(key);this.fadeDirections.set(key,result.direction);
          if(this.fadeDirections.size>128)this.fadeDirections.delete(this.fadeDirections.keys().next().value!);
        }
      }
      const svg=keySvg(t.channel,name,view,invalid,{label:targetLabel(t),scope:level?badge:targetScope(t),level,inactive,customColor:settings.colorMode==='custom'?settings.customColor:undefined});
      if (svg === button.last) return;
      await button.sink.setTitle('');
      if (!button.alive) return;
      await button.sink.setImage(`data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`); button.last = svg;
    }).catch(() => { button.last = undefined; });
  }
  async flushed(): Promise<void> { await Promise.all([...this.buttons.values()].map(button => button.chain)); }
  dispose(): void { this.mixer.off('change', this.changed); for (const id of this.buttons.keys()) this.disappear(id); }
}
