import { normalizeParam, type BridgeToPluginMessage, type ParamDeltaMessage, type PluginToBridgeMessage, type RackParam } from "../protocol/messages.js";
import type { LiveAdapter, LiveDeviceSnapshot } from "./live-adapter.js";

type SendBridgeMessage = (message: BridgeToPluginMessage) => void;

export class LiveBridgeController {
  private activeBank: 0 | 1 = 0;
  private selectedDevice: LiveDeviceSnapshot | null = null;
  private params: RackParam[] = [];

  constructor(
    private readonly adapter: LiveAdapter,
    private readonly send: SendBridgeMessage
  ) {}

  async refreshSelectedDevice(): Promise<void> {
    const device = await this.adapter.getSelectedDevice();
    this.selectedDevice = device;

    if (device === null) {
      this.params = [];
      this.send({ type: "device.cleared", reason: "no-selected-device" });
      return;
    }

    this.params = device.params.slice(0, 8).map((param, slot) =>
      normalizeParam({
        slot,
        id: param.id,
        name: param.name,
        value: param.value,
        displayValue: param.displayValue,
        min: param.min,
        max: param.max,
        isQuantized: param.isQuantized,
        isEnabled: param.isEnabled,
        valueItems: param.valueItems
      })
    );

    this.send({
      type: "device.changed",
      device: {
        id: device.id,
        name: device.name,
        className: device.className,
        isRack: device.isRack
      },
      bankCount: 2,
      activeBank: this.activeBank,
      params: this.params
    });
  }

  async handleMessage(message: PluginToBridgeMessage): Promise<void> {
    if (message.type === "bank.set") {
      this.activeBank = message.bank;
      return;
    }

    if (message.type === "param.delta") {
      await this.applyParamDelta(message);
    }
  }

  async applyParamDelta(message: ParamDeltaMessage): Promise<void> {
    if (this.selectedDevice === null || this.selectedDevice.id !== message.deviceId) {
      return;
    }

    const param = this.params[message.slot];
    if (param === undefined || !param.isEnabled || param.id !== message.paramId) {
      return;
    }

    const nextValue = param.isQuantized
      ? applyQuantizedDelta(param, message.ticks)
      : applyContinuousDelta(param, message.ticks, message.fine);

    await this.adapter.setParameterValue(this.selectedDevice.id, param.id, nextValue);
    param.value = nextValue;
    param.normalized = normalizeParam({ ...param, value: nextValue }).normalized;
  }
}

function applyContinuousDelta(param: RackParam, ticks: number, fine: boolean): number {
  const span = param.max - param.min;
  const divisor = fine ? 1024 : 256;
  return clamp(param.value + ticks * (span / divisor), param.min, param.max);
}

function applyQuantizedDelta(param: RackParam, ticks: number): number {
  if (param.valueItems.length === 0) {
    return clamp(Math.round(param.value + ticks), param.min, param.max);
  }

  const currentIndex = clamp(Math.round(param.value), 0, param.valueItems.length - 1);
  return clamp(currentIndex + ticks, 0, param.valueItems.length - 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
