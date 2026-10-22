# From source to a release

This is the release workflow for **StudioLive Control 1.9.2**. The [repository](https://github.com/JonasHRR/StudioLive-StreamDeck-Plugin) holds the source; installers and source ZIPs are generated locally and attached separately when publishing a GitHub Release.

## Build and check

Use Windows, Node.js **22.23 or later**, npm, and Stream Deck **7.1 or later**. From the repository folder, run:

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

Run these in order and stop if a command fails. `npm test` builds first and runs the local simulator suite. Its SDK integration test needs localhost TCP **53000** to be free. Validation uses Elgato's CLI.

Also run the built tests with Stream Deck's installed Node.js 20 executable. For the recorded runtime version, PowerShell can do that like this:

```powershell
$streamDeckNode = Join-Path $env:APPDATA 'Elgato\StreamDeck\NodeJS\20.20.2\node.exe'
$testFiles = Get-ChildItem build/tests -Filter '*.test.js' | ForEach-Object FullName
& $streamDeckNode --test @testFiles
```

Adjust the runtime version in the path if your installation differs. Pass the expanded file list: Node.js 20 on Windows doesn't expand the wildcard the same way as the development runtime.

## What goes where

The commands produce these files in `release/`:

| File | Purpose |
|---|---|
| `de.local.studiolive-mutes.streamDeckPlugin` | Double-click installer for Stream Deck. |
| `StudioLive-Mutes-1.9.2-source.zip` | Clean source snapshot, including docs, assets, lockfile and licenses. |
| `SHA256SUMS.txt` | SHA-256 checksums for the installer and source ZIP. |

The source exporter uses an explicit inventory. Local research, logs, settings, old releases, dependencies and generated bundles are excluded. The plugin's `.sdignore` also excludes logs from packaging.

`check:public` scans the chosen source files and built plugin for private network addresses, personal Windows paths and private-key markers. It doesn't scan ignored local folders. Review the staged Git files as well; an ignored file should not become a release asset just because it happens to be in the workspace.

## Push the source

Review `git diff` and `git status`, commit the intended source and documentation changes, then push the branch to the existing repository. Keep `release/` and generated bundles out of Git.

For a separate clean checkout, extract the source ZIP into a new folder. It already includes the README, license, ignore rules and pinned lockfile. Exporting the ZIP itself doesn't publish anything.

## Publish a GitHub Release

Create a tag such as **v1.9.2** for the checked commit, write the notes from the [changelog](../CHANGELOG.md), and attach the three files above to its GitHub Release.

A pushed tag alone doesn't upload the installer. GitHub's automatic source download also doesn't contain the built plugin bundle.

Keep the [test scope](../TEST-REPORT.md) clear in the release notes, especially simulated 64-input coverage and outstanding hardware acceptance. Users enter their own mixer address after installing. Only attach the freshly generated files; older local packages may contain private configuration.

## When the version changes

Update these together:

- `package.json`
- Both root version entries in `package-lock.json`
- `de.local.studiolive-mutes.sdPlugin/package.json`
- The manifest's four-part version, such as `1.9.2.0`

Update the changelog and current documentation examples, rerun the checks, then rebuild the installer, source ZIP and checksums. Keep plugin/action UUIDs stable so existing profiles continue to work.

Use documentation-only addresses in examples and fixtures. Keep real mixer addresses, live profile exports and logs out of commits and issue attachments.
