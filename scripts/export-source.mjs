import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { zip } from './zip.mjs';
import { publicSource } from './public-source.mjs';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const entries=await publicSource();
await mkdir('release',{recursive:true});
await writeFile(`release/StudioLive-Mutes-${version}-source.zip`,zip(entries));
console.log(`Exported ${entries.length} public source files for version ${version}.`);
