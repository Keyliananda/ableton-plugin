import { describe, expect, it } from "vitest";
import { buildBankView } from "../../src/protocol/banks.js";
import type { BridgeToPluginMessage, ParamDeltaMessage } from "../../src/protocol/messages.js";
import { LiveBridgeController } from "../../src/maxforlive/controller.js";
import type { LiveAdapter, LiveDeviceSnapshot, LiveParameterSnapshot } from "../../src/maxforlive/live-adapter.js";

class FakeLiveAdapter implements LiveAdapter {
  readonly writes: Array<{ deviceId: number; paramId: number; value: number }> = [];

  constructor(public selectedDevice: LiveDeviceSnapshot | null) {}

  getSelectedDevice(): LiveDeviceSnapshot | null {
    return this.selectedDevice;
  }

  setParameterValue(deviceId: number, paramId: number, value: number): void {
    this.writes.push({ deviceId, paramId, value });
  }
}

function parameter(index: number, overrides: Partial<LiveParameterSnapshot> = {}): LiveParameterSnapshot {
  return {
    id: 9000 + index,
    name: `Param ${index}`,
    value: index / 10,
    displayValue: `${index / 10}`,
    min: 0,
    max: 1,
    isQuantized: false,
    isEnabled: true,
    valueItems: [],
    ...overrides
  };
}

function device(params: LiveParameterSnapshot[]): LiveDeviceSnapshot {
  return {
    id: 123,
    name: "Performance Rack",
    className: "AudioEffectGroupDevice",
    isRack: true,
    params
  };
}

function delta(overrides: Partial<ParamDeltaMessage> = {}): ParamDeltaMessage {
  return {
    type: "param.delta",
    deviceId: 123,
    paramId: 9000,
    slot: 0,
    ticks: 1,
    fine: false,
    ...overrides
  };
}

describe("LiveBridgeController", () => {
  it("emits the selected rack snapshot with normalized params and disabled empty slots", async () => {
    const messages: BridgeToPluginMessage[] = [];
    const adapter = new FakeLiveAdapter(
      device([parameter(0, { name: "Cutoff", value: 50, displayValue: undefined, min: 0, max: 100 })])
    );
    const controller = new LiveBridgeController(adapter, (message) => messages.push(message));

    await controller.refreshSelectedDevice();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      type: "device.changed",
      device: {
        id: 123,
        name: "Performance Rack",
        className: "AudioEffectGroupDevice",
        isRack: true
      },
      bankCount: 2,
      activeBank: 0,
      params: [
        {
          slot: 0,
          id: 9000,
          name: "Cutoff",
          value: 50,
          displayValue: "50",
          min: 0,
          max: 100,
          normalized: 0.5,
          isQuantized: false,
          isEnabled: true,
          valueItems: []
        }
      ]
    });
    expect(buildBankView(messages[0].type === "device.changed" ? messages[0].params : [], 0)).toEqual([
      expect.objectContaining({ dialIndex: 0, slot: 0, isEnabled: true }),
      { dialIndex: 1, slot: 1, isEnabled: false, param: null },
      { dialIndex: 2, slot: 2, isEnabled: false, param: null },
      { dialIndex: 3, slot: 3, isEnabled: false, param: null }
    ]);
  });

  it("emits at most eight selected rack parameters", async () => {
    const messages: BridgeToPluginMessage[] = [];
    const adapter = new FakeLiveAdapter(device(Array.from({ length: 10 }, (_, index) => parameter(index))));
    const controller = new LiveBridgeController(adapter, (message) => messages.push(message));

    await controller.refreshSelectedDevice();

    expect(messages[0]).toMatchObject({ type: "device.changed" });
    expect(messages[0].type === "device.changed" ? messages[0].params.map((param) => param.slot) : []).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7
    ]);
  });

  it("applies continuous param.delta with min/max clamping", async () => {
    const adapter = new FakeLiveAdapter(device([parameter(0, { value: 0.99, min: 0, max: 1 })]));
    const controller = new LiveBridgeController(adapter, () => undefined);
    await controller.refreshSelectedDevice();

    await controller.handleMessage(delta({ ticks: 5 }));
    await controller.handleMessage(delta({ ticks: -500 }));

    expect(adapter.writes).toEqual([
      { deviceId: 123, paramId: 9000, value: 1 },
      { deviceId: 123, paramId: 9000, value: 0 }
    ]);
  });

  it("uses a responsive continuous step size for coarse dial rotation", async () => {
    const adapter = new FakeLiveAdapter(device([parameter(0, { value: 64, min: 0, max: 128 })]));
    const controller = new LiveBridgeController(adapter, () => undefined);
    await controller.refreshSelectedDevice();

    await controller.handleMessage(delta({ ticks: 1 }));

    expect(adapter.writes).toEqual([{ deviceId: 123, paramId: 9000, value: 65 }]);
  });

  it("applies quantized param.delta by valueItems index", async () => {
    const adapter = new FakeLiveAdapter(
      device([
        parameter(0, {
          value: 1,
          min: 0,
          max: 2,
          isQuantized: true,
          valueItems: ["Low", "Mid", "High"]
        })
      ])
    );
    const controller = new LiveBridgeController(adapter, () => undefined);
    await controller.refreshSelectedDevice();

    await controller.handleMessage(delta({ ticks: 1 }));
    await controller.handleMessage(delta({ ticks: 4 }));
    await controller.handleMessage(delta({ ticks: -10 }));

    expect(adapter.writes).toEqual([
      { deviceId: 123, paramId: 9000, value: 2 },
      { deviceId: 123, paramId: 9000, value: 2 },
      { deviceId: 123, paramId: 9000, value: 0 }
    ]);
  });

  it("ignores stale ids and disabled or missing parameters", async () => {
    const adapter = new FakeLiveAdapter(
      device([parameter(0), parameter(1, { id: 9001, isEnabled: false })])
    );
    const controller = new LiveBridgeController(adapter, () => undefined);
    await controller.refreshSelectedDevice();

    await controller.handleMessage(delta({ deviceId: 999 }));
    await controller.handleMessage(delta({ paramId: 9999 }));
    await controller.handleMessage(delta({ slot: 1, paramId: 9001 }));
    await controller.handleMessage(delta({ slot: 3, paramId: 9003 }));

    expect(adapter.writes).toEqual([]);
  });

  it("refreshes the selected device when receiving device.refresh", async () => {
    const messages: BridgeToPluginMessage[] = [];
    const adapter = new FakeLiveAdapter(device([parameter(0)]));
    const controller = new LiveBridgeController(adapter, (message) => messages.push(message));

    await controller.handleMessage({ type: "device.refresh" });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: "device.changed", device: { id: 123 } });
  });
});
