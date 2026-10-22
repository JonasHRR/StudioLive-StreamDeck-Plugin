# From source to a release

This is the workflow for **StudioLive Control 1.0.0** (manifest **1.0.0.0**), the shared Windows/macOS release. The [repository](https://github.com/JonasHRR/StudioLive-StreamDeck-Plugin) contains the source. A local build does not publish a GitHub Release.

## Build and check

Use Node.js **22.23 or later**, npm, and Stream Deck **7.1 or later**. The recorded build host is Windows. Build scripts use portable JavaScript; building the source on a native Mac is not independently verified. From the repository folder:

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

Run the commands in order and stop on failure. Tests build first and use local simulators; SDK integration requires localhost TCP **53000** to be free. Validation uses Elgato's CLI. Stream Deck supplies Node.js 20 for the installed plugin.

Also run the built tests under the installed Stream Deck runtime. On the recorded Windows host:

```powershell
$streamDeckNode = Join-Path $env:APPDATA 'Elgato\StreamDeck\NodeJS\20.20.2\node.exe'
$testFiles = Get-ChildItem build/tests -Filter '*.test.js' | ForEach-Object FullName
& $streamDeckNode --test @testFiles
```

Adjust the runtime version for the local installation. Pass expanded file paths because Node.js 20 on Windows does not expand this wildcard like the development runtime.

## Release files

The commands produce the shared installer `de.local.studiolive-mutes.streamDeckPlugin`, `StudioLive-Mutes-1.0.0-source.zip` and `SHA256SUMS.txt` in `release/`. The root checksum file covers the installer and source ZIP.

The prepared distribution is also saved under `release/v1.0.0/`, with the installer, source ZIP, a copy of `docs/RELEASE-1.0.0.md` and checksums for all three files. The sibling `release/StudioLive-Control-1.0.0.zip` contains those four files and has a separate `.sha256` file. Unpack this transfer ZIP before opening the inner installer. Use the same installer on Windows and macOS.

Source export uses an explicit inventory. Local research, settings, logs, dependencies and generated bundles stay out. The plugin's `.sdignore` excludes runtime logs. `check:public` scans selected source and built plugin files for private addresses, personal Windows paths and private-key markers. Review Git changes too; ignored files do not automatically belong in releases.

## Version reset and installation

The owner requested **1.0.0** as the release number after the development builds through **1.9.4-macos-test.1**. This is numerically lower than those builds. Do not describe it as an automatic upgrade. Export profiles before switching; if Stream Deck blocks the downgrade, remove the old plugin and install 1.0.0, then restore profiles as needed. UUIDs and address-file locations remain stable. See [release notes](RELEASE-1.0.0.md).

Older 1.x changelog/test sections are development history. Preserve historical packages rather than replacing an unrelated earlier 1.0.0 asset or tag.

## Publish to GitHub

Review the source diff, commit the intended source and docs, and push to the existing repository. Generated bundles and `release/` remain outside Git. Use tag **v1.0.0** only after checking that it is unused; never overwrite a historical tag. Publish a normal release, with the current [release notes](RELEASE-1.0.0.md), freshly generated installer, source archive and checksums. Creating a local package does not perform these publication steps.

Keep the validation scope explicit: the user confirmed the preceding test build on one MacBook, without supplying chip/OS details. Automated tests run on Windows. Real 64S and additional-input write acceptance remain limited as recorded in [TEST-REPORT.md](../TEST-REPORT.md).

## Keep metadata aligned

Update `package.json`, both root version entries in `package-lock.json`, `de.local.studiolive-mutes.sdPlugin/package.json`, and the manifest's four-part version together. The current values are **1.0.0** and **1.0.0.0**. Update current docs and release notes, then rerun checks and regenerate all release artifacts. Keep plugin/action UUIDs stable.

Use documentation-only addresses in examples and fixtures. Keep actual mixer addresses, profiles and logs out of commits and public issue attachments.
