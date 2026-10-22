# How the plugin fits together

This is the architecture of **StudioLive Control 1.9.2**. The plugin has one connection to the mixer, one shared view of confirmed state, and two Stream Deck actions. That keeps duplicate buttons in sync and gives reconnects one clear owner.

## Where to look

| File | Responsibility |
|---|---|
| `src/types.ts` | Transport interfaces, snapshots, input-bank completeness and common validation. |
| `src/controls.ts` | Target ranges, allowed paths, send inversion and dB conversion. |
| `src/ubjson.ts`, `src/protocol.ts` | Packet framing, bounded decoding, snapshots and parameter messages. |
| `src/studiolive.ts` | One TCP attempt: subscription, handshake, keepalive and cleanup. |
| `src/mixer-service.ts` | Confirmed state, command queue, fades and reconnects. |
| `src/button-controller.ts`, `src/level-label.ts` | Visible buttons, ordered rendering and fade previews. |
| `src/presentation.ts` | SVG rendering, escaped names and readable colors. |
| `src/mixer-settings.ts`, `src/mixer-address-store.ts` | Serialized settings changes and durable local address storage. |
| `src/plugin.ts` | SDK actions, inspector messages and live name subscriptions. |
| `de.local.studiolive-mutes.sdPlugin/ui/` | Local property inspector with no remote scripts or fonts. |
| `src/diagnose.ts` | Bounded read-only subscription and connection diagnosis. |

The project uses Elgato SDK 3.0.2 and CLI 1.10.2. Development requires Node.js 22.23 or later; the build targets Stream Deck's Node.js 20 runtime.

## From the mixer to a button

The transport connects to the configured IPv4 address on **TCP 53000**. It becomes ready only after both a subscription acknowledgment and a complete initial snapshot.

Snapshots carry the highest declared regular input node as `inputCount`. Both transport and service require a contiguous bank of **16, 24, 32 or 64** valid input mute states. A missing final mute cannot silently turn a declared 64-input bank into a smaller model. Snapshot copies preserve that metadata; older simulator snapshots without it infer the count from the map.

Other targets are optional. Each one needs its own valid feedback before a command can be accepted. Names and colors alone don't make a target controllable.

TCP framing handles fragmented and coalesced packets. Snapshot handling is bounded to 8 MiB compressed and 32 MiB decompressed, with chunk offsets and order checked. The UBJSON decoder checks lengths, bounds and nesting depth and creates objects with null prototypes.

| Message | Used for |
|---|---|
| ZB / CK | Compressed snapshots / chunked snapshots. |
| PV | Boolean parameters and normalized fader values. |
| PS | Names. |
| PC | Read-only RGBA colors. |
| MS / fdrs | Batched 16-bit fader positions, with checked group offsets. |

MS faders are state feedback, not UDP audio meters. Nested DCA values cannot replace a channel's own fader. Names are bounded, cleaned and escaped; `username` takes priority over `name`.

Colors normalize to RGB hex strings. Snapshots carry RGBA in the low 32 bits with little-endian byte order; PC messages carry four bytes. Transparent or unassigned colors use the display fallback. Only Boolean and numeric control kinds can be written.

## From a key press to a confirmed change

A command enters the shared queue and computes its desired value when it reaches the front, using the latest confirmed state. Only **one write** waits for acknowledgment at a time. This is what makes rapid toggles and relative steps behave consistently.

The queue holds up to **32 commands**, each with a maximum age of **5 seconds**. A matching parameter reply confirms a write; numeric comparisons allow **four 16-bit steps** of tolerance. A bulk snapshot is authoritative state but doesn't acknowledge a specific pending command.

If confirmation hasn't arrived after **2 seconds**, the service drops the connection and pending work, then reads fresh state. It doesn't blindly repeat a write whose execution is uncertain. Connection generations ignore stale callbacks, and offline presses never migrate into a later connection.

Connection attempts have an **8-second** deadline. Retries back off from **0.5 seconds** to a **10-second** cap. Keepalive usually detects silent loss in about **6 seconds**.

The protocol has no transaction ID or exclusive fader lock used here. A matching change from another controller can look like an echo. Confirmation establishes the observed state, not exclusive control.

## Targets and compatibility

Regular input mutes use `line/chN/mute`; groups use `mutegroup/mutegroupN`. Input sends invert the Boolean value of `assign_auxN` or `assign_fxN`. The target validator and write encoder share an explicit allowlist.

Additional inputs keep stable stored identifiers:

| Inspector choice | Stored kind / channel | Mixer path |
|---|---|---|
| A1 | `auxinput / 1` | `return/ch1` |
| A2 | `auxinput / 2` | `return/ch2` |
| Tape | `tape / 1` | `return/ch3` |
| Talkback | `talkback / 1` | `talkback/ch1` |

The inspector groups these under **Additional inputs** and maps its visible selection back to the existing kind/channel pair. **Mix bus** retains the stored `aux` target and range 1–16. These UI names don't change saved assignments or wire paths.

For additional inputs, the supported fields are mute, volume, username, name and color; only mute and volume are writable. They don't increase the required regular input bank. Routing, talk destinations, preamp gain, phantom power, scenes, firmware and group membership are outside the exposed controls.

## Levels, fades and labels

The approximate dB curve comes from Andrew Wong's MIT-licensed reference implementation. Fixed targets span **−60 to +10 dB**, with **−84** representing the floor. Relative steps span **±12 dB**. A positive step from the floor starts near −60 dB; a nonzero step below that range goes to the floor. A zero step returns the exact confirmed position.

Unity is anchored at **191/256 = 0.74609375**, from a read-only StudioLive 24 snapshot after the user confirmed 0 dB on the console. Its Float32 wire bytes are `00 00 3f 3f`. The empirical curve is scaled continuously on either side of that point and inverted with the same correction. Other levels and models remain approximate. Display rounding avoids −0.0 dB around unity.

Fades interpolate normalized positions with cosine easing. Each plan submits one step at a time, no sooner than every **50 ms**, and waits for feedback. Slow replies extend the duration instead of building a backlog of steps. Separate targets can fade concurrently through the same queue.

A new level command on the target, stop, bulk snapshot, disconnect or detected external move cancels a fade. Recent expected values help recognize delayed echoes; some external moves remain indistinguishable. Stop sends no new value and cannot retract one already sent. The next command waits for an outstanding echo or timeout.

Toggle fades choose 0 dB at the confirmed floor and the floor elsewhere. During a fade they reverse its destination. The destination lives in shared service state, so duplicate keys preview the same next press and rapid reversal works before the first step. No alternating flag is persisted.

Labels use that same state and conversion logic:

- **FADE IN / OUT** preview toggle actions.
- **FADE UP / DOWN** describe fixed or relative fades.
- **FADE --** marks an idle fixed/relative request whose goal is already within confirmation tolerance.
- Unknown or busy state never claims that a target is reached.

The controller retains up to 128 recent directions for offline display, keyed by normalized request. This history resets at restart. The old `fadeLabel` profile field is preserved but ignored.

## Inspector, names and rendering

Plugin/action UUIDs remain stable. Key presses use the settings carried by that event, including Multi-Actions. Merely opening or editing settings doesn't execute a mixer command.

The service exposes a bounded, online-only name catalog. One active inspector subscribes with a session nonce; the plugin sends changes only when the serialized catalog differs and clears the subscription when that inspector disappears. This reuses the existing mixer connection.

The inspector updates selection labels as text, preserves numeric assignments and unfinished edits, and ignores replies from an old session. Input sends use line names for sources and bus names for destinations. Missing or offline names fall back to numbers.

The renderer uses validated custom colors first, then mixer colors, then green/blue fallbacks. Active target mutes take red priority, and unknown/invalid state is gray. An inactive fade blends the applicable background with **65% white**. Contrast determines light or dark text; a yellow border marks pending work. Display preferences never affect command computation.

## Settings that survive a restart

The durable address file is:

```text
%LOCALAPPDATA%\StudioLive-StreamDeck-Plugin\mixer-settings.json
```

It contains only `{version, ip}`. Writes use a temporary sibling, flush and rename, and an explicit save is acknowledged only after readback. Reads and writes are serialized. A usable local file takes precedence at startup; a missing or corrupt file can migrate a valid SDK global address.

SDK globals remain a compatibility mirror, with reads bounded to two seconds. Empty or example-address events don't erase a known working address. `192.0.2.1` is a documentation placeholder, never an automatic saved connection.

IP load/save messages use correlated replies to the current inspector. PI commands use its **registration UUID**, not `actionInfo.context`; confusing these breaks settings updates. Save failures and timeouts are shown explicitly.

The SDK logger runs at error level to keep global settings out of ordinary debug logs. Publication uses an explicit source inventory and also checks the built plugin; local configuration, research, logs and old installers stay outside it.

## Work on the plugin locally

After building, use the CLI to link and reload it:

```powershell
npx streamdeck dev
npx streamdeck link de.local.studiolive-mutes.sdPlugin
npx streamdeck restart de.local.studiolive-mutes
```

Check that the process or displayed behavior actually changed: a successful CLI response has previously left an old renderer running. If needed, fully quit and reopen Stream Deck. If developer mode was previously off, restore it with `npx streamdeck dev --disable`.

See [Publishing](PUBLISHING.md) for the full build/check sequence and [the test report](../TEST-REPORT.md) for simulator and hardware coverage.

## Credits and earlier design notes

Protocol formats, the fader curve and the rewritten UBJSON decoder derive from Andrew Wong's MIT-licensed [StudioLive API](https://github.com/featherbear/presonus-studiolive-api), version 1.9.1, revision `3e02b29a4a5b28695b6e1fad057ec4b4508f915a`. Its original client is a development reference; this plugin owns its transport lifecycle.

The [Companion module](https://github.com/featherbear/bitfocus-companion-module-presonus-studiolive), revision `79eb3afe5a584881000e1531277b9b8c070c1c5c`, was also used as a reference. The original review is preserved in [Architecture 1.0](ARCHITECTURE-1.0.md); licenses are in [Third-party notices](../THIRD_PARTY_NOTICES.md).
