import { describe, expect, it } from "vitest";
import type { DeviceChangedMessage, RackParam } from "../../src/protocol/messages.js";
import {
  applyBridgeMessage,
  createDisconnectedState,
  getVisibleSlots,
  rotateDial,
  setActiveBank,
  toggleDialBank
} from "../../src/streamdeck/state.js";

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

function deviceChanged(params: RackParam[], activeBank = 0, deviceId = 12345): DeviceChangedMessage {
  return {
    type: "device.changed",
    device: {
      id: deviceId,
      name: "Performance Rack",
      className: "AudioEffectGroupDevice",
      isRack: true
    },
    bankCount: 2,
    activeBank,
    params
  };
}

describe("stream deck state", () => {
  it("renders four disabled slots while disconnected", () => {
    const state = createDisconnectedState();

    expect(state.connected).toBe(false);
    expect(getVisibleSlots(state)).toEqual([
      { dialIndex: 0, slot: 0, isEnabled: false, param: null },
      { dialIndex: 1, slot: 1, isEnabled: false, param: null },
      { dialIndex: 2, slot: 2, isEnabled: false, param: null },
      { dialIndex: 3, slot: 3, isEnabled: false, param: null }
    ]);
  });

  it("stores device changes and maps the default dial banks to four visible dials", () => {
    const state = applyBridgeMessage(
      createDisconnectedState(),
      deviceChanged(Array.from({ length: 8 }, (_, index) => param(index)), 1)
    );

    expect(state.connected).toBe(true);
    expect(state.device).toMatchObject({ id: 12345, name: "Performance Rack" });
    expect(state.activeBank).toBe(1);
    expect(getVisibleSlots(state).map((slot) => slot.param?.id)).toEqual([9000, 9001, 9002, 9003]);
  });

  it("updates exactly one cached parameter from param.changed", () => {
    const previous = applyBridgeMessage(
      createDisconnectedState(),
      deviceChanged([param(0), param(1), param(2)])
    );

    const next = applyBridgeMessage(previous, {
      type: "param.changed",
      deviceId: 12345,
      paramId: 9001,
      slot: 1,
      value: 0.75,
      displayValue: "75%",
      normalized: 0.75
    });

    expect(next.params[0]).toBe(previous.params[0]);
    expect(next.params[2]).toBe(previous.params[2]);
    expect(next.params[1]).toEqual({
      ...previous.params[1],
      value: 0.75,
      displayValue: "75%",
      normalized: 0.75
    });
  });

  it("switches banks between slots 0-3 and 4-7", () => {
    const state = applyBridgeMessage(
      createDisconnectedState(),
      deviceChanged(Array.from({ length: 8 }, (_, index) => param(index)))
    );

    expect(getVisibleSlots(state).map((slot) => slot.slot)).toEqual([0, 1, 2, 3]);
    expect(getVisibleSlots(setActiveBank(state, 1)).map((slot) => slot.slot)).toEqual([4, 5, 6, 7]);
  });

  it("switches only the pressed dial between its two slots", () => {
    const state = applyBridgeMessage(
      createDisconnectedState(),
      deviceChanged(Array.from({ length: 8 }, (_, index) => param(index)))
    );

    const next = toggleDialBank(state, 1);

    expect(getVisibleSlots(next).map((slot) => slot.slot)).toEqual([0, 5, 2, 3]);
    expect(rotateDial(next, 1, 2, false)).toMatchObject({
      paramId: 9005,
      slot: 5
    });
    expect(rotateDial(next, 0, 2, false)).toMatchObject({
      paramId: 9000,
      slot: 0
    });
  });

  it("keeps dial banks when the same device refreshes", () => {
    const state = toggleDialBank(
      applyBridgeMessage(createDisconnectedState(), deviceChanged(Array.from({ length: 8 }, (_, index) => param(index)))),
      1
    );

    const next = applyBridgeMessage(state, deviceChanged(Array.from({ length: 8 }, (_, index) => param(index))));

    expect(getVisibleSlots(next).map((slot) => slot.slot)).toEqual([0, 5, 2, 3]);
  });

  it("resets dial banks when a different device is selected", () => {
    const state = toggleDialBank(
      applyBridgeMessage(createDisconnectedState(), deviceChanged(Array.from({ length: 8 }, (_, index) => param(index)))),
      1
    );

    const next = applyBridgeMessage(state, deviceChanged(Array.from({ length: 8 }, (_, index) => param(index)), 0, 67890));

    expect(getVisibleSlots(next).map((slot) => slot.slot)).toEqual([0, 1, 2, 3]);
  });

  it("does not emit a command when rotating an empty slot", () => {
    const state = applyBridgeMessage(createDisconnectedState(), deviceChanged([param(0)]));

    expect(rotateDial(state, 3, 2, false)).toBeNull();
  });

  it("emits param.delta for a mapped default dial slot with the absolute parameter slot", () => {
    const state = applyBridgeMessage(
      createDisconnectedState(),
      deviceChanged(Array.from({ length: 8 }, (_, index) => param(index)))
    );

    expect(rotateDial(state, 1, -3, true)).toEqual({
      type: "param.delta",
      deviceId: 12345,
      paramId: 9001,
      slot: 1,
      ticks: -3,
      fine: true
    });
  });
});
