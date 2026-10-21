# Publishing on GitHub

## Prepare a clean repository

Use the current `StudioLive-Mutes-1.6.1-source.zip` from `release/`, or regenerate it with the commands in the README. Extract its contents into a new folder. It contains the maintained source, English documentation, pinned dependency lockfile, plugin assets and MIT notices. It does not contain a `.git` directory, personal settings, historical private packages, local research or diagnostics.

Create a repository on GitHub with a name of your choice and the desired visibility, then upload the extracted contents or push them with Git. The snapshot already includes a README, MIT license, `.gitignore` and `.gitattributes`; a second generated license is unnecessary. Generating the source snapshot does not create a repository or publish anything to your account.

The original development workspace may contain ignored private files and older private installers. Use the clean source snapshot for the initial upload. Do not attach historical private ZIPs or installers to the public repository or a release.

## Reproduce the release

On Windows, install Node.js 22.23 or later and Stream Deck 7.1 or later, then run:

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

`npm test` builds the plugin first. The SDK integration test uses localhost TCP 53000; the port must be free. To check the actual bundled runtime, run the built tests with Stream Deck's Node.js 20 executable as well.

`check:public` checks the source inventory and built plugin for private network addresses, personal Windows user paths and private key markers. The source exporter enforces the documentation-only default address and applies the same source checks. These checks cover the files selected for publication, not ignored local folders.

## Create a release

Create a tag such as `v1.6.1`, write release notes from `CHANGELOG.md`, and attach only:

- `de.local.studiolive-mutes.streamDeckPlugin`
- `StudioLive-Mutes-1.6.1-source.zip`
- `SHA256SUMS.txt`

Keep the compatibility and testing scope from `TEST-REPORT.md` clear in the release description. Users must enter their own mixer address after installing. Release files and generated plugin bundles are intentionally ignored by Git.

## Future changes

Update `package.json`, the root package entry in `package-lock.json`, the runtime plugin `package.json`, and the four-part manifest version together. Keep plugin/action UUIDs stable for existing profiles. Add a changelog entry, rerun validation and checks, and regenerate release checksums. Never include live profile exports, logs or real mixer addresses in issues or fixtures; use documentation-only addresses in examples.
