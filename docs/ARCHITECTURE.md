# Architecture and source review

Recorded on October 16, 2026. One direct Windows plugin using Elgato SDK 3.0.2 and CLI 1.10.2. The manifest targets SDK 3 and Stream Deck 7.1 or later, with the installed Node.js 20 runtime. Development uses Node.js 22.23.2. Dependencies and protocol behavior were retained for the English release.

## Layers

- `types.ts` defines an interchangeable mixer transport and state types without Elgato dependencies.
- `controls.ts` validates targets, maps allowlisted paths, inverts send-assignment mute semantics and converts approximate dB values.
- `ubjson.ts` and `protocol.ts` implement bounded parsing, packet framing, snapshots and parameter feedback.
- `studiolive.ts` owns one TCP session, handshake, subscriptions, snapshot assembly, keepalive and cleanup.
- `mixer-service.ts` shares confirmed state, owns reconnect and serializes commands across buttons.
- `button-controller.ts` handles visible instances, event settings and ordered image updates.
- `presentation.ts` creates escaped SVG images. User and mixer names are treated as data.
- `plugin.ts` registers both actions and manages global settings. `ui/` is a local English property inspector without remote scripts or fonts.
- `diagnose.ts` subscribes and reads only. It has no control-write path.

## State and protocol

Snapshots retain the 24 input Main mutes plus an allowlisted map of supported mutes, send assignments, faders and names. A connection becomes online only after all 24 input Main mute states are valid. Each additional target must provide its own valid state before it can be controlled. Missing optional targets do not invalidate other targets.

UCNet traffic uses the configured IPv4 address and TCP 53000. Handshake completion requires both subscription acknowledgment and an initial state. Packet framing accepts arbitrary TCP fragmentation. ZB snapshots and CK chunks are bounded to 8 MiB compressed and 32 MiB decompressed; chunk order and offsets are checked. UBJSON decoding checks bounds, lengths and nesting depth and uses null-prototype objects.

PV messages provide Boolean parameters and normalized fader values; PS messages provide names. MS/fdrs messages provide 16-bit fader positions, not audio meters. Channel offsets and buffer boundaries are checked. Nested DCA volume values cannot overwrite channel faders. Names are cleaned, bounded and escaped for SVG. `username` is preferred over `name`.

From 1.3.0, allowlisted channel/bus/return `color` fields are a separate read-only kind. Snapshots encode RGBA in the low 32 bits of an integer, with little-endian byte order; PC feedback carries four RGBA bytes. These normalize to bounded RGB hex strings, with an empty value for transparent/unassigned colors. Invalid optional colors are ignored. PV and PS cannot supply color values, and the write encoder accepts only Boolean and numeric control kinds, so adding color reads does not enable color writes.

## Confirmed commands and reconnect

The shared queue computes a command from the current confirmed value only when it reaches the front. At most one write awaits confirmation; the queue is bounded to 32 entries with a maximum age of 5 seconds. A matching direct reply confirms the write. The display never treats a local color change as success. Numeric confirmation allows four 16-bit steps of tolerance for quantization and Float32 feedback.

A snapshot remains authoritative but does not confirm a specific pending command. An unexpected or absent reply does not trigger a blind retry. After 2 seconds without confirmation, the connection and queue are discarded and state is reread. Disconnects cancel fades and queued work. Connection generations ignore stale callbacks. Offline key presses are rejected, and old commands never migrate to a new connection.

Connect/snapshot attempts time out after 8 seconds. Reconnect backoff starts at 0.5 seconds and is capped at 10 seconds. Keepalive detects a silent disconnect in approximately 6 seconds. Clean close removes sockets, listeners and timers.

The protocol provides no command transaction ID used here, atomic toggle or compare-and-swap. A simultaneous matching change by another controller cannot be distinguished from an echo. Feedback therefore confirms observed state without guaranteeing exclusive control.

## Mute targets

Main input mutes use `line/chN/mute`, with Float32LE 1/0. Bus and return mutes have their own allowlisted paths. Existing groups use `mutegroup/mutegroupN`. Input-to-Aux/FX send mutes use inverted `assign_auxN` or `assign_fxN` assignment values. No routing, gain, phantom power, scene, firmware or group membership controls are exposed.

An unmuted parameter does not establish that the entire signal path is audible. Link Aux Mutes, stereo links, mute groups, DCA, routing and fader positions may affect other paths. Link settings are neither read nor changed by this plugin.

## Levels and fades

The empirical polynomial from the MIT reference implementation maps approximate dB values to normalized fader positions. Regular targets are −60 to +10 dB; −84 means the floor. Relative steps are limited to ±12 dB. An upward step from the floor begins near −60 dB; a step below −60 moves to the floor. The displayed scale is approximate, not a calibrated measurement.

Version 1.5.1 corrects unity using a read-only snapshot from input 2, whose mixer display the user confirmed at exactly 0 dB: `volume = 0.74609375 = 191/256`. The original polynomial yielded about 0.7252 for 0 dB; the user observed −0.82 dB at that position. Below unity, the polynomial output is scaled to the measured anchor; above unity, its remaining range is scaled between the anchor and top position 1. Both pieces meet continuously and are monotonic over the supported range. Inverse conversion uses the corrected curve, including an exact unity return of 0 dB. This preserves the approximate curve shape without a discontinuity around zero. The unity Float32 bytes are `00 00 3f 3f`. Other points and other models have not been fully calibrated; no real mixer control writes were used to obtain the anchor. Display rounding suppresses negative zero around quantized unity feedback.

A fade interpolates normalized positions with a cosine ease-in/ease-out curve. It submits a step no sooner than every 50 ms and waits for confirmation. Steps are not accumulated when replies are slow, so actual duration may increase. Fade plans live outside the shared queue and submit one step at a time; other mutes remain usable and different targets may fade concurrently.

A new level command on the same target, explicit stop, bulk snapshot, disconnect, or detected external fader move cancels the plan. Recent expected values are retained to recognize delayed echoes, so some concurrent external moves remain indistinguishable. Stop sends no new value and cannot recall a value already transmitted. A following command waits for any outstanding echo or timeout. No fade resumes after reconnect.

From 1.5.0, the `toggle` level operation selects 0 dB when the confirmed level is at the floor (within confirmation tolerance), otherwise the floor. When a fade is active, it reverses that fade's destination. Fade plans expose their destination for consistent previews and rapid reversal before the first step. No alternating flag is persisted or stored per button. A replacement fade recognizes the current value and any outstanding write's expected echo while its initial read waits in the shared queue; it then starts from the newly confirmed position. Instant toggles compute from the confirmed value at the front of the queue. Existing cancellation, unknown-state rejection and reconnect rules apply.

## Stream Deck and display

Plugin and action UUIDs stay unchanged for profile compatibility. Event-specific settings are used for key presses and Multi-Actions. Duplicate keys share confirmed state. The SDK logger is restricted to errors to avoid recording global settings in ordinary debug/trace logs.

The mixer/custom name is the top heading, with the target number below. Mutes emphasize MUTE/OPEN. Level buttons emphasize their configured function and show the confirmed current level below. From 1.5.1, `level-label.ts` reserves FADE OUT / FADE IN exclusively for the toggle operation. All fixed targets, including the floor and 0 dB, compare normalized goal and confirmed current position for FADE DOWN / UP. Relative steps use FADE DOWN/UP by sign. From 1.5.2, idle fixed/relative fades whose computed goal lies within four 16-bit steps of the confirmed position show FADE -- with gray function text. `relativeLevel` is shared with execution so zero steps and clamped bounds have the same semantics. Pending work, missing state, instant changes and toggle actions never receive this inactive marker. From 1.6.0, per-button colorMode/customColor preferences select automatic mixer colors or a validated six-digit hex normal color. Custom color has priority over mixer color; active mute remains red and unknown/offline remains gray. An inactive fade blends that current color with 65% white and uses gray text #303640. Names, confirmed levels and the MUTE indicator remain readable. Leaving the goal restores full color. The inspector exposes both controls for both action types, preserves automatic legacy defaults and retains the custom swatch when returning to automatic mode. Color preferences never affect mixer writes. The controller keeps up to 128 recent direction entries keyed by normalized request for offline display, shared by duplicate keys and across folder changes. Missing current values without history show FADE; known directions remain while offline. This display history does not persist across process restarts and never changes commands. The old `fadeLabel` field is preserved but ignored. WAIT/FADE indicates pending work; invalid or missing state remains visible.

The inspector's fixed-target infinity checkbox maps directly to the existing numeric −84 value. It disables the regular dB input and restores itself for legacy −84 settings. Switching to a relative operation clears the checkbox and uses a valid relative step; no new protocol representation or parameter path is introduced.

The toggle inspector hides numeric endpoint controls and retains a shared duration. Selecting it changes a previous zero duration to 3 seconds; an explicit later edit can still select instant operation. Toggle buttons preview the next press as FADE OUT or FADE IN from shared confirmed state and active destination, or neutral FADE when state is unknown. Merely rendering or changing the settings never sends a level command.

Normal backgrounds now use a valid target color, with send buttons inheriting their input color. Active target mutes override it with red, including on level buttons; unavailable/invalid states override it with gray. No color means the existing green/blue fallback. Relative luminance selects dark or white text; pending yellow borders have a contrasting outline. Colors never affect command computation, fade cancellation or confirmation. Offline state discards colors along with all other connection state.

`192.0.2.1` remains a documentation example only. It is no longer an automatic runtime fallback or saved setting. Since 1.3.1, `mixer-settings.ts` serializes configuration reads/writes, validates the address, and uses a local file as durable configuration. `mixer-address-store.ts` stores only `{version, ip}` in `%LOCALAPPDATA%\StudioLive-StreamDeck-Plugin\mixer-settings.json`, outside the project/plugin folders. Writes use a temporary sibling, file flush and rename; saves are acknowledged only after readback. Missing/corrupt files can migrate a valid SDK global value. An existing file avoids dependence on SDK credentials at startup; a stale, empty or sample global value cannot replace it. SDK globals are a compatibility mirror, with reads bounded to two seconds. A failed local write is reported without claiming success.

The inspector sends IP load/save requests through `sendToPlugin`; the plugin uses the official SDK context for global settings and returns a correlated response to the current inspector. A per-inspector nonce prevents stale replies being accepted after reopening. Button settings and PI-originated messages use the registration UUID supplied to that inspector connection, not `actionInfo.context`. Replacing that context during the unfinished persistence change prevented edits reaching Stream Deck and was corrected in 1.3.1. The inspector shows a save confirmation only after the plugin's verified response, and shows timeout/failure explicitly. No address or user name is embedded in public source examples. Source exports use an explicit inventory; public-file checks also inspect the generated plugin. Historical private deliveries remain outside that inventory.

## References and licenses

The original library review is retained in [Architecture 1.0](ARCHITECTURE-1.0.md). Reviewed versions: StudioLive API 1.9.1, revision `3e02b29a4a5b28695b6e1fad057ec4b4508f915a`, MIT, Andrew Wong; Companion reference 1.6.2, revision `79eb3afe5a584881000e1531277b9b8c070c1c5c`, MIT. Subscription, mute paths/inversion, PV/PS/MS and the fader curve were compared with those sources. The original client remains a development reference because its lifecycle does not provide the required isolation.

- [StudioLive API source](https://github.com/featherbear/presonus-studiolive-api)
- [StudioLive API documentation](https://featherbear.cc/presonus-studiolive-api/)
- [Companion reference](https://github.com/featherbear/bitfocus-companion-module-presonus-studiolive)
- [Elgato SDK](https://docs.elgato.com/streamdeck/sdk/)
- [Elgato manifest](https://docs.elgato.com/streamdeck/sdk/references/manifest/)
- [Elgato packaging](https://docs.elgato.com/streamdeck/cli/commands/pack/)

See the [test report](../TEST-REPORT.md) for the distinction between simulation, local software inspection and real read-only hardware checks.
