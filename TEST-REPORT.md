# Test report — version 1.6.1

Current test date: October 21, 2026; settings persistence checks: October 19; historical mixer and color checks: October 16. This report distinguishes automated simulation, installed Stream Deck inspection, read-only hardware checks and user feedback.

## 1.6.1: source review and zero-step regression

The source review reproduced a relative 0 dB step moving a confirmed normalized position of 0.005 to the floor. The shared relative-level helper now returns the confirmed position immediately for a zero step, including values below the regular −60 dB target range. The new service regression checks floor, low nonzero, regular, unity and top positions with instant and timed operations, requiring unchanged feedback and zero simulated level writes. The label regression also checks FADE -- for low nonzero positions. Both regressions failed before the fix.

The README's stale source-archive version and the publication guide were updated. No real mixer commands or Stream Deck application restarts are part of this source review.

Type checking and all 58 tests passed under development Node.js 22.23.2 and the installed Stream Deck Node.js 20.20.2. Official Elgato validation and source/runtime publication checks passed. A full npm audit reported zero known vulnerabilities, including development dependencies. The installer, source archive and SHA-256 checksums were regenerated for 1.6.1. The CLI's `.sdignore` packaging rules are included in the source inventory so logs remain excluded in fresh checkouts.

## 1.6.0: custom colors and tinted inactive fades

Both action types expose automatic/custom button color selection and a native color input. Preferences are per button; valid six-digit hex custom colors override normal mixer colors, with red active-mute and gray offline/unknown priority retained. Invalid colors fall back to automatic color without entering SVG markup. An inactive fade blends the currently applicable color with 65% white, retaining its hue rather than using neutral gray. Mixer color writes remain disabled.

Two new tests cover independent mute/level colors, live mixer updates, custom inactive tints, mute/offline priority, invalid values, readable text, PI persistence/restoration, automatic mode and disconnected controls. The completed-fade test now checks known pastel colors and full-color restoration. All 57 tests pass under development Node.js 22 and Stream Deck Node.js 20.20.2, without real mixer control writes.

After a full restart, a fresh plugin process confirmed version 1.6.0.0. Live inspection showed the new controls on level and mute actions and a pale blue FADE -- button retaining its original hue. On an existing mute button, selecting Custom color displayed the color input and immediately applied its default green swatch. Returning to Mixer color (automatic) restored the original light-blue mixer color. The original automatic appearance was restored, and no real mixer control was triggered. Official validation and public-file checks passed; installer, public sources and checksums were regenerated.

## 1.5.3: entire inactive button in light gray

An inactive FADE -- button now uses a light-gray background (#dce0e5) and gray text (#59616b) across the entire button. This palette overrides mixer and red mute backgrounds while preserving the readable name, confirmed level and MUTE indicator. Moving away from the goal restores the normal mixer/mute palette. Detection and control behavior are unchanged.

The existing completed-fade test now verifies whole-button gray across duplicate keys, retained no-write behavior, independence from incoming mixer colors, the readable MUTE indicator, and restoration of red/mixer colors when active again. All 55 tests pass under Node.js 22 and Stream Deck Node.js 20.20.2.

A fresh Stream Deck plugin process confirmed version 1.5.3.0. Live inspection showed the existing reached 0 dB action with a light-gray background and gray name, function and level text, visibly distinct from the active mixer-colored buttons. No settings or mixer controls were changed during inspection. Official validation and public-file checks passed; release artifacts were regenerated.

## 1.5.2: reached fade goals

Idle fixed/relative fades show FADE -- with gray function text when the computed goal is already within the command-confirmation tolerance. The shared relative-level computation also recognizes zero steps and clamped floor/top bounds. Pending work, offline/unknown state, instant changes and toggle previews are excluded. Only the function text is dimmed; names, level text, mixer color and red mute indication remain intact. Moving away from the goal restores UP/DOWN on duplicate buttons.

Two new tests cover exclusions and bounds, completed fades, duplicate rendering, light/dark gray text, mute/color preservation, offline clearing, and zero additional simulated writes on an already reached target. Existing label/controller tests were updated, and the bundled SDK integration now verifies FADE -- after a completed fixed fade. The 55 tests pass under both supported runtimes. All control writes in these checks use simulators.

After restarting Stream Deck, a fresh process reported version 1.5.2.0. Live inspection of an existing fixed 0 dB/3-second action showed FADE -- with gray function text and a confirmed 0.0 dB footer. The name and mixer background remained visible, and the toggle button retained FADE OUT. Inspection opened the existing folder and selected a button in the editor; no button setting or real mixer control was changed. Official validation, public-file checks and release packaging passed.

## 1.5.1: toggle-only IN/OUT labels and corrected unity

FADE OUT / FADE IN now appear only for the toggle operation. All fixed fade targets, including −∞ and 0 dB, use UP/DOWN according to confirmed position, with the existing at-goal history and unknown-state fallback. Existing label/controller/color tests were updated accordingly.

The user reported that a fixed 0 dB target landed at −0.82 dB on the console. They then confirmed input 2 at exactly 0 dB, and a read-only snapshot returned `line/ch2/volume = 0.74609375 (191/256)`. The old polynomial's 0 dB output was about 0.7252. Conversion now anchors unity at the observed value, continuously rescales each side of the empirical curve, and inverts that same corrected curve. Other points and models remain approximate. No new real control write was performed, so the corrected write endpoint has simulator coverage and a real read reference, not an agent-triggered hardware return test.

Two new tests verify the independent unity reference and Float32 bytes, quantized feedback display without negative zero, bounds, continuity, monotonicity and inverse conversion across the supported range. The service and bundled SDK tests additionally assert the independent 0.74609375 endpoint for fixed and toggle returns. All 53 tests pass under both supported runtimes.

After a full Stream Deck restart, a fresh plugin process reported version 1.5.1.0. Live inspection showed an existing fixed 0 dB/3-second action as FADE UP, a floor action as FADE DOWN and the toggle button retaining FADE OUT. The revised label explanation was visible. The agent did not change button settings or trigger mixer controls during this inspection. Official validation and public-file checks passed; installer, public source and checksums were regenerated.

## 1.5.0: single-button toggle fades

The new toggle operation alternates between the floor and 0 dB, uses one duration in both directions, and previews the next press as FADE OUT / FADE IN. It derives its next endpoint from confirmed position or an active fade destination, including rapid reversal before the first step. It does not save an alternating flag. A replacement fade accepts the superseded command's outstanding expected echo while waiting to read its confirmed starting position. Offline presses reject, and reconnect never replays the old toggle.

Six new automated tests cover confirmed endpoints, duplicate previews, rapid reversals, outstanding feedback, queued instant toggles, offline/reconnect behavior, inspector persistence and label selection. The existing bundled SDK WebSocket/TCP integration test additionally performs both toggle directions against the localhost simulator. All 51 tests pass under development Node.js 22 and Stream Deck's Node.js 20.20.2. These are simulation checks, not real mixer write acceptance.

Stream Deck was fully restarted and a new plugin process confirmed version 1.5.0.0. The existing button inspector's Level action menu visibly contains Toggle fade −∞ / 0 dB. The menu was closed without changing the selected operation or triggering a real mixer control. Visual inspection also caught and corrected the hidden help text's CSS display override; the toggle-only explanation stays hidden for other operations. New toggle control writes were tested only against simulators.

## 1.4.0: infinity selection and directional fade functions

The fixed-target −∞ checkbox stores the established −84 value and restores legacy floor settings. Regular fixed targets remain −60 to +10 dB, relative targets ±12 dB. FADE OUT is reserved for a fixed floor target, FADE IN for fixed 0 dB; relative changes use DOWN/UP by sign. Intermediate fixed targets use the confirmed current position. Their direction is retained within confirmation tolerance at the target and while offline, with shared bounded history for duplicate buttons. No prior direction and unknown/equal current position displays FADE. The previous manual label override is no longer used. No mixer command paths or fade interpolation were changed.

Two new label tests cover endpoint, relative, instant, no-op and intermediate cases plus quantized final echoes and missing state. A new inspector test verifies checkbox persistence, legacy −84 restoration, input limits and switching to relative mode. Existing controller tests cover live direction changes, duplicate buttons and offline history. All tests use simulators; real mixer control writes remain outside these checks.

The initial inspector check showed the existing real input-2 button's stored −84 value in the disabled numeric field, the checked Target −∞ option and the new explanatory text. However, a later investigation established that the CLI restart had reported success while the old plugin process remained running: the inspector files had updated, but the running button renderer had not. The earlier inspection did not prove that the new renderer was loaded.

A full Stream Deck application restart replaced the old process; its new launch arguments confirmed version 1.4.0.0. Live inspection then showed FADE DOWN on the existing relative −6 dB button. Temporarily changing only its configured step to +6 displayed FADE UP; restoring −6 displayed FADE DOWN again. No real mixer control button was triggered and the original button settings were restored. The fixed −3 dB button showed neutral FADE because its confirmed current position already matched the target and there was no prior direction in the fresh process. Automatic direction changes against a moving fader remain verified in simulation. Developer mode was restored to its prior state. Future reload checks must verify a new plugin process or the changed button behavior rather than trusting the CLI success message alone.

## 1.3.1: restart persistence and inspector regression

Stream Deck's local log reported a failure parsing this plugin's global settings from credentials on startup. The previous fallback could then write the documentation example address as configuration. The fix uses a flushed, atomically replaced local IP file outside the repository, migrates valid existing globals, rejects the sample address, and acknowledges saves only after local readback. Empty global values never erase a valid local address. SDK globals remain a compatibility mirror.

The unfinished persistence update also changed the outgoing inspector context from the registration UUID to `actionInfo.context`. Live button edits stopped reaching Stream Deck. Restoring the registration context fixed this; the PI regression test deliberately provides different IDs and asserts the correct outgoing messages. IP requests now go through the plugin and use correlated replies, with stale/failure/timeout handling.

Live inspection verified channel 1 → 2 → 1 on an existing mute button: its channel number and mixer name updated each time, and its original assignment was restored. The actual mixer IP loaded, and saving it unchanged produced the verified local-save confirmation. The private local file exists and contains a non-example address. No real mixer control key was triggered. A fresh plugin process is tested with empty SDK globals and reconnects from the saved local file. A full PC reboot was not performed by the agent.

After a further live plugin restart, a newly opened inspector for a different existing button loaded the same actual mixer address and the connection recovered. The final official Elgato validation completed with access to its public schemas; the earlier restricted invocation had been unable to fetch them.

## English/public release

Version 1.2.0 translated button states, target labels, action names/tooltips, property-inspector controls, errors, diagnosis and project documentation. Version 1.2.1 uses uppercase FADE IN / FADE OUT function labels and finishes translating a few low-level errors. Version 1.3.0 adds read-only channel-color backgrounds with automatic text contrast, red mute overrides and gray unknown/offline overrides. The configured function remains prominent on level/fade buttons, with the confirmed current level below. Plugin/action UUIDs and settings keys are unchanged; existing custom and mixer names remain user data.

The source and installer now use `192.0.2.1`, a documentation-only default. The prior installation's effective mixer address was saved in local global settings before the source default changed. Public exports exclude old private deliveries, research, diagnostics, logs, dependency folders and generated bundles. `.gitignore`, public-file checks, English filenames, a clean source ZIP and publication instructions support a public repository.

## Environment and checks

Windows 11 Pro 23H2, build 22631.6199; Stream Deck 7.6.0.23012 with a normal 15-key device. Development Node.js 22.23.2/npm 10.9.8; the currently installed Stream Deck runtime is Node.js 20.20.2 (previous checks used 20.20.0). The 57 current tests were executed with 20.20.2. SDK 3.0.2, CLI 1.10.2 and the StudioLive API development reference 1.9.1 remain pinned. No new npm dependencies were added.

| Check | Result |
|---|---|
| Type checking | Passed |
| Automated tests under Node.js 22 | 57 of 57 passed |
| Built tests under Stream Deck Node.js 20.20.2 | 57 of 57 passed |
| Build targeting Node.js 20 | Passed |
| Official Elgato manifest/file validation | Passed |
| English live button and inspector inspection | Passed; existing mixer connection and settings retained |
| Public-file checks | Source and built plugin passed |
| Clean public source ZIP (1.2.0) | Extracted, dependencies installed from the pinned lockfile using the local offline npm cache; build, public-file check and CLI validation passed |
| Official packaging and release files | Version 1.4.0.0 installer, public source ZIP and SHA-256 checksums generated |

Release artifacts are the version 1.4.0 installer, clean public source ZIP and SHA-256 checksums. The original double-click installation dialog remains outside the tested scope.

## Automated test coverage

Tests connect only to local simulators, never to a real mixer address:

- Explicit mute on/off, toggle, idempotent on/off, external feedback and duplicate buttons.
- Unknown startup state, invalid settings, unavailable optional targets, rapid queue ordering, wrong/missing confirmations, disconnect and reconnect without replayed work.
- Profile/folder lifecycle, restart and listener cleanup; both action IDs and Multi-Actions through the official SDK in a separate plugin process.
- Mute target paths and inverted Aux/FX send assignments.
- Snapshot names/groups/faders, live PS names, PV feedback, MS quantization and index limits; nested DCA values cannot replace channel faders.
- Fixed levels, rapid relative steps, limits and floor behavior.
- Confirmed fade steps and final target, interleaved mutes, superseding commands, stop and external cancellation.
- Stop during an unconfirmed step; subsequent commands wait for its echo or timeout.
- Permanent function labels across live level changes and offline state; the smaller bottom line shows the actual level or state message.
- Inspector persistence of legacy settings, send targets, automatic names, level steps, duration, infinity targets and stop.
- Packet framing, chunk assembly, malformed data, bounded handshake, keepalive and clean shutdown.
- Three color tests cover snapshot integer/RGBA order, signed values, transparent/invalid colors, strict PC decoding and color-write rejection, duplicate/level buttons, text contrast, mute priority, fallback and offline clearing. Existing TCP adapter and SDK integration tests also exercise live PC color updates without color writes.
- Five address-store/service tests cover migration, invalid/empty/sample settings, failed SDK persistence, failed local writes, malformed files and serialized saves. The SDK integration suite also launches a fresh process from the same temporary local store with missing globals. Inspector tests verify registration context, confirmed saves, timeout/failure handling and unchanged action-settings behavior. Tests isolate their address files in temporary directories and never read or write the real user's mixer configuration.

These tests do not prove real write compatibility or calibrate the mixer dB scale.

## Real hardware: read-only checks performed earlier

User-reported device: StudioLive 24 Series III console, firmware 3.4.0.111374. Model/firmware were not independently queried. Direct TCP subscription and initial state succeeded, followed by seven seconds of keepalive observation. The configured address and received names were not printed by the diagnosis tool.

| Received state | Count |
|---|---:|
| Input Main mutes | 24 |
| Input levels | 24 |
| Name fields on supported channels/buses/returns | 106 |
| Mute groups | 8 |
| Main mute | 1 |
| Sub mutes | 4 |
| Aux / FlexMix bus mutes | 16 |
| FX bus mutes | 4 |
| FX return mutes | 4 |
| Aux send assignments | 384 |
| FX send assignments | 96 |

Parameter presence verifies reading, not successful execution of all writes. The user reported that the implemented functions worked and confirmed the intended channel name. No independent agent-triggered real control-write acceptance was performed.

A later read-only color investigation confirmed that the real snapshot also contains channel color fields, including `line/ch1/color`. The reference library decodes these and live PC messages as RGBA bytes. Version 1.3.0 now reads allowlisted color fields and applies them to normal button backgrounds. No color or mixer control writes were performed during the investigation or UI inspection.

## Installed software and display history

The plugin was linked using the official CLI, registered under the bundled Node runtime, and displayed confirmed mixer state. Earlier display checks verified mixer name prominence, readable scope text, permanent Fade In/Fade Out roles and the function/level layout swap. Existing profiles were retained. Reload checks temporarily enabled developer mode and restored its prior state. No real mixer control button was triggered during these inspections.

For the English release, the installed UI shows OPEN, CHANNEL, FADE STOP, Mute / Group / Send and Level / Fade. The level inspector shows English target, operation, duration and fade-label fields. The mixer remained connected after changing the packaged default, confirming the retained local address. Inspection only selected a button in the editor; no real control key was triggered or per-button setting changed. Stream Deck's own application chrome remains in the user's chosen language.

Version 1.3.0 was reloaded and visually checked: the existing input-1 mute and level/fade keys use the light-blue color received from the mixer with dark readable text. Function labels and the smaller current level remain in place. No real mute, fader or channel-color change was triggered. Live color changes and red/gray priority were verified through simulation rather than by changing real hardware settings. Developer mode was restored to its prior state.

The double-click installation dialog was not separately tested; local software inspection used the linked plugin directory.

## Hardware acceptance and limits

New real control tests require an explicitly authorized target and time. Verify external name changes, each required mute/group/send target, approximate dB targets against the real scale, fade duration/stop/external override, disconnect handling and complete Multi-Action sequences. Account for group membership, stereo links and Link Aux Mutes. Restore the intended state afterward.

There is no exclusive fader lock or transaction ID used here. Simultaneous matching changes and delayed/quantized echoes can be indistinguishable. Stop cannot recall an already transmitted value. Unknown execution is not blindly retried. Fades move normalized fader positions without changing mutes, and slow replies may extend their duration.

## Historical records

[Version 1.0 report](docs/TEST-REPORT-1.0.md), [original architecture review](docs/ARCHITECTURE-1.0.md), [current architecture](docs/ARCHITECTURE.md) and [changelog](CHANGELOG.md).
