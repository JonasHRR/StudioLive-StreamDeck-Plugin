# StudioLive Control

**Your mixer. Your workflow.**

Bring the controls you use most to your Stream Deck. StudioLive Control connects directly to your PreSonus StudioLive Series III mixer, so you can adjust your mix from the buttons in front of you.

Adjust levels, shape fades and keep Talkback within reach. Build a layout around the way you work.

**Windows · Stream Deck 7.1+ · Version 1.9.2**

[Get started](#get-connected) · [User guide](docs/USER-GUIDE.md) · [Changelog](CHANGELOG.md)

## Control that fits your session

### The right controls, within reach

Set levels, make small adjustments, run smooth fades or switch mutes. Work with inputs, buses, FX returns and existing mute groups. A1, A2, Tape and Talkback sit together under **Additional inputs**.

### A clear view of your mix

Buttons follow the mixer's feedback. Channel names help you find the right input, mixer colors keep the layout familiar, and custom names and colors let you make it your own.

### One direct connection

The plugin talks to your mixer over its control network. Save its address once and use it across your buttons, folders and profiles. No extra bridge application is needed.

## Available today

| Control | What you can do |
|---|---|
| **Levels & fades** | Set a fixed level, adjust by a relative step, fade between −∞ and 0 dB, or stop a fade. |
| **Inputs & buses** | Select inputs 1–64, A1/A2, Tape, Talkback, Main, Sub, Mix buses and FX buses/returns. |
| **Mutes & sends** | Control target mutes, existing mute groups and individual input-to-Aux/FX send mutes. |
| **Button layout** | Follow live mixer names and colors, or choose your own display name and color per key. |

Available controls depend on the state your mixer provides. A target without valid feedback stays **UNKNOWN**. Find the exact ranges and behavior in the [user guide](docs/USER-GUIDE.md).

## More to come

More mixer functions will follow. The focus stays the same: useful controls, clear feedback and a workflow that feels natural.

The table above reflects what's available now. Follow the [changelog](CHANGELOG.md) as the plugin develops.

## Get connected

You'll need **Windows 10 or 11**, **Stream Deck 7.1 or later**, and a mixer reachable on its **control network** via TCP port **53000**.

1. Install `de.local.studiolive-mutes.streamDeckPlugin` with Stream Deck running. Use a release asset if available, or [build it yourself](docs/PUBLISHING.md).
2. Add **Mute / Group / Send** or **Level / Fade** from the **StudioLive Control** category.
3. Enter your mixer IPv4 address and click **Save mixer IP for all buttons**. Wait for the save confirmation.
4. Choose a target and operation. You're ready to build your layout.

Your address is remembered on this Windows account. Existing profiles and button assignments remain compatible.

For a first fade, choose **Level / Fade → Set fixed level / Fade**, select your target level and set a duration. For one-button out/in control, choose **Toggle fade −∞ / 0 dB**. Its return level is always **0 dB**; displayed dB values are approximate.

## Compatibility

Read-only hardware checks used a **StudioLive 24 Series III** reporting **32 logical inputs**. Automated control tests cover 16-, 24-, 32- and 64-input simulators and the additional inputs. Real 64S and additional-input control-write acceptance are still open. See the [test report](TEST-REPORT.md) for the full scope.

This is an independent, unofficial project and is not affiliated with PreSonus or Elgato.

## Go further

- [User guide](docs/USER-GUIDE.md) — setup, controls, colors and troubleshooting.
- [Build & publish](docs/PUBLISHING.md) — create an installer from source.
- [Architecture](docs/ARCHITECTURE.md) — connections, state and command handling.
- [Test report](TEST-REPORT.md) — verified behavior and hardware limits.

[MIT licensed](LICENSE). Protocol handling and the fader curve build on Andrew Wong's [StudioLive API](https://github.com/featherbear/presonus-studiolive-api). See [Third-party notices](THIRD_PARTY_NOTICES.md) for credits and dependency licenses.
