import {ipv4} from './types.js';
import {DEFAULT_IP} from './defaults.js';

export interface MixerSettingsHost {get():Promise<Record<string,unknown>>;set(settings:Record<string,unknown>):Promise<void>}
export interface MixerAddressStore {read():Promise<unknown>;write(ip:string):Promise<void>}
export function mixerAddress(value:unknown):string|undefined {
  try {const ip=ipv4(value);return ip===DEFAULT_IP?undefined:ip;} catch{return;}
}

/** The local file is durable configuration; SDK globals are a compatibility mirror. */
export class MixerSettings {
  private current?:string;
  private queue:Promise<unknown>=Promise.resolve();
  constructor(private readonly host:MixerSettingsHost,private readonly store:MixerAddressStore,private readonly configure:(ip:string|undefined)=>void,private readonly readTimeoutMs=2000){}
  private serial<T>(work:()=>Promise<T>):Promise<T>{
    const result=this.queue.then(work);this.queue=result.catch(()=>{});return result;
  }
  private async globals():Promise<Record<string,unknown>>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{const value=await Promise.race([this.host.get(),new Promise<Record<string,unknown>>(resolve=>{timer=setTimeout(()=>resolve({}),this.readTimeoutMs);})]);return value && typeof value==='object' && !Array.isArray(value)?value:{};}
    catch{return {};}
    finally{clearTimeout(timer);}
  }
  private apply(ip:string|undefined):void{if(this.current!==ip || !ip){this.current=ip;this.configure(ip);}}
  load():Promise<{ip:string}>{return this.serial(async()=>{
    let cached:string|undefined;try{cached=mixerAddress(await this.store.read());}catch{}
    // Connect immediately from the durable local value, even if SDK settings are unavailable.
    if(cached){this.apply(cached);return {ip:cached};}
    const globals=await this.globals();
    const ip=mixerAddress(globals.ip);
    if(ip) {try{await this.store.write(ip);}catch{/* Retain a usable SDK value; explicit save will report write failures. */}}
    this.apply(ip);
    return {ip:ip ?? ''};
  });}
  value():{ip:string}{return {ip:this.current ?? ''};}
  save(input:unknown):Promise<{ip:string}>{return this.serial(async()=>{
    const ip=mixerAddress(input);if(!ip)throw new Error('Enter the actual mixer IPv4 address; the example address cannot be saved.');
    await this.store.write(ip);
    if(mixerAddress(await this.store.read())!==ip)throw new Error('The local mixer address could not be verified.');
    this.apply(ip);
    const globals=await this.globals();
    try{await this.host.set({...globals,ip});}catch{/* The verified local file remains authoritative. */}
    return {ip};
  });}
  changed(settings:Record<string,unknown>):Promise<void>{return this.serial(async()=>{
    const ip=mixerAddress(settings.ip);
    // Empty SDK events and old example defaults must never erase a known working address.
    if(!ip || ip===this.current)return;
    await this.store.write(ip);this.apply(ip);
  });}
}
