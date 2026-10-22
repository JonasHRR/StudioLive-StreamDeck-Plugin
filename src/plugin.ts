import streamDeck, { action, SingletonAction, type DidReceiveSettingsEvent, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent } from '@elgato/streamdeck';
import { StudioLiveTransport } from './studiolive.js';
import { MixerService } from './mixer-service.js';
import { ButtonController, type ButtonSettings } from './button-controller.js';
import {MixerSettings} from './mixer-settings.js';
import {FileMixerAddressStore} from './mixer-address-store.js';

// Prevent SDK debug/trace output from recording global settings, including the private IP.
streamDeck.logger.setLevel('error');
const mixer = new MixerService(() => new StudioLiveTransport());
const buttons = new ButtonController(mixer);
const mixerSettings=new MixerSettings({
  get:()=>streamDeck.settings.getGlobalSettings(),
  set:settings=>streamDeck.settings.setGlobalSettings(settings as Parameters<typeof streamDeck.settings.setGlobalSettings>[0])
},new FileMixerAddressStore(),ip=>mixer.configure(ip));
class DeckAction extends SingletonAction<ButtonSettings> {
  constructor(private readonly actionType:'mute'|'level') {super();}
  private settings(settings:ButtonSettings):ButtonSettings {return {...settings,actionType:this.actionType};}
  override onWillAppear(ev: WillAppearEvent<ButtonSettings>): void {
    if (ev.action.isKey()) buttons.appear(ev.action.id, ev.action, this.settings(ev.payload.settings));
  }
  override onWillDisappear(ev: WillDisappearEvent<ButtonSettings>): void { buttons.disappear(ev.action.id); }
  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<ButtonSettings>): void { buttons.update(ev.action.id, this.settings(ev.payload.settings)); }
  override async onKeyDown(ev: KeyDownEvent<ButtonSettings>): Promise<void> {
    if (ev.action.isKey()) await buttons.press(this.settings(ev.payload.settings), ev.action);
  }
}
@action({UUID:'de.local.studiolive-mutes.channel'})
class MuteAction extends DeckAction {constructor(){super('mute');}}
@action({UUID:'de.local.studiolive-mutes.level'})
class LevelAction extends DeckAction {constructor(){super('level');}}
streamDeck.actions.registerAction(new MuteAction());
streamDeck.actions.registerAction(new LevelAction());
let namesSubscription:{actionId:string;requestId:string;last?:string}|undefined;
function publishTargetNames():void {
  const subscription=namesSubscription;
  if(!subscription)return;
  if(streamDeck.ui.action?.id!==subscription.actionId){namesSubscription=undefined;return;}
  const names=mixer.targetNames(),serialized=JSON.stringify(names);
  if(serialized===subscription.last)return;
  subscription.last=serialized;
  void streamDeck.ui.sendToPropertyInspector({type:'targetNames',requestId:subscription.requestId,names}).catch(()=>{subscription.last=undefined;});
}
mixer.on('change',publishTargetNames);
streamDeck.ui.onDidDisappear(()=>{if(streamDeck.ui.action?.id!==namesSubscription?.actionId)namesSubscription=undefined;});
streamDeck.settings.onDidReceiveGlobalSettings(ev => {void mixerSettings.changed(ev.settings).catch(()=>streamDeck.logger.error('Mixer address could not be saved locally.'));});
streamDeck.ui.onSendToPlugin(ev=>{
  const payload=ev.payload;
  if(!payload || typeof payload!=='object' || Array.isArray(payload) || typeof payload.requestId!=='string')return;
  if(payload.type==='targetNames'){
    if(payload.requestId.length>128 || streamDeck.ui.action?.id!==ev.action.id)return;
    namesSubscription={actionId:ev.action.id,requestId:payload.requestId};publishTargetNames();return;
  }
  if(payload.type!=='mixerSettings')return;
  const requestId=payload.requestId;
  const work=payload.operation==='save'?mixerSettings.save(payload.ip):payload.operation==='load'?mixerSettings.load():undefined;
  if(!work)return;
  const reply=(result:Record<string,unknown>)=>{
    if(streamDeck.ui.action?.id===ev.action.id)void streamDeck.ui.sendToPropertyInspector({type:'mixerSettings',requestId,...result} as Parameters<typeof streamDeck.ui.sendToPropertyInspector>[0]);
  };
  void work.then(settings=>reply({ok:true,settings})).catch(()=>reply({ok:false,message:'Mixer IP could not be saved on this computer. Check the address and try again.'}));
});
process.once('SIGTERM', () => { buttons.dispose(); mixer.stop(); });
process.once('SIGINT', () => { buttons.dispose(); mixer.stop(); });
void streamDeck.connect().then(async () => {
  await mixerSettings.load();
}).catch(() => { streamDeck.logger.error('Stream Deck connection failed.'); mixer.stop(); });
