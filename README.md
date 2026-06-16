# Ableton Stream Deck Rack Control

TypeScript foundation for controlling the currently selected Ableton Live Rack
from Stream Deck + dials. The Stream Deck side hosts a localhost WebSocket
server, tracks the active bank and dial contexts, renders feedback payloads, and
sends dial deltas back to the Max for Live bridge.

## Development

```bash
npm install
npm test
npm run typecheck
```

Run the local live-test host:

```bash
npm run harness:dev-live-host
```

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
