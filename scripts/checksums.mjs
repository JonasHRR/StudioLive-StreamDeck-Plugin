import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const files=['de.local.studiolive-mutes.streamDeckPlugin',`StudioLive-Mutes-${version}-source.zip`];
const lines=await Promise.all(files.map(async name=>`${createHash('sha256').update(await readFile(`release/${name}`)).digest('hex')}  ${name}`));
await writeFile('release/SHA256SUMS.txt',lines.join('\n')+'\n');
console.log(`SHA-256 checksums written for version ${version}.`);
