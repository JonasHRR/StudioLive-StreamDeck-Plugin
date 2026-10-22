# Test report — 1.0.1

Recorded on October 22, 2026. This report summarizes the verification available for StudioLive Control 1.0.1.

## Automated checks

Version 1.0.1 unifies the product name in the inspector, npm packages, license attribution, mixer subscription and downloadable installer. The official packer still builds the original UUID internally; a packaging step names the download `StudioLive-Control.streamDeckPlugin`. Plugin/action UUIDs, target assignments and address persistence remain compatible. The existing simulator suite covers those saved profiles and settings. No new real mixer control writes were performed for this branding change.

The installed Windows copy was updated and Stream Deck restarted. A fresh runtime confirmed version 1.0.1.0. Live inspection showed StudioLive Control in the action header and in both mute and level/fade inspectors, with existing names, colors and connection state restored. Inspection only selected buttons in the editor and did not change assignments or trigger mixer controls.

The suite contains **81 tests**, executed on Windows under **Node.js 22.23.2** and **Stream Deck Node.js 20.20.2**. All passed. Type checking, the build, Elgato manifest validation and source/runtime publication checks also passed.

Tests use local mixer and Stream Deck simulators. They cover:

- Packet framing, bounded snapshot decoding, parameter feedback and allowed write paths.
- Startup feedback coalesced with the initial snapshot, with subscription acknowledgment before or after the data, and the first command using the latest confirmed state.
- Complete 16-, 24-, 32- and 64-input banks, unavailable targets and high-channel feedback.
- Input/bus/group/send mutes, send-assignment inversion and additional input mappings.
- Fixed and relative levels, unity conversion, zero steps, fades, toggle reversal, cancellation and confirmation timeouts.
- Duplicate buttons, names, colors, inactive fade labels and inspector settings.
- Shared address persistence, failed saves, restart recovery and Windows/macOS file paths.
- SDK registration, WebSocket/TCP integration, inspector subscriptions, disconnect handling and reconnect without replay.

New level buttons use a 3-second toggle fade in both the inspector and runtime. Saved operations and durations, including zero, are tested independently.

## Hardware and platform coverage

| Area | Available evidence |
|---|---|
| StudioLive 24 Series III | Read-only hardware observations; firmware reported as 3.4.0.111374. The mixer exposes 32 logical inputs. |
| Windows | Automated checks and live Stream Deck editor inspections. |
| macOS | Operation reported working on a MacBook, plus automated platform-path checks run on Windows. |
| 64-input mixers | Simulator coverage for controls, feedback and reconnect. Real 64S control-write acceptance remains open. |
| A1, A2, Tape and Talkback | Real parameter presence confirmed by subscription; control writes covered by simulators. |
| 0 dB reference | A user-confirmed console position was read as 191/256 (0.74609375). Other dB values remain approximate. |

The MacBook report does not establish separate Intel/Apple Silicon coverage or verification across macOS versions. Native Mac build and runtime automation are not part of the Windows test results.

Live editor inspections verified names, colors and selections. These inspections did not trigger real mixer controls. User-reported operation and read-only parameter observations are distinct from automated write tests.

## Practical limits

Selectable targets need their own valid feedback before commands are accepted. Presence of a parameter does not establish successful execution of every operation on every model or firmware.

The protocol has no exclusive fader lock or transaction identifier used here. Simultaneous external changes and delayed or quantized echoes can be indistinguishable. A fade may take longer when confirmations are slow, and stop cannot retract a value already sent.

Real 64S acceptance, additional-input writes, complete Multi-Action sequences and broad macOS hardware coverage need further verification. The double-click installer flow has not been independently checked on every supported platform.

See [Testing](docs/TESTING.md) for a repeatable manual checklist, [Architecture](docs/ARCHITECTURE.md) for implementation details and the [user guide](docs/USER-GUIDE.md) for operation.
