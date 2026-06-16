import { describe, expect, it } from "vitest";
import type { RackParam } from "../../src/protocol/messages.js";
import { applyBridgeMessage, createDisconnectedState, toggleDialBank } from "../../src/streamdeck/state.js";
import { renderFeedback, type FeedbackPayload, type StreamDeckFeedbackAdapter } from "../../src/streamdeck/feedback.js";

function param(slot: number, overrides: Partial<RackParam> = {}): RackParam {
  return {
    slot,
    id: 9000 + slot,
    name: `Param ${slot}`,
    value: slot / 10,
    displayValue: `${slot / 10}`,
    min: 0,
    max: 1,
    normalized: slot / 10,
    isQuantized: false,
    isEnabled: true,
    valueItems: [],
    ...overrides
  };
}

class FakeFeedbackAdapter implements StreamDeckFeedbackAdapter {
  readonly payloads: Array<{ context: string; payload: FeedbackPayload }> = [];

  setFeedback(context: string, payload: FeedbackPayload): void {
    this.payloads.push({ context, payload });
  }
}

describe("renderFeedback", () => {
  it("sends title, value, and indicator payloads for mapped slots", async () => {
    const adapter = new FakeFeedbackAdapter();
    const state = applyBridgeMessage(createDisconnectedState(), {
      type: "device.changed",
      device: {
        id: 12345,
        name: "Performance Rack",
        className: "AudioEffectGroupDevice",
        isRack: true
      },
      bankCount: 2,
      activeBank: 0,
      params: [param(0, { name: "Cutoff", displayValue: "1.24 kHz", normalized: 0.43 })]
    });

    await renderFeedback(adapter, state, ["dial-0", "dial-1", "dial-2", "dial-3"]);

    expect(adapter.payloads[0]).toEqual({
      context: "dial-0",
      payload: {
        title: "Cutoff",
        value: "1.24 kHz",
        layer: { value: "", enabled: false },
        indicator: { value: 43 },
        isEnabled: true
      }
    });
  });

  it("marks second-layer dial titles", async () => {
    const adapter = new FakeFeedbackAdapter();
    const state = toggleDialBank(
      applyBridgeMessage(createDisconnectedState(), {
        type: "device.changed",
        device: {
          id: 12345,
          name: "Performance Rack",
          className: "AudioEffectGroupDevice",
          isRack: true
        },
        bankCount: 2,
        activeBank: 0,
        params: [
          param(0, { name: "Level" }),
          param(4, { name: "Output" })
        ]
      }),
      0
    );

    await renderFeedback(adapter, state, ["dial-0"]);

    expect(adapter.payloads[0]?.payload.title).toBe("[2] Output");
    expect(adapter.payloads[0]?.payload.layer).toEqual({ value: "↕", enabled: true });
  });

  it("marks only dials with an active second-layer assignment", async () => {
    const adapter = new FakeFeedbackAdapter();
    const state = applyBridgeMessage(createDisconnectedState(), {
      type: "device.changed",
      device: {
        id: 12345,
        name: "Performance Rack",
        className: "AudioEffectGroupDevice",
        isRack: true
      },
      bankCount: 2,
      activeBank: 0,
      params: [
        param(0, { name: "Level" }),
        param(3, { name: "Output" }),
        param(4, { name: "Compression" }),
        param(7, { name: "Macro 8" })
      ]
    });

    await renderFeedback(adapter, state, ["dial-0", "dial-1", "dial-2", "dial-3"]);

    expect(adapter.payloads.map(({ payload }) => payload.title)).toEqual(["Level", "", "", "Output"]);
    expect(adapter.payloads.map(({ payload }) => payload.layer)).toEqual([
      { value: "↕", enabled: true },
      { value: "", enabled: false },
      { value: "", enabled: false },
      { value: "", enabled: false }
    ]);
  });

  it("shows an offline status while the Max bridge is disconnected", async () => {
    const adapter = new FakeFeedbackAdapter();

    await renderFeedback(adapter, createDisconnectedState(), ["dial-0", "dial-1", "dial-2", "dial-3"]);

    expect(adapter.payloads).toEqual([
      { context: "dial-0", payload: { title: "Offline", value: "Max", layer: { value: "", enabled: false }, indicator: { value: 0 }, isEnabled: false } },
      { context: "dial-1", payload: { title: "", value: "", layer: { value: "", enabled: false }, indicator: { value: 0 }, isEnabled: false } },
      { context: "dial-2", payload: { title: "", value: "", layer: { value: "", enabled: false }, indicator: { value: 0 }, isEnabled: false } },
      { context: "dial-3", payload: { title: "", value: "", layer: { value: "", enabled: false }, indicator: { value: 0 }, isEnabled: false } }
    ]);
  });

  it("shows when the bridge is connected but no Rack is selected", async () => {
    const adapter = new FakeFeedbackAdapter();
    const state = applyBridgeMessage(createDisconnectedState(), {
      type: "bridge.hello",
      protocolVersion: 1,
      bridgeName: "Ableton Rack Bridge"
    });

    await renderFeedback(adapter, state, ["dial-0", "dial-1"]);

    expect(adapter.payloads).toEqual([
      { context: "dial-0", payload: { title: "No Rack", value: "", layer: { value: "", enabled: false }, indicator: { value: 0 }, isEnabled: false } },
      { context: "dial-1", payload: { title: "", value: "", layer: { value: "", enabled: false }, indicator: { value: 0 }, isEnabled: false } }
    ]);
  });

  it("sends disabled blank payloads for empty slots when a Rack is selected", async () => {
    const adapter = new FakeFeedbackAdapter();
    const state = applyBridgeMessage(createDisconnectedState(), {
      type: "device.changed",
      device: {
        id: 12345,
        name: "Performance Rack",
        className: "AudioEffectGroupDevice",
        isRack: true
      },
      bankCount: 2,
      activeBank: 0,
      params: []
    });

    await renderFeedback(adapter, state, ["dial-0", "dial-1"]);

    expect(adapter.payloads).toEqual([
      { context: "dial-0", payload: { title: "", value: "", layer: { value: "", enabled: false }, indicator: { value: 0 }, isEnabled: false } },
      { context: "dial-1", payload: { title: "", value: "", layer: { value: "", enabled: false }, indicator: { value: 0 }, isEnabled: false } }
    ]);
  });
});
