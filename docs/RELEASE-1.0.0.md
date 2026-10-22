# StudioLive Control 1.0.0

Initial release for **Windows and macOS**, October 22, 2026.

## Features

- Direct control of PreSonus StudioLive Series III mixers from Stream Deck.
- Mutes for inputs, buses, FX returns, existing mute groups and individual Aux/FX sends.
- Fixed and relative levels, smooth fades, fade stop and toggle fades between −∞ and 0 dB.
- Inputs 1–64 where mixer feedback is available, plus A1, A2, Tape and Talkback.
- Live mixer names and colors, custom button names and colors, and shared mixer settings.

New **Level / Fade** buttons default to a **3-second toggle fade**. Choose another operation or duration in the button settings as needed.

## Requirements

- Windows 10/11 or macOS 13+.
- Stream Deck 7.1 or later.
- Access to the mixer's control network on TCP port 53000.

Stream Deck supplies the runtime. Both operating systems use the same installer.

## Installation

1. Download `de.local.studiolive-mutes.streamDeckPlugin` from the release assets.
2. Open it with Stream Deck running.
3. Add **Mute / Group / Send** or **Level / Fade** from **StudioLive Control**.
4. Enter the mixer IPv4 address, save it for all buttons and choose a target.

The [user guide](USER-GUIDE.md) explains targets, operations and troubleshooting.

## Compatibility

The plugin controls targets that provide valid mixer feedback. Displayed dB values are approximate. The [test report](../TEST-REPORT.md) describes hardware coverage and outstanding verification.

## Downloads

| File | Contents |
|---|---|
| `de.local.studiolive-mutes.streamDeckPlugin` | Windows/macOS installer. |
| `StudioLive-Control-1.0.0-source.zip` | Source, documentation, assets and dependency lockfile. |
| `RELEASE-1.0.0.md` | Release notes. |
| `SHA256SUMS.txt` | SHA-256 checksums for the three files above. |

The optional `StudioLive-Control-1.0.0.zip` transfer archive contains those files together. Extract it before opening the installer.
