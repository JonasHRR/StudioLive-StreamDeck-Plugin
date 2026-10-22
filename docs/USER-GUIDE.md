# Your controls, explained

This guide covers **StudioLive Control 1.9.3**. If you're setting up your first key, start with the [quick setup](../README.md#get-connected).

## Pick the right target

Both actions use the same target names. **Mute / Group / Send** controls a mute; **Level / Fade** controls a fader where one is available.

| Target type | Choices | Mute | Level / Fade |
|---|---|:---:|:---:|
| Input · Main | Inputs 1–64 | Yes | Yes |
| Additional inputs | A1, A2, Tape, Talkback | Yes | Yes |
| Main bus | 1 | Yes | Yes |
| Subgroup | 1–4 | Yes | Yes |
| Mix bus | 1–16 | Yes | Yes |
| FX bus | 1–4 | Yes | Yes |
| FX return | 1–4 | Yes | Yes |
| Mute group | 1–8 | Yes | — |
| Input → Aux send | Input 1–64 → Aux 1–16 | Yes | — |
| Input → FX send | Input 1–64 → FX 1–4 (A–D) | Yes | — |

These are selectable ranges, not a promise that every mixer provides every target. The plugin waits for valid state from the selected parameter. For example, input 64 on a mixer that only reports 32 inputs stays **UNKNOWN** and cannot be controlled.

**Additional inputs** brings A1, A2, Tape and Talkback into one list. Each stereo Aux input is one target. Talkback buttons control its own mute and level; destinations, routing, preamp gain and phantom power are outside this plugin's controls.

**Mix bus** is the name used for the former Aux / FlexMix bus category. Existing assignments still work. The mixer's configuration determines the bus type.

The list shows channel names next to their numbers, such as **No. 1 · Mic 1**. Send buttons show both the input name and the destination bus name. Live renames update the list while keeping your selected number and unfinished edits. When names are unavailable, you'll see numbers only.

## Mutes: toggle or be explicit

Choose **Toggle mute** for a key that flips the current confirmed state. Choose **Mute on** or **Mute off** when you want a repeatable result, especially in a Multi-Action.

Two keys assigned to the same target follow the same mixer feedback. A mute group controls an existing mixer group; its membership is managed on the mixer.

**OPEN** tells you that this particular mute is off. Fader position, DCA, group membership, routing, stereo links and other buses can still affect what you hear. Also keep these controls separate:

- An input mute is the regular channel mute in the Main mix.
- A send mute controls that input's assignment to the chosen Aux or FX send.
- A bus mute controls the bus itself.

The mixer's **Link Aux Mutes** setting can affect other paths. The plugin doesn't change link settings.

## Levels and fades

Choose your target first, then pick an operation:

| Operation | What happens |
|---|---|
| **Set fixed level / Fade** | Move to a specific level, such as −6 dB. |
| **Adjust level relatively** | Move up or down by a step, such as +1 or −1 dB, using the latest confirmed value. |
| **Toggle fade −∞ / 0 dB** | Alternate between the fader floor and 0 dB. |
| **Stop current fade** | Stop sending further fade steps. This is the default for a new level button. |

**Transition duration** is shared by the operation: **0 s** applies the change immediately; anything above 0 up to **60 s** creates a fade. Relative steps range from **−12 to +12 dB**.

### A fixed fade

To fade a channel all the way down, choose **Set fixed level / Fade**, enable **Target −∞**, and set the duration to **3 s**. To bring it to a particular level, use another fixed button with that target.

Regular fixed targets run from **−60 to +10 dB**. The infinity checkbox uses the existing stored value **−84** for the fader floor, so older floor buttons still restore correctly. It isn't available for relative steps.

These actions move the fader. They don't change its mute or remember a previous level to restore later.

### One key for out and in

Select **Toggle fade −∞ / 0 dB** and choose your duration. If the previous duration was 0, selecting this operation starts it at 3 seconds; you can change it afterward.

At the confirmed floor, the next press goes to **0 dB**. From another position, it goes to **−∞**. Press again during a fade to reverse its destination — even before the first step has been sent.

The key previews the next press as **FADE IN** or **FADE OUT**. Duplicate keys share the same preview. After an external fader move, stop or restart, the actual position determines the next destination. The return target is always 0 dB.

### What the fade label means

| Label | Meaning |
|---|---|
| **FADE DOWN / FADE UP** | A fixed target is below/above the current level, or the relative step moves down/up. |
| **FADE OUT / FADE IN** | The next action of a toggle-fade button. Only toggle fades use these labels. |
| **FADE --** | A fixed or relative fade would leave the confirmed position unchanged. |
| **FADE** | A neutral preview while the direction isn't known. |
| **FADE STOP** | The button stops the target's current fade. |

A **FADE --** key uses a lighter tint of its current color. It returns to full color when the fade would change the level again. This covers reached targets, zero steps and steps clamped at the floor or top. Pending work must finish before a key is marked inactive.

While offline, the last known direction may remain visible with **OFFLINE** below it. That display history resets when the plugin restarts. Instant operations show their numeric labels; the old manual fade-label setting is no longer used.

### A note about the dB scale

The mixer sends normalized fader positions. The displayed dB values are approximate, which is why they carry **≈**. The 0 dB anchor was checked against a user-confirmed position on a StudioLive 24; that doesn't calibrate every level on every model.

From the floor, the first positive relative step starts near −60 dB. A nonzero step whose result falls below −60 dB goes to the floor. A **0 dB step leaves the position exactly as it is**, including very low nonzero positions.

### Stopping, reversing and reconnecting

Another level command on the same target stops its previous fade. Different targets can fade at the same time, and mutes remain usable between fade steps.

Each step waits for mixer feedback, so slow replies can make a fade take longer than the selected duration. A detected external fader move also stops the fade, although delayed or quantized echoes can limit detection. Stop cannot retract a value already sent.

A lost connection or missing confirmation discards pending work. Fades and offline key presses aren't replayed after reconnecting.

## Names, colors and the display

The mixer name is the large heading. A **Custom display name** takes priority; clear it and enable **Use mixer names automatically** to return to the mixer name. The target number stays underneath. Long displayed names are fitted and shortened after 24 characters.

Selection-list names always come from the mixer, independently of your custom button heading. User and mixer names are kept as entered.

By default, the background follows the target's mixer color. Send buttons inherit the input color. To choose your own, select **Button color → Custom color**. Each button has its own preference, even when several buttons control the same target.

| Appearance | Meaning |
|---|---|
| **Red · MUTE** | The target's mute is active. Level buttons retain their function and level display. |
| **Mixer/custom color · OPEN** | The selected mute is off. |
| **Mixer/custom color · level function** | The function is in the center; confirmed level is below. |
| **WAIT / FADE · yellow border** | A command is awaiting confirmation or a fade is running. |
| **Lighter tint · FADE --** | The configured fade currently has nothing to change. |
| **Gray · CONNECTING / OFFLINE** | Current mixer state isn't available. |
| **Gray · UNKNOWN** | Connected, but this target hasn't supplied a valid state. |
| **Gray · SETTINGS** | A target, number or value needs correcting. |

Active mutes take priority over custom and mixer colors; unavailable state stays gray. Inactive fades lighten the applicable background, including mute red, while keeping the MUTE indicator readable. Text adjusts for contrast.

Without a usable mixer color, open mute buttons use green and level buttons use blue. Mute groups have no supported mixer-color field and use the fallback or your custom color. These display preferences never change the mixer's channel colors.

## Multi-Actions

Use **Mute on**, **Mute off** and fixed level targets when you need repeatable results. Toggles and relative steps depend on the current state.

Stream Deck moves to the next Multi-Action step without waiting for a fade to finish. Add the delays your sequence needs and verify its behavior on the mixer.

## Your mixer address

Enter your actual IPv4 address once and save it for all buttons. The example `192.0.2.1` is reserved for documentation and cannot be saved as the mixer address.

The address is stored at:

```text
%LOCALAPPDATA%\StudioLive-StreamDeck-Plugin\mixer-settings.json
```

The plugin verifies the local file before confirming a save. Stream Deck global settings remain a compatibility mirror; a missing or empty value at restart doesn't erase the local address. A valid old global address migrates when no usable local file exists. If both stores have lost it, enter and save it once.

The file belongs to your Windows account and is outside the source and plugin folders. Source archives and installers don't include it. Runtime traffic stays between the configured mixer and the local Stream Deck connection; there is no discovery broadcast, cloud connection, telemetry or UDP metering.

## When something looks wrong

| What you see | What to try |
|---|---|
| **OFFLINE** | Check mixer power, the saved IP and the control network. AVB audio and mixer control are different connections. Check firewall access for Stream Deck's runtime; a failed ping alone doesn't prove the mixer is unreachable. |
| **Blank IP / SETTINGS** | Enter and save the real mixer IP, then check the target and values. |
| **No confirmation received** when saving | Reopen the settings to check the stored address before trying again. |
| **UNKNOWN** | Check the target type and number. The mixer may not expose that parameter. |
| **WAIT**, then **OFFLINE** | The change wasn't confirmed. Check the actual mixer state before retrying. |
| Unexpected monitor behavior | Check whether you're controlling an input, send or bus, and review Link Aux Mutes on the mixer. |
| Missing or stale graphics | Reset any custom Stream Deck icon that covers the plugin's dynamic image. |

Connections time out after 8 seconds and retry with backoff up to 10 seconds. A silent loss is usually detected in about 6 seconds. Writes wait up to 2 seconds for confirmation.

For a read-only diagnostic, build the project and replace the example address below with your mixer's address:

```powershell
npm run build
npm run diagnose -- 192.0.2.1 --capabilities --observe
```

This subscribes to state and sends keepalive messages only. It reports received input mute states and aggregate capability counts, without printing the configured address or mixer names. Observation adds 7 seconds; the overall limit is 17 seconds, or 10 without observation. It doesn't send mute or level commands.

For known test coverage and hardware limits, see the [test report](../TEST-REPORT.md).
