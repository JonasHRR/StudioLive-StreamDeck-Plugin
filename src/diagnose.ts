import { StudioLiveTransport } from './studiolive.js';
import { ipv4 } from './types.js';
import { DEFAULT_IP } from './defaults.js';

// No setMute call or any write control path in this program. Handshake and keepalive only.
const transport = new StudioLiveTransport(8000);
const observe = process.argv.includes('--observe');
const capabilities = process.argv.includes('--capabilities');
const deadline = setTimeout(() => { transport.close(); process.exitCode = 1; }, observe ? 17000 : 10000);
let disconnected = false;
try {
  const ip = ipv4(process.argv.slice(2).find(arg => !['--observe','--capabilities'].includes(arg)) ?? DEFAULT_IP);
  const values = await transport.open(ip, { state() {}, snapshot() {}, disconnected() { disconnected = true; } });
  console.log('Read-only diagnosis: subscription and 24 input mute states received.');
  console.table([...values].map(([channel, muted]) => ({Channel: channel, MainMute: muted ? 'MUTE' : 'OPEN'})));
  if (capabilities) {
    const paths=[...(values.parameters?.keys() ?? [])];
    const groups=[['Input levels',/^line\/ch\d+\/volume$/],['Mixer name fields',/\/(username|name)$/],['Mute groups',/^mutegroup\/mutegroup[1-8]$/],['Main mutes',/^main\/ch1\/mute$/],['Sub mutes',/^sub\/ch\d+\/mute$/],['Aux bus mutes',/^aux\/ch\d+\/mute$/],['FX bus mutes',/^fxbus\/ch\d+\/mute$/],['FX return mutes',/^fxreturn\/ch\d+\/mute$/],['Aux send states',/\/assign_aux\d+$/],['FX send states',/\/assign_fx\d+$/]] as const;
    console.table(groups.map(([Function,pattern])=>({Function,ReceivedParameters:paths.filter(path=>pattern.test(path)).length})));
  }
  if (observe) {
    await new Promise(resolve => setTimeout(resolve, 7000));
    if (disconnected) throw new Error('Observation interrupted.');
    console.log('Read-only connection remained active for 7 seconds with keepalive.');
  }
  console.log('This does not verify write compatibility or Link Aux Mutes behavior.');
} catch {
  console.error('Read-only diagnosis failed: TCP/subscription/24 states not received within 8 seconds. The IP address was not logged.');
  process.exitCode = 1;
} finally { clearTimeout(deadline); transport.close(); }
