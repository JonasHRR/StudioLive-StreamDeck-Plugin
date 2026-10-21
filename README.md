# StudioLive Main Mutes 1.6.1

A direct Windows Stream Deck plugin for PreSonus StudioLive Series III mixers. Control channel, bus and send mutes, existing mute groups, levels and smooth fades, with confirmed feedback from the mixer. No Companion, DAW, loopMIDI or separate bridge is required.

## Requirements and compatibility

- Windows 10 or 11 and Stream Deck 7.1 or later, using its bundled Node.js 20 runtime.
- A mixer reachable over its control network on TCP port 53000.
- Development: Node.js 22.23 or later and npm.

Read-only hardware checks were performed on a StudioLive 24 Series III console, with firmware reported as 3.4.0.111374. The user reported working controls; automated write tests use simulators. Other models and firmware versions require their own verification. This project uses an unofficial protocol implementation and is not affiliated with PreSonus or Elgato. See the [test report](TEST-REPORT.md) for the exact scope.

## Install and configure

1. Start Stream Deck and double-click `de.local.studiolive-mutes.streamDeckPlugin` from a release or your local `release/` directory.
2. Add **Mute / Group / Send** or **Level / Fade** from the **StudioLive Main Mutes** category.
3. Open the button settings, enter your actual mixer IPv4 address, then choose **Save mixer IP for all buttons**. Wait for **Mixer IP saved on this computer**. `192.0.2.1` is a documentation placeholder and cannot be saved as a mixer address. A missing address remains blank; no example address is automatically connected or persisted.
4. Select the target type, target number and action. The mixer address is shared across all buttons, folders and profiles.

Existing action IDs, channel assignments, custom names and saved mixer addresses remain compatible. A target without a valid state is shown as unknown and cannot be controlled. Merely adding a button does not send a mixer control command.

The address is stored in `%LOCALAPPDATA%\StudioLive-StreamDeck-Plugin\mixer-settings.json`, outside the plugin and source folders. This file stores only a format version and the mixer IP. It is written atomically, flushed and read back before a save is confirmed. Stream Deck global settings remain a compatibility mirror; unavailable or empty global settings cannot overwrite the local value after restart. Existing valid global addresses migrate automatically when no local file exists. If both stores have lost the address, enter and save it once. Local configuration is specific to this Windows user and is not included in public source or release exports.

## Names and button layout

Mixer names are used automatically, with `username` preferred over the default `name`. Name changes received from the mixer update the buttons. A **Custom display name** overrides the mixer name. Clear that field and enable **Use mixer names automatically** to return to the mixer name.

The name is the large top heading, with the channel or bus number underneath. Long names are fitted to the available width and truncated after 24 characters. Mute buttons show the mute state in the center and the controlled scope below. Level buttons emphasize the configured function in the center and show the confirmed current level in the smaller bottom line. Existing names are preserved as entered; user-supplied names are not translated.

### Mixer channel colors

By default, buttons use the target's assigned mixer color as their normal background, including live color updates. Input-to-Aux/FX send buttons use the input channel's color. Text changes between light and dark for readability. An active target mute takes priority and turns the button red; unavailable or invalid state remains gray. Level/fade buttons also turn red when the target's own mute is active, with a separate MUTE indicator while the function and current level remain visible.

If no valid assigned color is available, open mute buttons retain the green fallback and level buttons the blue fallback. Mute groups have no color field supported here and keep their existing status colors. Transparent/unassigned colors use the fallback; assigned colors use the RGB components. The plugin only reads mixer colors and never changes them.

For an individual color, choose **Button color → Custom color** and use **Custom button color**. This is available on both mute and level/fade buttons, including group and send mute actions. The choice is stored per button, so duplicate targets can have different colors. Custom color replaces the normal mixer color; MUTE stays red and unknown/offline stays gray. Select **Mixer color (automatic)** to return to live mixer colors. These preferences never change the mixer's channel color.

An inactive **FADE --** button blends its current background with 65% white, retaining a lighter tint of the custom/mixer color or mute red, with readable gray text. Its MUTE indicator still shows the actual state. The full color returns when the fade would change the level again.

## Mute / Group / Send

| Target | Range | Controlled parameter |
|---|---|---|
| Input · Main | Channels 1–24 | Regular input channel mute in the Main mix. |
| Main bus | 1 | Main output mute. |
| Subgroup | 1–4 | Subgroup bus mute. |
| Aux / FlexMix bus | 1–16 | Bus mute; the actual mix type depends on mixer configuration. |
| FX bus | 1–4 | FX bus mute. |
| FX return | 1–4 | Effect return mute. |
| Mute group | 1–8 | Existing mixer group; membership is not edited. |
| Input → Aux send | Input 1–24 → Aux 1–16 | Separate send mute through the inverted send assignment. |
| Input → FX send | Input 1–24 → FX 1–4 (A–D) | Separate send mute through the inverted send assignment. |

Choose **Toggle mute**, **Mute on** or **Mute off**. Use explicit on/off operations for Multi-Actions. Duplicate buttons stay synchronized through confirmed mixer feedback.

Selectable ranges do not guarantee that every model exposes every target. A target must provide its own valid state before commands are accepted. **OPEN** means only that the selected mute parameter is off. Mute groups, DCA, routing, faders, stereo links and other buses can still silence the signal. **Link Aux Mutes** can affect other paths; this plugin does not change link settings. A send mute and a bus mute are separate controls.

## Level / Fade

Level targets include inputs, Main, Sub, Aux and FX buses, and FX returns, if the mixer provides their fader states. Mute groups and send levels are not level targets in this version.

- **Set fixed level / Fade:** choose a target level, such as −6 dB.
- **Adjust level relatively:** choose a step, such as +1 or −1 dB. Rapid steps use the latest confirmed value.
- **Toggle fade −∞ / 0 dB:** one button alternates between the floor and 0 dB, with the same duration in both directions. Selecting this operation sets 3 seconds if the previous duration was 0; you can then change it.
- **Stop current fade:** cancels further steps without sending another level value. This is the safe default for a newly added level button.
- **Transition duration:** 0 seconds applies an immediate change; greater than 0 up to 60 seconds fades to the target.

For fixed levels, select **Target −∞ (fader floor · stored as −84)** to move all the way down. This stores the existing numeric value −84, so older buttons configured with −84 automatically show the checked option. Uncheck it to enter a regular target from −60 to +10 dB. The infinity option is not available for relative steps.

With a transition duration greater than zero, the large function label follows these rules:

| Configuration | Function label |
|---|---|
| Toggle fade −∞ / 0 dB | **FADE OUT** / **FADE IN**, previewing the next press |
| Any fixed target below the confirmed current level, including −∞ | **FADE DOWN** |
| Any fixed target above the confirmed current level, including 0 dB | **FADE UP** |
| Negative / positive relative step | **FADE DOWN** / **FADE UP** |

Only **Toggle fade −∞ / 0 dB** uses FADE OUT / FADE IN. Other fade directions are automatic. If a fixed or relative fade would leave the confirmed fader position unchanged, it shows **FADE --** on a lighter tint of its current button color with gray text. This includes an already reached fixed goal, a zero relative step or a relative step clamped at the floor/top. Detection uses the same four 16-bit steps of tolerance as command confirmation and waits until pending work is finished. The name, current level and MUTE indicator remain readable. Moving away from the goal restores FADE UP/DOWN and the full custom/mixer/mute color on all duplicate buttons. Toggle fades always retain their next-press preview.

While offline, the last known direction can remain visible, with OFFLINE below; unknown state never claims that a target is already reached. With no direction history, the fallback is **FADE**. Display history resets when the plugin restarts. Instant fixed/relative changes retain their numeric labels. The former manual **Fade label** override is no longer used; old profile fields are preserved without changing their target values.

For a fixed fade to the floor, choose an input, **Set fixed level / Fade**, enable **Target −∞**, and set duration **3** seconds. Its function is FADE DOWN while the current position is above the floor. A separate fixed target of **0 dB** displays FADE UP or FADE DOWN according to the current level, just like other fixed targets. These actions move the fader; they do not set a mute or automatically restore a previous level.

To use a single button, select **Toggle fade −∞ / 0 dB** and set the duration. At a confirmed floor position, the next press fades to 0 dB; otherwise it fades to −∞. During a fade, pressing again reverses its destination, including before the first step. The large **FADE OUT / FADE IN** label shows what the next press will do, while the bottom line remains the confirmed current level. Duplicate buttons use the same active fade and mixer feedback. After an external move, stop or restart, the next destination is determined from the actual position; no private alternating flag is saved. The return target is always 0 dB, not the previous level. Unknown/offline targets reject presses. Selecting this operation alone sends no command.

**dB scale and 0 dB correction:** the protocol supplies normalized fader positions. Version 1.5.1 anchors 0 dB at **0.74609375 (191/256)**, read from a StudioLive 24 channel after the user confirmed that its mixer display was exactly 0 dB. The earlier uncorrected curve sent about 0.7252 and the user reported −0.82 dB on the console. Fixed targets, toggle returns and relative changes use the same corrected conversion. The empirical curve is rescaled continuously on either side of unity, with the floor and top position retained; inverse conversion uses that same curve. This establishes the observed unity point, not a full calibration of every dB value, model or firmware. Other values remain approximate and are marked **≈**. Regular targets range from −60 to +10 dB, with −84 as the special floor value. The first positive relative step from the floor starts near −60 dB; a step below −60 moves to the floor.

A new level command for the same target stops its fade. Different targets may fade concurrently through the shared command queue. Other mutes remain usable between steps. A detected external fader move stops the fade; quantization and delayed echoes limit detection. Each step waits for feedback, so slow confirmations may lengthen a fade. A disconnect or missing confirmation discards pending work. Fades never resume automatically after reconnecting. Stopping cannot retract a value already sent.

## Status and Multi-Actions

| Display | Meaning |
|---|---|
| Red · MUTE | Selected mute parameter is active. |
| Mixer color · OPEN | Selected mute parameter is off; green fallback when no color is available. |
| Mixer color · function with ≈ dB / −∞ below | Configured level function and confirmed fader position; blue fallback without a color. Active target mutes override the background with red. |
| WAIT / FADE · yellow border | Command pending or fade active; state still comes from feedback. |
| Gray · CONNECTING / OFFLINE | No current state; control commands are rejected. |
| Gray · UNKNOWN | Connected, but the target has no valid state. |
| Gray · SETTINGS | Invalid target, number or value. |

Stream Deck does not wait for a complete fade before advancing to the next Multi-Action step. Add required delays and verify the sequence on the mixer. Relative changes and toggles are not idempotent; fixed targets and explicit on/off operations are preferable when repeatability matters.

## Connection and troubleshooting

Runtime networking uses only TCP 53000 to the configured mixer and the local SDK WebSocket to Stream Deck. There is no discovery broadcast, cloud connection, telemetry or UDP metering. Normal logs and diagnosis output omit the configured IP and mixer names.

Connection attempts are limited to 8 seconds. Retries use 0.5, 1, 2, 4, 8 and at most 10 seconds of backoff. Keepalive detects a silent loss in approximately 6 seconds. Each write waits at most 2 seconds for confirmation; the queue holds at most 32 commands with a maximum age of 5 seconds. Offline key presses are discarded.

- **OFFLINE:** check mixer power, the configured address and the control network. A failed ping alone does not establish that the mixer is unreachable. Distinguish the control network from AVB audio.
- **Blank mixer IP / SETTINGS:** enter the actual mixer IP and save it. The plugin does not silently use a sample address.
- **No confirmation received:** reopen the settings to check the stored value before trying again. A save is not claimed until the local write is verified.
- **UNKNOWN:** check target type and number; the parameter may be unavailable on this model or firmware.
- **WAIT followed by OFFLINE:** execution was unconfirmed. Check actual mixer state before trying again.
- **Unexpected monitor behavior:** distinguish Main, send and bus mutes, and inspect Link Aux Mutes locally.
- **Missing graphics:** reset any custom Stream Deck icon that hides the dynamic image.
- Check firewall access for the Stream Deck runtime. The plugin does not change firewall rules.

## Build, test and diagnose

Dependencies are pinned in `package-lock.json`. The tested environment uses Node.js 22.23.2/npm 10.9.8 for development and the currently installed Stream Deck Node.js 20.20.2 for runtime (earlier releases were checked with 20.20.0). The build targets Node 20; SDK 3.0.2 declares a minimum of 20.5.1.

```powershell
npm ci
npm run typecheck
npm test
npm run validate
npm run check:public
npm run pack
npm run source:public
npm run checksums
```

Tests use local simulators only. The SDK integration test requires a free local TCP port 53000 and launches the built plugin against simulated Stream Deck and mixer hosts.

For read-only diagnosis, replace the example address with your mixer address:

```powershell
npm run build
npm run diagnose -- 192.0.2.1 --capabilities --observe
```

Diagnosis sends subscription and keepalive only. It prints 24 Main mute states and optional aggregate capability counts. `--observe` keeps the connection open for another 7 seconds; the overall limit is 17 seconds, or 10 seconds without observation. It never sends mute or level commands.

For local development, enable developer mode with `npx streamdeck dev`, link with `npx streamdeck link de.local.studiolive-mutes.sdPlugin`, and reload with `npx streamdeck restart de.local.studiolive-mutes`. Restart requires developer mode; a CLI success message alone may not prove that the process reloaded. Verify a new plugin process or the changed button behavior. If the old renderer remains active, fully quit and reopen Stream Deck. Disable developer mode afterward with `npx streamdeck dev --disable` if it was previously off.

## Public repository and releases

The source and installer use a documentation-only default address. `npm run source:public` produces `release/StudioLive-Mutes-1.6.1-source.zip`, a clean source snapshot suitable for a new repository. Local research, diagnostics, old releases, generated bundles and personal settings are excluded. See [Publishing on GitHub](docs/PUBLISHING.md) for the upload and release steps.

The installer, source ZIP and `SHA256SUMS.txt` are generated in `release/`. This directory is ignored by Git; attach the current files to a GitHub Release separately. Older local private installers are not public release assets.

## License and technical details

MIT; see [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md). Protocol formats, the empirical fader curve and the rewritten UBJSON decoder derive from Andrew Wong's MIT-licensed [StudioLive API](https://github.com/featherbear/presonus-studiolive-api). Its original client is a development reference, not the runtime transport. See [architecture](docs/ARCHITECTURE.md), [changelog](CHANGELOG.md) and [test report](TEST-REPORT.md).
