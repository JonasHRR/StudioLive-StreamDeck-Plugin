# StudioLive Main Mutes

**Your StudioLive mixer, a few buttons away.**

Mute a mic, bring down the music, or fade a channel back in — straight from your Stream Deck. This Windows plugin connects directly to a PreSonus StudioLive Series III mixer and updates its buttons from the mixer's feedback. No Companion, DAW or extra bridge to keep running.

**Current version: 1.9.1** · [User guide](docs/USER-GUIDE.md) · [What's new](CHANGELOG.md) · [Test report](TEST-REPORT.md)

## What you can do

- **Mute what you need:** inputs, buses, FX returns, existing mute groups, and individual input-to-Aux/FX sends.
- **Set a level or take it slowly:** fixed levels, relative steps, smooth fades, and a single button to fade between −∞ and 0 dB.
- **Find channels by name:** the selection lists show the names from your mixer and follow live renames.
- **Make the buttons yours:** use mixer colors or choose a custom color for each button. Mutes stay red and unavailable targets stay gray.
- **Use additional inputs:** A1, A2, Tape and Talkback are together under **Additional inputs**.

Input selection runs from 1 to 64. Each target becomes usable when the connected mixer supplies valid feedback for it. The plugin also works with complete 16-, 24- and 32-input banks; it doesn't expect a smaller mixer to have 64 inputs.

## Get connected

You'll need Windows 10 or 11, Stream Deck 7.1 or later, and access to your mixer's **control network** on TCP port 53000. Stream Deck supplies the plugin's Node.js runtime.

1. With Stream Deck running, double-click `de.local.studiolive-mutes.streamDeckPlugin`. Use a published release asset if available, or build the installer locally with the commands below.
2. Drag **Mute / Group / Send** or **Level / Fade** onto a key.
3. In the button settings, enter your mixer IPv4 address and click **Save mixer IP for all buttons**. Wait for **Mixer IP saved on this computer**.
4. Pick a target and an operation. That's it — the key follows the mixer's state.

The address is shared across buttons, folders and profiles and is remembered on this Windows account. Existing button assignments, names and saved addresses remain compatible. Adding a button or opening its settings doesn't send a mixer control command.

## A few useful starting points

| You want to… | Set up the button like this |
|---|---|
| Toggle a microphone mute | **Mute / Group / Send** → **Input · Main** → your channel → **Toggle mute** |
| Fade music all the way down | **Level / Fade** → your input → **Set fixed level / Fade** → **Target −∞** → duration **3 s** |
| Fade out and back in with one key | **Level / Fade** → **Toggle fade −∞ / 0 dB** → your duration |
| Control Tape or Talkback | Choose **Additional inputs**, then select **Tape** or **Talkback** |
| Mute a monitor bus | **Mute / Group / Send** → **Mix bus** → your bus → **Mute on** |

The toggle fade always comes back to **0 dB**. For another return level, use a fixed-level button. Levels are approximate and shown with **≈**; see the [level and fade guide](docs/USER-GUIDE.md#levels-and-fades) for the details.

## Read the key at a glance

**MUTE** means the selected mute is on. **OPEN** means that mute is off — another part of the signal path can still silence the audio. **WAIT / FADE** and a yellow border show pending work. **FADE --** means the configured fade has nothing to change.

**UNKNOWN** means that target hasn't supplied valid state. **OFFLINE** means the connection is down. Neither sends control commands when pressed. Start with the [troubleshooting guide](docs/USER-GUIDE.md#when-something-looks-wrong) if a key stays gray.

## Compatibility, honestly

Read-only hardware checks used a **StudioLive 24 Series III**, reporting firmware **3.4.0.111374** and **32 logical inputs**. The user has reported working controls. Automated control tests use simulators, including a 64-input mixer and the additional inputs; real 64S and additional-input write acceptance are still open.

This is an unofficial project, independent of PreSonus and Elgato. The [test report](TEST-REPORT.md) explains what has been checked and where hardware verification is still needed.

## Build it yourself

Install Node.js **22.23 or later** and npm, then run these commands from the repository folder:

```powershell
npm ci
npm run typecheck
npm test
npm run validate
npm run check:public
npm run pack
```

The installer lands in `release/`. Tests use local simulators; the SDK integration test needs localhost TCP port 53000 to be free. The build targets Stream Deck's Node.js 20 runtime.

For source archives, checksums and release steps, see [Publishing](docs/PUBLISHING.md). For local development and the connection model, see [Architecture](docs/ARCHITECTURE.md).

## Keep exploring

- [User guide](docs/USER-GUIDE.md) — target ranges, fades, colors, Multi-Actions and troubleshooting.
- [Changelog](CHANGELOG.md) — changes by version.
- [Test report](TEST-REPORT.md) — automated checks and recorded hardware observations.
- [Architecture](docs/ARCHITECTURE.md) — how the plugin handles state, commands and reconnects.

Released under the [MIT license](LICENSE). Protocol handling and the fader curve build on Andrew Wong's MIT-licensed [StudioLive API](https://github.com/featherbear/presonus-studiolive-api). Full credits and bundled dependency licenses are in [Third-party notices](THIRD_PARTY_NOTICES.md).
