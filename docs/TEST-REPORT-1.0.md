# Test report — StudioLive Main Mutes 1.0.0

Historical record from October 16, 2026, translated into English for the public release. Real control-write acceptance remained open; no private mixer address is included.

## Environment

- Windows 11 Pro 23H2, build 22631.6199. The historical registry product name reported Windows 10 Pro; the build identified Windows 11.
- Stream Deck 7.6.0.23012; a normal 15-key device was visible in its UI.
- Development: Node.js 22.23.2/npm 10.9.8. Runtime: bundled Stream Deck Node.js 20.20.0, explicitly selected in the manifest.
- Pinned direct dependencies, lockfile and third-party notices included. npm reported zero known vulnerabilities during initial installation; that was a point-in-time result, not a security certification.
- Initially empty project directory; no existing repository or instructions were found. Existing Stream Deck mappings were not overwritten.

## Automated checks without real hardware

All 18 tests passed under both development Node and the installed Stream Deck Node runtime:

- On/off/toggle, repeated explicit on/off and authoritative external state updates.
- Duplicate buttons, rapid globally ordered toggles and pending-state presentation.
- Unknown startup state, disconnect during a command, queue cancellation, fresh reconnect and stale-event isolation.
- Missing/wrong confirmation, timeout without toggle retry, invalid IP/channel/operation.
- Profile/folder changes, reappearance, restart, listener cleanup and explicit Multi-Actions.
- Main-mute wire path and Float32 encoding, ZB snapshots, CK chunks, arbitrary TCP fragmentation and malformed-data rejection.
- Bounded handshake, keepalive and socket shutdown without hidden reconnect.
- Property-inspector registration, loading and persistence of per-action and global settings.
- Built plugin running as a separate process with the real SDK against local simulated Stream Deck and mixer hosts: registration, SVG output, duplicate buttons, external changes, Multi-Actions and profile lifecycle.

These simulations did not establish complete real-console compatibility and never sent real mixer control writes.

## Installed Stream Deck software

The plugin was linked with the official CLI and became visible after a full application restart. Its process ran under Stream Deck Node.js 20.20.0 and registered successfully. The then-German inspector displayed channel selection 1–24, operations and the configured global address. A dynamic green input-1 button showed the state read from the real mixer; the agent did not trigger a key press.

A restart request without developer mode was initially ignored, as confirmed from process start times. Developer mode was temporarily enabled, an actual process reload verified, and the mode restored afterward. Type checking, build, official validation and packaging passed. The double-click installation dialog itself was not separately exercised; UI testing used the official linked development directory.

## Real StudioLive: read-only

The user identified a StudioLive 24 Series III console with firmware 3.4.0.111374; these identifiers were not independently queried.

- Direct TCP connection to the configured mixer succeeded.
- Subscription acknowledgment and all 24 valid input Main mute states were received.
- Diagnosis printed channel states without the IP address.
- A seven-second keepalive observation completed without disconnecting.
- The same transport read the input-1 state for the live Stream Deck button.
- No agent-triggered mute, routing, gain, phantom power, scene or firmware changes were performed.

## Open hardware acceptance at that time

After explicit authorization of a suitable channel and time: verify external mixer/Universal Control updates, correct on/off/toggle control and feedback, explicit Multi-Actions, controlled disconnect with no replayed offline presses, and model-specific Link Aux Mutes/stereo behavior. Restore the intended initial state after any approved control test.

The original implementation does not claim that an unmuted Main parameter guarantees audibility on every output. See the current test report for later user feedback and read-only capability checks.
