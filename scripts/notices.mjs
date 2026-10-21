import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
const lock = JSON.parse(await readFile('package-lock.json','utf8'));
let text = `# Third-party notices\n\nRuntime dependencies are bundled; development tools are not needed for installation.\n\nThe UCNet framing, subscription, keepalive and mute encoding follow Andrew Wong's MIT-licensed presonus-studiolive-api 1.9.1. src/ubjson.ts is a rewritten, bounds-checked derivative of src/lib/util/zlib/ubjson.ts at revision 3e02b29a4a5b28695b6e1fad057ec4b4508f915a. Copyright © 2019–2026 Andrew Wong.\n\nSource: https://github.com/featherbear/presonus-studiolive-api\nCompanion reference (no code copied): https://github.com/featherbear/bitfocus-companion-module-presonus-studiolive revision 79eb3afe5a584881000e1531277b9b8c070c1c5c, MIT, Copyright (c) 2025 Andrew Wong.\n\n## StudioLive API / derived code: MIT license\n\nCopyright © 2019–2026 Andrew Wong\n\n`;
text += (await readFile('LICENSE','utf8')).split('\n').slice(4).join('\n');
for (const [path, metadata] of Object.entries(lock.packages)) {
  if (!path || !existsSync(path)) continue;
  const pkg = JSON.parse(await readFile(`${path}/package.json`,'utf8'));
  text += `\n\n## ${pkg.name} ${pkg.version} (${pkg.license || metadata.license || 'see package'})\n\n`;
  const files = readdirSync(path).filter(n => /^(license|licence|copying|notice)(\.|$)/i.test(n));
  if (!files.length) { text += `No separate license text in npm distribution; declared license: ${pkg.license || metadata.license}.\n`; continue; }
  for (const file of files) text += `\n${file}\n\n` + await readFile(`${path}/${file}`,'utf8');
}
await writeFile('THIRD_PARTY_NOTICES.md',text);
