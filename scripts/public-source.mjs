import { readFile, readdir } from 'node:fs/promises';

// Explicit source inventory: local research, settings, logs and old releases stay out.
const files=['.gitattributes','.gitignore','package.json','package-lock.json','tsconfig.json','LICENSE','THIRD_PARTY_NOTICES.md','README.md','CHANGELOG.md','PLAN.md','TEST-REPORT.md'];
const roots=['src','tests','scripts','docs'];
const plugin='de.local.studiolive-mutes.sdPlugin';
export async function publicSource() {
  const selected=[...files,`${plugin}/manifest.json`,`${plugin}/package.json`,`${plugin}/.sdignore`];
  async function walk(path) {
    for(const entry of await readdir(path,{withFileTypes:true})) {
      const name=`${path}/${entry.name}`;
      if(entry.isDirectory()) await walk(name);
      else if(entry.isFile()) selected.push(name);
      else throw new Error(`Unsupported source entry: ${name}`);
    }
  }
  for(const root of [...roots,`${plugin}/ui`,`${plugin}/imgs`]) await walk(root);
  const entries=await Promise.all(selected.sort().map(async name=>({name,data:await readFile(name)})));
  const defaults=entries.find(entry=>entry.name==='src/defaults.ts').data.toString();
  if(!/DEFAULT_IP = '192\.0\.2\.1'/.test(defaults)) throw new Error('Public builds must use the documentation-only default IP.');
  assertPublic(entries);
  return entries;
}
export function assertPublic(entries) {
  for(const {name,data} of entries) {
    if(name.endsWith('.png')) continue;
    const text=data.toString();
    if(/\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/.test(text)) throw new Error(`Private network address in public file: ${name}`);
    if(/\b[A-Z]:[\\/]Users[\\/][^\\/\s]+/i.test(text)) throw new Error(`Personal filesystem path in public file: ${name}`);
    if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) throw new Error(`Private key in public file: ${name}`);
  }
}
