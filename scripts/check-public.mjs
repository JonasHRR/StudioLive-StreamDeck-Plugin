import { readFile, readdir } from 'node:fs/promises';
import { publicSource, assertPublic } from './public-source.mjs';
const entries=await publicSource();
const runtime=[];
async function walk(path) {
  for(const entry of await readdir(path,{withFileTypes:true})) {
    const name=`${path}/${entry.name}`;
    if(entry.name==='logs') continue;
    if(entry.isDirectory()) await walk(name);
    else runtime.push({name,data:await readFile(name)});
  }
}
await walk('de.local.studiolive-mutes.sdPlugin');
assertPublic(runtime);
console.log(`Public source and plugin checked: ${entries.length} source files; no private network addresses, personal Windows paths or private keys detected.`);
