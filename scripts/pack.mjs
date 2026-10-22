import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {rename} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const cli=join(dirname(require.resolve('@elgato/cli/package.json')),'bin','streamdeck.mjs');
// The archive keeps the existing UUID internally; only its download name changes.
execFileSync(process.execPath,[cli,'pack','de.local.studiolive-mutes.sdPlugin','--output','release','--force','--no-update-check'],{stdio:'inherit',windowsHide:true});
await rename('release/de.local.studiolive-mutes.streamDeckPlugin','release/StudioLive-Control.streamDeckPlugin');
console.log('Installer: release/StudioLive-Control.streamDeckPlugin');
