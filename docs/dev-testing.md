# Development Testing

This project is a TypeScript foundation for an Ableton Live Rack control loop:
the Stream Deck plugin process hosts a localhost WebSocket server, and a Max for
Live bridge client sends selected-device state and receives dial delta commands.

## Setup

Install dependencies:

```bash
npm install
```

Run the automated test suite:

```bash
npm test
```

Run TypeScript checking:

```bash
npm run typecheck
```

Run only the WebSocket roundtrip integration test:

```bash
npm test -- tests/integration/websocket-roundtrip.test.ts
```

## Fake Ableton Client

The fake client connects to a running Stream Deck bridge server, sends
`bridge.hello`, sends a sample `device.changed` payload with eight Rack macros,
and prints any plugin-to-bridge messages such as `param.delta` or `bank.set`.

Default port:

```bash
npm run harness:fake-ableton
```

Custom port:

```bash
npm run harness:fake-ableton -- --port 17375
```

Custom URL:

```bash
npm run harness:fake-ableton -- --url ws://127.0.0.1:17375
```

Send the sample device with bank 1 active:

```bash
npm run harness:fake-ableton -- --bank 1
```

This harness is useful once a local Stream Deck plugin process is hosting
`StreamDeckBridgeServer`. It does not launch the plugin or Ableton Live.

## Still Needs Real Verification

Automated tests cover protocol validation, bank mapping, Stream Deck state,
feedback payload generation, WebSocket transport, Max for Live controller logic,
and an in-process bridge roundtrip.

The following still need manual verification with real software or hardware:

- Stream Deck SDK action registration and Stream Deck + dial event wiring.
- `setFeedback` rendering on the actual dial displays and touch strip.
- Max for Live device packaging inside Ableton Live.
- Live API observation of selected track/device and Rack macro changes.
- End-to-end latency and behavior during fast dial rotation.
