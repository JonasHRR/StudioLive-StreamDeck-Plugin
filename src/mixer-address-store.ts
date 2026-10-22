import {mkdir,open,readFile,rename,rm,stat} from 'node:fs/promises';
import {dirname,posix,win32} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import type {MixerAddressStore} from './mixer-settings.js';

export function mixerAddressFile(platform:NodeJS.Platform=process.platform,home=homedir(),environment:Partial<Pick<NodeJS.ProcessEnv,'LOCALAPPDATA'>>=process.env):string {
  if(platform==='darwin') return posix.join(home,'Library','Application Support','StudioLive-StreamDeck-Plugin','mixer-settings.json');
  const path=platform==='win32'?win32:posix;
  return path.join(environment.LOCALAPPDATA ?? path.join(home,'AppData','Local'),'StudioLive-StreamDeck-Plugin','mixer-settings.json');
}
export class FileMixerAddressStore implements MixerAddressStore {
  constructor(private readonly path=mixerAddressFile()){}
  async read():Promise<unknown>{
    try{
      if((await stat(this.path)).size>4096)return;
      const data=JSON.parse(await readFile(this.path,'utf8'));
      return data?.version===1?data.ip:undefined;
    }catch{return;}
  }
  async write(ip:string):Promise<void>{
    await mkdir(dirname(this.path),{recursive:true});
    const temp=`${this.path}.${randomUUID()}.tmp`;
    try{
      const file=await open(temp,'wx');
      try{await file.writeFile(JSON.stringify({version:1,ip})+'\n','utf8');await file.sync();}finally{await file.close();}
      await rename(temp,this.path);
    }finally{await rm(temp,{force:true});}
  }
}
