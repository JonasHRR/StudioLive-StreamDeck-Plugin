# Architecture and source review — version 1.0

Historical record from October 16, 2026, translated into English for the public release. Version 1.0 controlled input Main mutes only. The current implementation is described in [Architecture](ARCHITECTURE.md).

## Runtime and layers

The Windows plugin used Elgato SDK 3.0.2, CLI 1.10.2, manifest SDK 3 and Stream Deck 7.1 or later. Installed Stream Deck 7.6.0.23012 supplied Node.js 20.20.0. The SDK package declared a minimum of 20.5.1; the reviewed template recommended Node 24. The build explicitly targeted Node 20 and was tested with the installed runtime.

The owned TCP transport handled subscription, ZB/CK initial state, PV feedback, keepalive and complete cleanup. A separate service owned the shared confirmed state, serial command queue, timeouts and reconnect. The button controller handled profile/folder lifecycle and event-specific settings, including Multi-Actions. The local property inspector configured channel, operation and name per action, and the address globally. SDK error-level logging avoided recording settings in ordinary debug output. Diagnosis subscribed and read only. Tests used isolated mixer, TCP and WebSocket simulators.

## Review of the original StudioLive library

Reviewed `@featherbear/presonus-studiolive-api` 1.9.1 and revision `3e02b29a4a5b28695b6e1fad057ec4b4508f915a`, MIT, copyright © 2019–2026 Andrew Wong. The npm distribution and TypeScript source were inspected. Companion 1.6.2 at revision `79eb3afe5a584881000e1531277b9b8c070c1c5c` was a reference; no Companion runtime code was required or copied.

1. `Client.connect` requires SubscriptionReply plus a compressed initial state. `line.chN.mute` is the regular Main mute.
2. `setMute(selector, 'toggle')` inverts a cached value. Repeated calls before feedback can write the same target; the call provides no mixer-confirmation promise. The plugin instead computes toggle when dequeuing and awaits matching feedback.
3. Main input mutes use `line/chN/mute` and Float32LE 1/0. Aux/FX selectors use separate inverted assignments, outside the scope of version 1.0.
4. The reviewed client starts a two-second retry timer independently of `autoreconnect`; close does not completely stop that timer and its keepalive helper. DataClient assumes a complete header, and CK buffers are held at module scope. These lifecycle properties did not provide the required isolation.
5. The plugin therefore owns a narrow transport and uses the library as a pinned development reference. Protocol formats and a rewritten, bounded UBJSON decoder retain MIT attribution. No bridge or additional networking service is installed.

## State, commands and semantics

All 24 Main mute states must be valid before startup completes. Changes during handshake are incorporated. Reconnect creates a fresh transport and fresh state; no queued key presses carry over.

While a write is pending, the last confirmed color remains visible with a waiting indicator. Only a matching PV response confirms the write. A differing value is still authoritative state, but does not confirm the requested target. Bulk snapshots update state without confirming individual writes. Missing confirmation after two seconds discards the connection and triggers synchronization.

There is no atomic toggle, compare-and-swap or command transaction ID used here. A concurrent matching change cannot be distinguished from an echo. Main mute is not a measurement of the whole signal path. Link Aux Mutes, stereo links, groups, DCA and routing can affect other paths. Version 1.0 did not change those settings.

## Sources

- [Elgato SDK](https://docs.elgato.com/streamdeck/sdk/)
- [Elgato manifest](https://docs.elgato.com/streamdeck/sdk/references/manifest/)
- [Elgato packaging](https://docs.elgato.com/streamdeck/cli/commands/pack/)
- [StudioLive API source](https://github.com/featherbear/presonus-studiolive-api)
- [StudioLive API documentation](https://featherbear.cc/presonus-studiolive-api/)
- [Companion reference](https://github.com/featherbear/bitfocus-companion-module-presonus-studiolive)
- [PreSonus: Link Aux Mutes](https://support.presonus.com/hc/en-us/articles/4412589545869-StudioLive-Series-III-How-to-Link-Aux-Mutes-on-StudioLive-Series-III-digital-mixers-Video)
- [PreSonus: recall filters and link behavior](https://support.presonus.com/hc/en-us/articles/115005694626-StudioLive-Series-III-Project-Scene-and-Preset-Recall-Filters)

Reference documentation listed tests on other models, including 16, 16R, 24R and 32SC. That did not establish full compatibility with the StudioLive 24 console or the reported firmware. The actual read-only check is recorded separately in the historical test report.
