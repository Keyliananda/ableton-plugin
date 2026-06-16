import { describe, expect, it } from "vitest";
import type { RackParam } from "../../src/protocol/messages.js";
import type { FeedbackPayload, StreamDeckFeedbackAdapter } from "../../src/streamdeck/feedback.js";
import { StreamDeckPluginController } from "../../src/streamdeck/plugin.js";
import { applyBridgeMessage, createDisconnectedState } from "../../src/streamdeck/state.js";

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

class RecordingFeedbackAdapter implements StreamDeckFeedbackAdapter {
  readonly payloads: Array<{ context: string; payload: FeedbackPayload }> = [];

  setFeedback(context: string, payload: FeedbackPayload): void {
    this.payloads.push({ context, payload });
  }
}

describe("StreamDeckPluginController", () => {
  it("coalesces rapid bridge updates into one feedback render with the latest state", async () => {
    const feedback = new RecordingFeedbackAdapter();
    const initialState = applyBridgeMessage(createDisconnectedState(), {
      type: "device.changed",
      device: {
        id: 12345,
        name: "Performance Rack",
        className: "AudioEffectGroupDevice",
        isRack: true
      },
      bankCount: 2,
      activeBank: 0,
      params: [param(0, { displayValue: "64", normalized: 0.5 })]
    });
    const controller = new StreamDeckPluginController({
      server: { port: 0 },
      feedback,
      initialState
    });

    controller.registerDialContext(0, "dial-0");
    await controller.whenIdle();
    feedback.payloads.length = 0;

    const firstUpdate = controller.handleBridgeMessage({
      type: "param.changed",
      deviceId: 12345,
      paramId: 9000,
      slot: 0,
      value: 65,
      displayValue: "65",
      normalized: 0.51
    });
    const secondUpdate = controller.handleBridgeMessage({
      type: "param.changed",
      deviceId: 12345,
      paramId: 9000,
      slot: 0,
      value: 66,
      displayValue: "66",
      normalized: 0.52
    });
    const thirdUpdate = controller.handleBridgeMessage({
      type: "param.changed",
      deviceId: 12345,
      paramId: 9000,
      slot: 0,
      value: 67,
      displayValue: "67",
      normalized: 0.53
    });

    await Promise.all([firstUpdate, secondUpdate, thirdUpdate]);

    expect(feedback.payloads.map(({ payload }) => payload.value)).toEqual(["67"]);
  });
});
