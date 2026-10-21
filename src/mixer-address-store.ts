import {mkdir,open,readFile,rename,rm,stat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import type {MixerAddressStore} from './mixer-settings.js';

export function mixerAddressFile():string {
  return join(process.env.LOCALAPPDATA ?? join(homedir(),'AppData','Local'),'StudioLive-StreamDeck-Plugin','mixer-settings.json');
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
