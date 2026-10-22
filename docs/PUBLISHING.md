# Build and publish

Release workflow for **StudioLive Control 1.0.0**. The [repository](https://github.com/JonasHRR/StudioLive-StreamDeck-Plugin) holds the source; installers and source archives are attached to GitHub Releases.

## Build and check

Use Node.js **22.23 or later**, npm and Stream Deck **7.1 or later**. The recorded build host is Windows. From the repository folder:

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

Run these in order and stop on failure. Tests build first and use simulators; SDK integration needs localhost TCP **53000** to be free. Stream Deck supplies Node.js 20 for the installed plugin.

Also check the built tests under Stream Deck's runtime. On the recorded Windows installation:

```powershell
$streamDeckNode = Join-Path $env:APPDATA 'Elgato\StreamDeck\NodeJS\20.20.2\node.exe'
$testFiles = Get-ChildItem build/tests -Filter '*.test.js' | ForEach-Object FullName
& $streamDeckNode --test @testFiles
```

Adjust the path for the installed runtime. Pass the expanded file list when using Node.js 20 on Windows.

## Generated files

| File in `release/` | Purpose |
|---|---|
| `de.local.studiolive-mutes.streamDeckPlugin` | Installer for Windows and macOS. |
| `StudioLive-Control-1.0.0-source.zip` | Clean source snapshot. |
| `SHA256SUMS.txt` | Installer and source checksums. |

For distribution, `release/v1.0.0/` also includes `RELEASE-1.0.0.md` and checksums covering all three assets. The optional `StudioLive-Control-1.0.0.zip` transfer archive contains the four files together.

The source exporter uses an explicit inventory. Local research, settings, logs, dependencies and generated bundles stay outside it. The plugin's `.sdignore` excludes runtime logs. `check:public` scans selected source and built plugin files for private addresses, personal Windows paths and private-key markers.

## Publish to GitHub

1. Review and commit the intended source and documentation.
2. Push the branch and create a tag for the release commit, such as **v1.0.0**.
3. Add release notes from the [changelog](../CHANGELOG.md) and [release notes](RELEASE-1.0.0.md).
4. Upload the installer, source archive, release notes and matching checksums.
5. Verify the uploaded files and publish the release.

A pushed tag alone does not upload the installer. Generated bundles and `release/` stay outside Git.

Use a new version for subsequent releases. Keep the package, lockfile, runtime package and manifest version aligned; the current versions are **1.0.0** and **1.0.0.0**. Keep plugin/action UUIDs stable so saved profiles remain compatible.

Use documentation-only addresses in examples and fixtures. Keep actual mixer addresses, profiles and logs out of commits and issue attachments. Describe compatibility using the [recorded test scope](../TEST-REPORT.md).
