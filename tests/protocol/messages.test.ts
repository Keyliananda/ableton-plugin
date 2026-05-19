import { describe, expect, it } from "vitest";
import {
  isBridgeToPluginMessage,
  isPluginToBridgeMessage,
  normalizeParam
} from "../../src/protocol/messages.js";

describe("protocol message guards", () => {
  it("accepts valid bridge-to-plugin messages", () => {
    expect(
      isBridgeToPluginMessage({
        type: "bridge.hello",
        protocolVersion: 1,
        bridgeName: "Ableton Rack Bridge"
      })
    ).toBe(true);

    expect(
      isBridgeToPluginMessage({
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
          {
            slot: 0,
            id: 9001,
            name: "Cutoff",
            value: 0.43,
            displayValue: "1.24 kHz",
            min: 0,
            max: 1,
            normalized: 0.43,
            isQuantized: false,
            isEnabled: true,
            valueItems: []
          }
        ]
      })
    ).toBe(true);

    expect(
      isBridgeToPluginMessage({
        type: "param.changed",
        deviceId: 12345,
        paramId: 9001,
        slot: 0,
        value: 0.45,
        displayValue: "1.38 kHz",
        normalized: 0.45
      })
    ).toBe(true);

    expect(
      isBridgeToPluginMessage({
        type: "device.cleared",
        reason: "no-selected-device"
      })
    ).toBe(true);
  });

  it("rejects malformed bridge-to-plugin messages", () => {
    expect(isBridgeToPluginMessage(null)).toBe(false);
    expect(isBridgeToPluginMessage({ type: "unknown" })).toBe(false);
    expect(
      isBridgeToPluginMessage({
        type: "bridge.hello",
        protocolVersion: "1",
        bridgeName: "Ableton Rack Bridge"
      })
    ).toBe(false);
    expect(
      isBridgeToPluginMessage({
        type: "device.changed",
        device: { id: 12345, name: "Rack" },
        bankCount: 2,
        activeBank: 0,
        params: []
      })
    ).toBe(false);
    expect(
      isBridgeToPluginMessage({
        type: "param.changed",
        deviceId: 12345,
        paramId: 9001,
        slot: 0,
        value: 0.45,
        normalized: 2
      })
    ).toBe(false);
  });

  it("accepts valid plugin-to-bridge messages", () => {
    expect(
      isPluginToBridgeMessage({
        type: "plugin.hello",
        protocolVersion: 1,
        pluginName: "Ableton Rack Dials"
      })
    ).toBe(true);

    expect(isPluginToBridgeMessage({ type: "bank.set", bank: 1 })).toBe(true);

    expect(
      isPluginToBridgeMessage({
        type: "param.delta",
        deviceId: 12345,
        paramId: 9001,
        slot: 0,
        ticks: 2,
        fine: false
      })
    ).toBe(true);
  });

  it("rejects malformed plugin-to-bridge messages", () => {
    expect(isPluginToBridgeMessage(undefined)).toBe(false);
    expect(isPluginToBridgeMessage({ type: "bank.set", bank: 2 })).toBe(false);
    expect(
      isPluginToBridgeMessage({
        type: "plugin.hello",
        protocolVersion: 1,
        pluginName: 7
      })
    ).toBe(false);
    expect(
      isPluginToBridgeMessage({
        type: "param.delta",
        deviceId: 12345,
        paramId: 9001,
        slot: 4,
        ticks: 2,
        fine: false
      })
    ).toBe(false);
  });
});

describe("normalizeParam", () => {
  it("clamps normalized values and preserves display metadata", () => {
    expect(
      normalizeParam({
        slot: 0,
        id: 9001,
        name: "Cutoff",
        value: 127,
        displayValue: "20 kHz",
        min: 0,
        max: 127,
        normalized: 2,
        isQuantized: false,
        isEnabled: true,
        valueItems: ["low", "high"]
      })
    ).toEqual({
      slot: 0,
      id: 9001,
      name: "Cutoff",
      value: 127,
      displayValue: "20 kHz",
      min: 0,
      max: 127,
      normalized: 1,
      isQuantized: false,
      isEnabled: true,
      valueItems: ["low", "high"]
    });
  });

  it("derives normalized values and fills defaults", () => {
    expect(
      normalizeParam({
        slot: 1,
        id: 9002,
        name: "Resonance",
        value: 25,
        min: 0,
        max: 100
      })
    ).toEqual({
      slot: 1,
      id: 9002,
      name: "Resonance",
      value: 25,
      displayValue: "25",
      min: 0,
      max: 100,
      normalized: 0.25,
      isQuantized: false,
      isEnabled: true,
      valueItems: []
    });
  });

  it("defaults zero-width ranges to normalized zero", () => {
    expect(
      normalizeParam({
        slot: 2,
        id: 9003,
        name: "Mode",
        value: 4,
        min: 4,
        max: 4
      }).normalized
    ).toBe(0);
  });
});
