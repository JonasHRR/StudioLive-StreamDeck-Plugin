# Changelog

## 1.6.1

- Keep a relative 0 dB step unchanged at every confirmed fader position, including values below −60 dB; no level command is sent.
- Apply the same no-op behavior to inactive fade labels, add simulator coverage and correct the documented source archive version.

## 1.6.0

- Custom button colors for mute/group/send and level/fade actions, stored independently per button; switch back to automatic mixer color at any time.
- FADE -- lightens its current custom/mixer/mute color with 65% white instead of replacing it with neutral gray.
- Keep readable text, red active mutes and gray offline/unknown feedback; custom preferences never write mixer colors.

## 1.5.3

- Use a light-gray background and gray text for the entire inactive FADE -- button, overriding mixer and mute backgrounds while retaining the MUTE indicator.
- Restore normal mixer/mute colors as soon as the fade would change the confirmed position again.

## 1.5.2

- Show FADE -- with gray function text when a fixed/relative fade would leave the confirmed position unchanged, including reached goals and clamped bounds.
- Restore UP/DOWN as soon as the confirmed position changes; keep names, current level, mixer color and mute feedback intact.
- Use command-confirmation tolerance and shared relative goal computation; active, offline, instant and toggle actions do not receive the inactive marker.

## 1.5.1

- Reserve FADE OUT / FADE IN for Toggle fade −∞ / 0 dB. All fixed fades, including −∞ and 0 dB, use directional FADE DOWN / UP.
- Correct the 0 dB target to the read-only, user-confirmed StudioLive unity position 0.74609375 (191/256), replacing the old approximate 0.7252 value.
- Continuously adjust both sides of the conversion around unity and use the same curve for feedback and relative changes; keep other dB points explicitly approximate.
- Cover the measured unity wire value, absolute/toggle returns, monotonicity and inverse conversion; suppress −0.0 dB display rounding.

## 1.5.0

- New **Toggle fade −∞ / 0 dB** level operation with a shared duration and FADE OUT / FADE IN preview for the next press.
- Derive the next endpoint from confirmed position or the active fade destination; duplicate buttons share behavior without a saved toggle flag.
- A second press reverses a running fade, even before its first step; outstanding feedback is accepted before starting from the confirmed position.
- Keep offline rejection, cancellation and no replay after reconnect; add simulator, inspector and bundled SDK integration coverage.

## 1.4.0

- Direct −∞ target checkbox, stored as the existing −84 floor value; legacy floor settings restore it automatically.
- FADE OUT for a fixed floor target and FADE IN for fixed 0 dB.
- FADE UP/DOWN for relative steps and intermediate targets, using the confirmed current level.
- Retain the last direction at the goal/while offline, with shared display history for duplicate buttons and quantization tolerance.
- Remove the manual fade-label override from the inspector; preserve existing target values and settings fields.

## 1.3.1

- Preserve the mixer IP in an atomic local settings file outside the plugin/source folders; recover it when Stream Deck globals are unavailable after restart.
- Remove automatic persistence/connection of the example address and confirm IP saves only after a verified local write.
- Route IP settings through the plugin and restore the property-inspector registration context for button settings and messages.
- Cover channel/settings persistence, failed saves and a fresh plugin process with missing Stream Deck globals.

## 1.3.0

- Mixer channel colors as normal button backgrounds, from snapshots and live PC updates.
- Automatic light/dark text, with red mute and gray unavailable-state overrides.
- Send buttons inherit the input color; missing/unassigned colors retain the previous fallback.
- Level buttons also show the target's own mute while retaining function and current level.
- Color parameters remain read-only; no mixer color writes are exposed.

## 1.2.1

- Uppercase FADE IN / FADE OUT function labels on buttons and in the fade-label selector.
- Finish translating remaining low-level protocol error messages into English.

## 1.2.0

- English button states, action names, property inspector, error messages and diagnosis output.
- English user, developer, architecture and test documentation.
- Public source and installer use a documentation-only default IP. Saved local mixer settings remain compatible.
- Clean public source export, publication guide, repository ignore rules and public-file checks.
- Existing plugin/action UUIDs and button settings are unchanged.

## 1.1.3

- Level/fade functions are large in the center; the confirmed current level is small below.
- Pending and connection states remain visible separately.

## 1.1.2

- Bottom line uses the same font size as the channel number.
- Permanent Fade In/Fade Out labels, with an optional explicit role for intermediate levels.

## 1.1.1

- Mixer/custom name becomes the main heading; the channel number stays visible below.

## 1.1.0

- Mixer names, existing mute groups, bus mutes and inverted Aux/FX send mutes.
- Fixed levels, relative steps, confirmed smooth fades and fade stop.

## 1.0.0

- Direct TCP connection, input 1–24 Main mutes, explicit on/off and toggle.
- Confirmed feedback, shared state, bounded command queue and automatic reconnect.
