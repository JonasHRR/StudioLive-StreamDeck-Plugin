# Testing StudioLive Control

Use this checklist to verify installation and operation on Windows or macOS. Record the environment and results so platform support can be assessed consistently. The [test report](../TEST-REPORT.md) describes existing coverage.

## Test environment

Record:

- Plugin and Stream Deck versions.
- Operating system, computer model and processor architecture.
- Stream Deck hardware model.
- Mixer model, firmware and control-network setup.

Use a suitable test channel for control operations and restore its intended state afterward.

## Manual checks

| Check | Expected result |
|---|---|
| Install and open Stream Deck | StudioLive Control and both action types appear. |
| Open button settings | Target lists, names, colors and controls load correctly. |
| Save the mixer address | A save confirmation appears; another button uses the same address. |
| Restart Stream Deck | Address and assignments remain available; the mixer reconnects. |
| Save a replacement address | The new value is retained after restart; restore the intended address afterward. |
| Toggle a mute | The mixer and key show the same confirmed state. External changes update the key. |
| Set a fixed level and relative step | Feedback follows the resulting position. dB values remain approximate. |
| Use a new level button | It starts as a 3-second toggle fade between the floor and 0 dB. |
| Reverse and stop a fade | Reversal uses the current fade destination; stop sends no further step. |
| Use duplicate buttons | Confirmed state and fade previews agree. Custom colors remain independent. |
| Rename or recolor a channel | Names and automatic colors update without changing the assignment. |
| Disconnect and reconnect the network | Keys show OFFLINE, recover from fresh state and don't replay offline presses. |
| Sleep and wake the computer | Connection recovers after network availability returns. |
| Test other required targets | Buses, groups, sends and additional inputs work where the mixer provides valid feedback. |
| Run a Multi-Action | Explicit operations and chosen delays produce the intended sequence. |

## Platform settings

The address file is stored per user:

```text
Windows: %LOCALAPPDATA%\StudioLive-StreamDeck-Plugin\mixer-settings.json
macOS:   ~/Library/Application Support/StudioLive-StreamDeck-Plugin/mixer-settings.json
```

On macOS, allow local-network access for Stream Deck if prompted. Check the saved mixer address, control-network connection and TCP port 53000 when troubleshooting.

## Report an issue

Include the environment, exact steps, expected behavior and actual result. Note whether it happens after restart, network loss or sleep. Remove mixer addresses and personal paths from logs before sharing them.

Automated checks and runtime commands are described in [Build and publish](PUBLISHING.md).
