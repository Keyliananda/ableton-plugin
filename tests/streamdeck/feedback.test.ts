import { describe, expect, it } from "vitest";
import type { RackParam } from "../../src/protocol/messages.js";
import { applyBridgeMessage, createDisconnectedState } from "../../src/streamdeck/state.js";
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
        indicator: { value: 43 },
        isEnabled: true
      }
    });
  });

  it("sends disabled blank payloads for empty slots", async () => {
    const adapter = new FakeFeedbackAdapter();

    await renderFeedback(adapter, createDisconnectedState(), ["dial-0", "dial-1", "dial-2", "dial-3"]);

    expect(adapter.payloads).toEqual([
      { context: "dial-0", payload: { title: "", value: "", indicator: { value: 0 }, isEnabled: false } },
      { context: "dial-1", payload: { title: "", value: "", indicator: { value: 0 }, isEnabled: false } },
      { context: "dial-2", payload: { title: "", value: "", indicator: { value: 0 }, isEnabled: false } },
      { context: "dial-3", payload: { title: "", value: "", indicator: { value: 0 }, isEnabled: false } }
    ]);
  });
});
