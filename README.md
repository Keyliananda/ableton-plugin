# Ableton Stream Deck Rack Control

TypeScript foundation for controlling the currently selected Ableton Live Rack
from Stream Deck + dials. The Stream Deck side hosts a localhost WebSocket
server, tracks the active bank and dial contexts, renders feedback payloads, and
sends dial deltas back to the Max for Live bridge.

## Development

```bash
npm install
npm run build
npm run streamdeck:link
npm test
npm run typecheck
```

Build a portable Windows release package:

```bash
npm run build
npm run package:release
```

The generated package is written to `release/AbletonRackControl-<version>` and
contains `install.ps1`, README/INSTALL docs, the portable Stream Deck plugin,
the Max for Live bridge runtime, and the `Ableton Stream Deck 2.amxd` device.
The installer copies the device into Ableton's User Library. It prefers
`N:\Ableton Wolke\Ableton\User Library` when that cloud library exists, otherwise
it falls back to `Documents\Ableton\User Library`. Set `ABLETON_USER_LIBRARY` to
override the target path.

Run the local live-test host:

```bash
npm run harness:dev-live-host
```

The dev host and the real Stream Deck app both use `127.0.0.1:17375`; run only
one of them at a time. Quit the dev host with `q` before testing the hardware
plugin.

`npm run streamdeck:link` links the local `.sdPlugin` folder into Stream Deck's
plugin directory. Restart the Stream Deck app after rebuilding.

On Windows machines where PowerShell blocks `npm.ps1`, run:

```powershell
node .\dist\src\harness\dev-live-host.js
```

In a second terminal, connect the fake Ableton client:

```bash
npm run harness:fake-ableton
```

## Docs

- [Design](docs/superpowers/specs/2026-05-19-ableton-stream-deck-rack-control-design.md)
- [Implementation plan](docs/superpowers/plans/2026-05-19-ableton-stream-deck-rack-control-implementation.md)
- [Development testing](docs/dev-testing.md)
- [Live testing](docs/live-testing.md)
