# Implementation record

## Initial implementation

1. Inspect the Windows environment, Stream Deck runtime and existing project files.
2. Review the official SDK and the unofficial StudioLive implementation, including licenses and connection lifecycle risks.
3. Build a bounded read-only diagnostic tool.
4. Implement an isolated TCP transport, confirmed state service, button controller and property inspector.
5. Verify protocol, command queue, reconnect, SDK integration and lifecycle behavior with local simulators.
6. Validate and package the installer, source and documentation; record real hardware checks separately.

## Functional and display updates

Version 1.1 added names, groups, bus/send mutes, levels and cancellable fades. Versions 1.1.1–1.1.3 improved name prominence, bottom-line readability and permanent function labels. These updates retained action IDs and user settings. Automated tests and read-only UI checks are recorded in the test report; no agent-triggered real mixer control tests were performed.

## English public release

Version 1.2.0 translates the plugin and all project documentation into English. The public source and installer use a documentation placeholder rather than a personal mixer IP. The effective local address was retained in Stream Deck settings. Private working files and historical installers are excluded; public source exports and publishing instructions are included. Type checking, 32 simulation tests under both runtimes, public-file checks, UI inspection, Elgato validation and packaging passed. An extracted public snapshot was independently built with dependencies installed from the pinned lockfile using the local offline cache.

## Channel-color backgrounds

Version 1.3.0 reads color from snapshots and live PC feedback without enabling color writes. Mixer colors are normal backgrounds, with automatic text contrast, red mute overrides, gray unknown/offline overrides and existing fallbacks. The uppercase function layout is preserved. Numeric color encoding, invalid/unassigned data, live TCP/SDK feedback, duplicate keys, mute priority, offline clearing and strict write rejection are covered. Type checking and 35 tests passed under both runtimes. Read-only UI inspection confirms the actual input-1 color with dark text. Documentation, validation, installer, public sources and checksums were updated.

## Restart persistence and inspector regression

On October 19, Stream Deck logged a failure reading this plugin's global settings after startup. The old fallback could persist the example address. Durable, verified local IP storage outside the repository now replaces automatic example fallback. A partial change also used the action context in PI commands, breaking edits; the PI registration UUID is restored. Live channel 1 → 2 → 1 updates were verified and the initial assignment restored. The current address loaded and saved with an explicit confirmation, and remained available in a fresh inspector after another plugin restart. Type checking, 42 tests under both runtimes, public-file checks, official validation with schema access and version 1.3.1 release packaging passed. No real mixer control writes were performed.

## Infinity and automatic fade direction

On October 21, added a direct infinity target selection using the existing −84 value. The user chose automatic direction based on the current level for intermediate targets. OUT is reserved for the floor and IN for fixed 0 dB; UP/DOWN cover other goals and signed relative steps. Direction is retained within confirmation tolerance and while offline and shared across duplicate buttons; command behavior is unchanged. Type checking, 45 tests under Node 22 and the current Stream Deck Node 20.20.2, read-only UI inspection, English documentation and version 1.4.0 packaging passed. The actual −84 button restored the checked infinity option without changing its settings.

A follow-up found that the CLI restart reported success without replacing the old renderer process. A full application restart loaded version 1.4.0.0, verified through the new process and visible FADE DOWN / FADE UP behavior. The relative step was changed temporarily from −6 to +6 and restored, without triggering a mixer command. The test report corrects the earlier reload claim. Future reload verification must check actual process replacement or changed button behavior.

## Single-button toggle fades

Version 1.5.0 adds a level operation alternating the floor and 0 dB, with one duration and a preview of the next press. It derives direction from confirmed state and active destination, reverses immediately on another press, shares behavior across duplicate buttons, and retains offline rejection and no replay after reconnect. Replacement fades accept outstanding expected feedback before computing their starting position. Added six automated tests and extended the bundled SDK simulator check. Updated English documentation and release artifacts.

## Label cleanup and unity correction

Version 1.5.1 reserves IN/OUT for the toggle operation and applies the common directional logic to every fixed fade. A user-confirmed 0 dB input-2 position was read without control writes as 0.74609375. Both directions of the empirical conversion now share that unity anchor, with a continuous rescaling and explicit approximation limits for other points. Added independent wire-value and full-range curve checks and updated the SDK simulator to verify absolute and toggle returns against the observed value. The real corrected return remains for user verification.

## Reached fade goals

Version 1.5.2 shows FADE -- with gray function text when a fixed/relative fade would not change the confirmed level. Shared relative goal computation covers zero steps and clamped endpoints. The command-confirmation tolerance prevents quantization flicker; pending/unknown work, instant actions and toggle previews remain distinct. Updated English documentation and 55 simulation tests, including completed-fade rendering and no additional writes on a reached goal.

Version 1.5.3 makes the entire inactive button light gray, including all text, instead of tinting only the function. The inactive palette overrides mixer/mute backgrounds, retains the MUTE indicator and automatically restores normal colors when active again. Updated the existing rendering regression and verified all 55 tests under both runtimes.

## Custom colors and inactive tints

Version 1.6.0 adds per-button automatic/custom colors to both action types. Custom normal colors retain red mute and gray unknown/offline priority; inactive fades blend the current color with white. Validated preferences are display-only and never write mixer colors. Updated English documentation, inspector and color regressions, with 57 automated tests under both runtimes.

## GitHub source review

Version 1.6.1 fixes relative zero steps below the regular −60 dB target range, preserving exact confirmed positions without sending writes. The new service regression and extended label check failed before the fix. Type checking, all 58 tests under both runtimes, Elgato validation, publication checks and a full npm audit passed. Corrected the README source-archive version and retained the CLI packaging ignore rules in source exports. Created a local Git history from the clean publication inventory; private working files remain excluded.

## Mixer names in selection lists

Version 1.7.0 appends live mixer names to channel/bus/group/return selections and Aux/FX destinations, while retaining numeric assignments and unfinished inspector edits. Added a bounded online-only name catalog, one active inspector subscription with a session nonce and deduplicated updates, and numeric fallback without cached stale names. Two new tests and expanded SDK integration cover mappings, live renames, offline state and inspector lifecycle; all 60 tests include the preserved 1.6.1 zero-step fix.

## Inputs through channel 64

Version 1.8.0 expands input and send-source handling consistently to 64, while preserving destination limits and strict unknown-target rejection. Snapshot metadata and a shared completeness check support smaller banks without demanding nonexistent channels. Seven new tests exercise high-channel controls, feedback, names/colors, incomplete snapshots and 32/64 TCP reconnects. A real read-only subscription confirmed 32 logical inputs and input-32 level feedback; 64S write acceptance is not claimed. Updated documentation and release artifacts.

## Additional inputs — October 22, 2026

Version 1.9.0 adds A1/A2 stereo Aux inputs, Tape and Talkback with own mute/level/fade controls, names and colors. A read-only subscription confirmed the exact return/talkback paths and supported fields. Seven added tests and extended bundled SDK coverage exercise all four inputs against simulators, including unavailable-target rejection and numeric inspector assignments. Regular input numbering and bus/send limits are retained; talk destinations, routing, gain and phantom controls are excluded. Updated English documentation and release artifacts.

## Grouped additional inputs — October 22, 2026

Version 1.9.1 groups A1/A2, Tape and Talkback under Additional inputs in both action inspectors and renames Aux / FlexMix bus to Mix bus. Existing stored kinds/channel numbers remain unchanged. Updated inspector coverage verifies saved assignments, names and selection retention; control behavior remains covered by the existing simulator tests. Updated English documentation and release files.

## Compact inspector help — October 22, 2026

Version 1.9.3 reduces the inspector descriptions to brief hints and points to the existing User Guide for details. Controls, settings and mixer behavior are unchanged. Rebuilt and validated the release files.
