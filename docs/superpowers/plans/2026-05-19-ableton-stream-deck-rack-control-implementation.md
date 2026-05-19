# Ableton Stream Deck Rack Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a testable TypeScript foundation for a Stream Deck + plugin and Max for Live bridge that exchange Ableton Rack macro state over localhost WebSocket JSON.

**Architecture:** A shared protocol package defines validated message types and slot/bank helpers. The Stream Deck side hosts the WebSocket server, tracks four dial contexts, renders feedback through an adapter, and emits dial deltas. The Max for Live side provides a Node-for-Max-compatible bridge client plus a Live-state controller that can be tested with fake Live API adapters before it is wired into a real `.amxd` patch.

**Tech Stack:** TypeScript, Node.js ESM, Vitest, `ws` for local WebSocket transport, lightweight adapters for Stream Deck SDK and Max for Live.

---

## File Structure

- `package.json`: npm scripts, dependencies, and project metadata.
- `tsconfig.json`: shared TypeScript config.
- `vitest.config.ts`: unit/integration test configuration.
- `src/protocol/messages.ts`: message schemas, type guards, normalization helpers.
- `src/protocol/banks.ts`: mapping between up to 8 Ableton parameters and 4 Stream Deck dial slots.
- `src/streamdeck/state.ts`: pure state reducer for device, bank, slot, connection, and dial delta behavior.
- `src/streamdeck/feedback.ts`: converts state slots into Stream Deck feedback payloads through an adapter interface.
- `src/streamdeck/server.ts`: localhost WebSocket server used by the Stream Deck plugin process.
- `src/streamdeck/plugin.ts`: thin Stream Deck SDK-facing action/controller glue.
- `src/maxforlive/client.ts`: Node-for-Max WebSocket client with reconnect and message handlers.
- `src/maxforlive/live-adapter.ts`: interfaces for selected-track/device and parameter operations.
- `src/maxforlive/controller.ts`: bridge controller that turns Live state into protocol messages and applies deltas.
- `src/harness/fake-ableton-client.ts`: command-line fake Ableton sender for manual bridge tests.
- `tests/protocol/*.test.ts`: protocol and banking tests.
- `tests/streamdeck/*.test.ts`: Stream Deck state/server/feedback tests.
- `tests/maxforlive/*.test.ts`: Max for Live client/controller tests.
- `tests/integration/*.test.ts`: in-process WebSocket roundtrip tests.
- `docs/dev-testing.md`: how to run automated and manual harness tests.

## Task 1: Project Scaffold And Shared Protocol

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/protocol/messages.ts`
- Create: `src/protocol/banks.ts`
- Create: `tests/protocol/messages.test.ts`
- Create: `tests/protocol/banks.test.ts`

- [ ] **Step 1: Write failing protocol tests**

Add tests that validate message type guards, normalized value clamping, and rejection of malformed messages.

- [ ] **Step 2: Write failing bank mapping tests**

Add tests for 1, 4, 8, and more than 8 parameters. Empty slots must be disabled and never duplicate another parameter.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- tests/protocol/messages.test.ts tests/protocol/banks.test.ts`

Expected: FAIL because files/functions do not exist yet.

- [ ] **Step 4: Implement minimal protocol and bank modules**

Implement only the types/helpers needed by the tests:

- `isBridgeToPluginMessage(value)`
- `isPluginToBridgeMessage(value)`
- `normalizeParam(rawParam)`
- `buildBankView(params, bank)`
- `getParamForDial(params, bank, dialIndex)`

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm test -- tests/protocol/messages.test.ts tests/protocol/banks.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add shared bridge protocol`

## Task 2: Stream Deck State, Feedback, And WebSocket Server

**Files:**
- Create: `src/streamdeck/state.ts`
- Create: `src/streamdeck/feedback.ts`
- Create: `src/streamdeck/server.ts`
- Create: `tests/streamdeck/state.test.ts`
- Create: `tests/streamdeck/feedback.test.ts`
- Create: `tests/streamdeck/server.test.ts`

- [ ] **Step 1: Write failing state tests**

Cover:

- disconnected state renders four disabled slots
- `device.changed` stores device and active bank
- `param.changed` updates exactly one cached parameter
- bank switch from 0 to 1 maps slots 4-7
- rotating an empty slot emits no command
- rotating a mapped slot emits `param.delta`

- [ ] **Step 2: Write failing feedback tests**

Use a fake Stream Deck adapter and assert that mapped slots receive title/value/indicator feedback while empty slots are disabled.

- [ ] **Step 3: Write failing server tests**

Start a server on a random localhost port, connect a fake WebSocket client, send `device.changed`, and assert the server notifies registered listeners. Simulate a dial delta and assert JSON is sent to the bridge client.

- [ ] **Step 4: Run tests and verify RED**

Run: `npm test -- tests/streamdeck/state.test.ts tests/streamdeck/feedback.test.ts tests/streamdeck/server.test.ts`

Expected: FAIL because implementation files are missing.

- [ ] **Step 5: Implement Stream Deck modules**

Implement pure state first, then feedback adapter, then WebSocket server. Keep Stream Deck SDK calls behind interfaces so tests do not need hardware.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `npm test -- tests/streamdeck/state.test.ts tests/streamdeck/feedback.test.ts tests/streamdeck/server.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: add stream deck bridge server`

## Task 3: Max For Live Bridge Client And Live Controller

**Files:**
- Create: `src/maxforlive/client.ts`
- Create: `src/maxforlive/live-adapter.ts`
- Create: `src/maxforlive/controller.ts`
- Create: `tests/maxforlive/client.test.ts`
- Create: `tests/maxforlive/controller.test.ts`

- [ ] **Step 1: Write failing WebSocket client tests**

Cover:

- client sends `bridge.hello` after connect
- client forwards incoming `param.delta` and `bank.set`
- client reconnect logic can be started/stopped without leaking timers

- [ ] **Step 2: Write failing controller tests**

Use a fake Live adapter. Cover:

- selected Rack with 1 parameter emits one mapped parameter and three disabled Stream Deck slots through protocol state
- selected Rack with 8 parameters emits 8 parameters
- selected Rack with more than 8 parameters truncates to 8
- applying continuous `param.delta` clamps to min/max
- applying quantized `param.delta` steps by item index
- stale device/parameter ids are ignored

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- tests/maxforlive/client.test.ts tests/maxforlive/controller.test.ts`

Expected: FAIL because implementation files are missing.

- [ ] **Step 4: Implement Max for Live modules**

Implement a Node-for-Max-friendly WebSocket client and a controller that depends on `LiveAdapter`, not directly on Max objects.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm test -- tests/maxforlive/client.test.ts tests/maxforlive/controller.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add max for live bridge controller`

## Task 4: SDK Glue, Test Harness, And Documentation

**Files:**
- Create: `src/streamdeck/plugin.ts`
- Create: `src/harness/fake-ableton-client.ts`
- Create: `tests/integration/websocket-roundtrip.test.ts`
- Create: `docs/dev-testing.md`
- Modify: `README.md`

- [ ] **Step 1: Write failing integration test**

Start the Stream Deck server in process, connect a fake Max for Live client, send `device.changed`, trigger a dial rotation through the state/controller API, and assert the fake client receives `param.delta`.

- [ ] **Step 2: Run integration test and verify RED**

Run: `npm test -- tests/integration/websocket-roundtrip.test.ts`

Expected: FAIL because harness/glue does not exist.

- [ ] **Step 3: Implement plugin glue and harness**

Implement a thin plugin controller that can be called by real SDK action events later, plus a fake Ableton client script for manual local testing.

- [ ] **Step 4: Document test commands**

Document:

- `npm install`
- `npm test`
- `npm run typecheck`
- fake client usage
- what still requires Ableton/Stream Deck hardware verification

- [ ] **Step 5: Run integration test and full verification**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add bridge harness and docs`

## Final Verification

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Review `git status --short`.
- [ ] Confirm no generated build artifacts are tracked.
- [ ] Summarize what is automated-testable now and what still needs Ableton/Stream Deck manual verification.
