# Ableton Stream Deck Rack Control Design

Date: 2026-05-19

## Goal

Build a Stream Deck + plugin and Max for Live bridge that make the four Stream Deck + dials follow the currently selected Ableton Rack/device and control its Rack macros/parameters dynamically.

Ableton Live is the source of truth. The user builds Ableton Racks intentionally, so the system must not require a separate mapping file per plugin or Rack.

## Confirmed Decisions

- Use Max for Live, not a Python Remote Script, for the first version.
- Follow the Ableton UI-selected device, not the Blue Hand / appointed device.
- Treat the selected Rack/device's parameter list as the mapping source.
- Support up to 8 controllable parameters through two banks:
  - Bank A: slots 1-4
  - Bank B: slots 5-8
- Stream Deck + has four physical dials, so it cannot show all 8 parameters at once without banking.
- Empty parameter slots are shown as blank/disabled. They are not duplicated or filled with fake values.
- Do not build custom per-plugin mapping files in the MVP.
- Use localhost JSON over WebSocket for bidirectional communication.
- Host the WebSocket server in the Stream Deck plugin. The Max for Live device connects as a client.

## User Workflow

1. User selects a Rack/device in Ableton Live's device/detail area.
2. Max for Live observes the selected track and selected device.
3. When the selected device changes, Max for Live reads up to 8 relevant parameters.
4. Max for Live sends the current device state to the Stream Deck plugin.
5. Stream Deck + displays up to four parameters for the active bank.
6. User rotates a dial.
7. Stream Deck plugin sends a parameter delta to Max for Live.
8. Max for Live sets the corresponding Ableton parameter value.
9. If the user changes a parameter in Ableton with mouse/automation UI, Max for Live sends the updated value back to Stream Deck.

## Architecture

```text
Ableton Live selected Rack/device
  |
  | Live API: selected_track -> selected_device -> parameters
  v
Max for Live Bridge Device
  |
  | WebSocket JSON on 127.0.0.1
  v
Stream Deck Node Plugin
  |
  | setFeedback / setFeedbackLayout
  v
Stream Deck + dials and touch strip
```

Reverse control path:

```text
Stream Deck dialRotate event
  |
  | ticks, slot, bank, optional fine mode
  v
Stream Deck Node Plugin
  |
  | WebSocket JSON param.delta
  v
Max for Live Bridge Device
  |
  | Live API set parameter value
  v
Ableton Rack/device parameter
```

## Ableton / Max for Live Component

The Max for Live device is responsible for Ableton state. It should keep Stream Deck free of Ableton-specific path resolution.

Responsibilities:

- Observe `live_set view selected_track`.
- Observe the selected track's `view selected_device`.
- Rebuild parameter observers when the selected device changes.
- Read parameter metadata:
  - id
  - slot
  - name
  - value
  - display_value
  - min
  - max
  - is_quantized
  - is_enabled
  - value_items when available
- Observe parameter value/display changes and push updates.
- Receive dial delta commands and set parameter values.
- Use deferred writes where needed so Live API writes are not triggered directly from notification callbacks.
- Treat Live object ids as session-local and not durable.

Rack handling:

- V1 should focus on selected Racks and their visible macro/control parameter surface.
- A selected normal device may still be supported as a fallback by reading its first available automatable parameters, but Rack macros are the primary target.
- Nested Rack chain/device exploration is out of scope for MVP because the user's Racks already expose the desired controls as macros.

## Stream Deck Plugin Component

The Stream Deck plugin is responsible for hardware interaction and visual state.

Responsibilities:

- Define an Encoder/Dial action for Stream Deck +.
- Track four active dial action contexts.
- Host a WebSocket server on `127.0.0.1`.
- Show disconnected/empty state when Max for Live is not connected.
- Receive device/parameter state from Max for Live.
- Render parameter names, display values, and normalized value bars through `setFeedback`.
- Maintain active bank index.
- Send dial rotation as `param.delta`.
- Disable feedback and ignore rotation for empty slots.
- Debounce or coalesce high-frequency feedback updates.

Initial feedback layout:

- Use an official built-in feedback layout for MVP.
- Add a custom layout only after the control loop is proven.

Banking:

- Default to bank 0 on new selected device.
- Bank 0 maps parameter slots 0-3.
- Bank 1 maps parameter slots 4-7.
- Bank switch can initially be a separate Stream Deck action or dial press behavior.
- Pressed dial rotation can later be used for fine/coarse mode, but this is not required for MVP.

## WebSocket Contract

All messages are JSON objects with a `type` field.

### Max for Live to Stream Deck

`bridge.hello`

```json
{
  "type": "bridge.hello",
  "protocolVersion": 1,
  "bridgeName": "Ableton Rack Bridge"
}
```

`device.changed`

```json
{
  "type": "device.changed",
  "device": {
    "id": 12345,
    "name": "Performance Rack",
    "className": "AudioEffectGroupDevice",
    "isRack": true
  },
  "bankCount": 2,
  "activeBank": 0,
  "params": [
    {
      "slot": 0,
      "id": 9001,
      "name": "Cutoff",
      "value": 0.43,
      "displayValue": "1.24 kHz",
      "min": 0,
      "max": 1,
      "normalized": 0.43,
      "isQuantized": false,
      "isEnabled": true,
      "valueItems": []
    }
  ]
}
```

`param.changed`

```json
{
  "type": "param.changed",
  "deviceId": 12345,
  "paramId": 9001,
  "slot": 0,
  "value": 0.45,
  "displayValue": "1.38 kHz",
  "normalized": 0.45
}
```

`device.cleared`

```json
{
  "type": "device.cleared",
  "reason": "no-selected-device"
}
```

### Stream Deck to Max for Live

`plugin.hello`

```json
{
  "type": "plugin.hello",
  "protocolVersion": 1,
  "pluginName": "Ableton Rack Dials"
}
```

`bank.set`

```json
{
  "type": "bank.set",
  "bank": 1
}
```

`param.delta`

```json
{
  "type": "param.delta",
  "deviceId": 12345,
  "paramId": 9001,
  "slot": 0,
  "ticks": 2,
  "fine": false
}
```

## Parameter Delta Rules

For continuous parameters:

- Convert ticks into an internal value delta.
- Start with a conservative step size, such as `(max - min) / 256`.
- Use a smaller step for fine mode if added later.
- Clamp to `min` and `max`.

For quantized parameters:

- Use `value_items` when available.
- Move by item index, not by raw float delta.
- Clamp to the first/last item.

For disabled or missing parameters:

- Ignore rotation.
- Keep the Stream Deck slot disabled/blank.

## Error Handling

- If Stream Deck starts before Ableton, it shows "Live disconnected".
- If Ableton starts before Stream Deck, Max for Live reconnects until the plugin is available.
- If selected device has no suitable parameters, Stream Deck shows blank/disabled slots.
- If the WebSocket disconnects, both sides clear stale state and reconnect.
- If a stale `param.delta` references an old device/parameter id, Max for Live ignores it.
- The server binds only to `127.0.0.1`, not `0.0.0.0`.
- A shared token/session nonce should be added before packaging beyond local development.

## MVP Roadmap

### Phase 1: Stream Deck Dial Loop Without Ableton

Deliver a Stream Deck plugin with four Encoder actions. Each dial shows a dummy parameter and local value. Rotating a dial changes the local dummy value and updates feedback.

Acceptance:

- The Stream Deck + dials receive rotation events.
- Each dial can update its own feedback area.
- Empty/disabled state can be rendered.

### Phase 2: WebSocket Bridge Test Harness

Add a localhost WebSocket server to the Stream Deck plugin and a standalone test client that sends fake Ableton messages.

Acceptance:

- `device.changed` updates the four visible dial slots.
- `param.changed` updates one slot without rebuilding everything.
- `param.delta` messages are emitted when dials rotate.
- Connection/disconnection state is visible.

### Phase 3: Max for Live Selection Bridge

Create the Max for Live bridge device. It observes selected track and selected device, then sends `device.changed` when the selected Rack/device changes.

Acceptance:

- Selecting a different Rack in Ableton updates Stream Deck labels/values.
- Selecting a device with fewer than four mapped parameters leaves unused slots disabled.
- Selecting a device with no suitable parameters clears the display.

### Phase 4: Parameter Writeback

Handle `param.delta` in Max for Live and set the corresponding Ableton parameter.

Acceptance:

- Rotating a Stream Deck dial changes the correct Ableton Rack macro.
- Continuous values move smoothly and are clamped.
- Quantized values step predictably.
- Stale parameter ids are ignored.

### Phase 5: Live Value Observers

Observe parameter values in Ableton and push `param.changed` messages to Stream Deck.

Acceptance:

- Moving a Macro in Ableton updates Stream Deck.
- Moving a dial on Stream Deck updates Ableton and the displayed value.
- Feedback does not flicker or flood.

### Phase 6: Banking and Polish

Add bank 0/1 switching for up to 8 parameters, then refine display and reconnection behavior.

Acceptance:

- Bank 0 shows slots 1-4.
- Bank 1 shows slots 5-8.
- Switching bank keeps the same selected Rack.
- Blank slots stay disabled.
- Reconnects recover current Ableton state.

## Out of Scope for MVP

- Per-plugin mapping files.
- Remote Script / Control Surface Script implementation.
- Following Blue Hand / appointed device.
- Deep nested Rack-chain parameter browsing.
- Cross-machine networking.
- Multiple simultaneous Ableton Live instances.
- Full custom touch-strip visual design before the control loop works.

## Risks and Mitigations

- Selected-device behavior may differ slightly from "any UI click".
  - Mitigation: explicitly follow `selected_track.view.selected_device` and test in Ableton.
- Live API notifications cannot safely trigger all writes directly.
  - Mitigation: defer write operations where required.
- Stream Deck and Ableton startup order is unpredictable.
  - Mitigation: reconnect loop and explicit disconnected state.
- Parameter ids are not durable.
  - Mitigation: rebuild state on selection/device change and ignore stale commands.
- Quantized parameters may expose item values differently.
  - Mitigation: implement continuous first, then add quantized stepping with tests.

## Verification Strategy

- Unit-test message parsing and slot/bank mapping in the Stream Deck plugin.
- Test the WebSocket bridge with a standalone fake Ableton client before using Ableton.
- Test Max for Live manually in Ableton with:
  - Rack with 1 macro
  - Rack with 4 macros
  - Rack with 8 macros
  - Rack with more than 8 macros
  - Normal device fallback
  - No selected device / unsupported device
- Verify Stream Deck + hardware behavior manually:
  - rotate each dial
  - bank switch
  - disconnect/reconnect Ableton
  - change selected Rack while Stream Deck is connected

## Source Notes

- Elgato Stream Deck SDK supports Encoder actions, dial rotation events, and touch-strip feedback through `setFeedback` / `setFeedbackLayout`.
- Max for Live Live Object Model exposes `Song.View.selected_track`, `Track.View.selected_device`, `Device.parameters`, and `DeviceParameter` metadata such as `value`, `display_value`, `min`, `max`, `is_quantized`, `is_enabled`, and `value_items`.
- Node for Max can run local Node scripts and is suitable for a WebSocket client inside the Max for Live device.
