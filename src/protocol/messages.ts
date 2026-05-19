export const PROTOCOL_VERSION = 1;

export interface DeviceInfo {
  id: number;
  name: string;
  className: string;
  isRack: boolean;
}

export interface RackParam {
  slot: number;
  id: number;
  name: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  normalized: number;
  isQuantized: boolean;
  isEnabled: boolean;
  valueItems: string[];
}

export type RawRackParam = {
  slot: number;
  id: number;
  name: string;
  value: number;
  displayValue?: string;
  min?: number;
  max?: number;
  normalized?: number;
  isQuantized?: boolean;
  isEnabled?: boolean;
  valueItems?: string[];
};

export type BridgeHelloMessage = {
  type: "bridge.hello";
  protocolVersion: number;
  bridgeName: string;
};

export type DeviceChangedMessage = {
  type: "device.changed";
  device: DeviceInfo;
  bankCount: number;
  activeBank: number;
  params: RackParam[];
};

export type ParamChangedMessage = {
  type: "param.changed";
  deviceId: number;
  paramId: number;
  slot: number;
  value: number;
  displayValue: string;
  normalized: number;
};

export type DeviceClearedMessage = {
  type: "device.cleared";
  reason: string;
};

export type BridgeToPluginMessage =
  | BridgeHelloMessage
  | DeviceChangedMessage
  | ParamChangedMessage
  | DeviceClearedMessage;

export type PluginHelloMessage = {
  type: "plugin.hello";
  protocolVersion: number;
  pluginName: string;
};

export type BankSetMessage = {
  type: "bank.set";
  bank: 0 | 1;
};

export type ParamDeltaMessage = {
  type: "param.delta";
  deviceId: number;
  paramId: number;
  slot: number;
  ticks: number;
  fine: boolean;
};

export type PluginToBridgeMessage = PluginHelloMessage | BankSetMessage | ParamDeltaMessage;

export function normalizeParam(rawParam: RawRackParam): RackParam {
  const min = rawParam.min ?? 0;
  const max = rawParam.max ?? 1;
  const normalized =
    rawParam.normalized ?? (max === min ? 0 : (rawParam.value - min) / (max - min));

  return {
    slot: rawParam.slot,
    id: rawParam.id,
    name: rawParam.name,
    value: rawParam.value,
    displayValue: rawParam.displayValue ?? String(rawParam.value),
    min,
    max,
    normalized: clamp01(normalized),
    isQuantized: rawParam.isQuantized ?? false,
    isEnabled: rawParam.isEnabled ?? true,
    valueItems: rawParam.valueItems ?? []
  };
}

export function isBridgeToPluginMessage(value: unknown): value is BridgeToPluginMessage {
  if (!isRecord(value) || !isString(value.type)) {
    return false;
  }

  switch (value.type) {
    case "bridge.hello":
      return isNumber(value.protocolVersion) && isString(value.bridgeName);
    case "device.changed":
      return (
        isDeviceInfo(value.device) &&
        isNumber(value.bankCount) &&
        isBank(value.activeBank) &&
        Array.isArray(value.params) &&
        value.params.every(isRackParam)
      );
    case "param.changed":
      return (
        isNumber(value.deviceId) &&
        isNumber(value.paramId) &&
        isSlot(value.slot, 0, 7) &&
        isNumber(value.value) &&
        isString(value.displayValue) &&
        isNormalized(value.normalized)
      );
    case "device.cleared":
      return isString(value.reason);
    default:
      return false;
  }
}

export function isPluginToBridgeMessage(value: unknown): value is PluginToBridgeMessage {
  if (!isRecord(value) || !isString(value.type)) {
    return false;
  }

  switch (value.type) {
    case "plugin.hello":
      return isNumber(value.protocolVersion) && isString(value.pluginName);
    case "bank.set":
      return isBank(value.bank);
    case "param.delta":
      return (
        isNumber(value.deviceId) &&
        isNumber(value.paramId) &&
        isSlot(value.slot, 0, 3) &&
        isNumber(value.ticks) &&
        isBoolean(value.fine)
      );
    default:
      return false;
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isBank(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

function isNormalized(value: unknown): value is number {
  return isNumber(value) && value >= 0 && value <= 1;
}

function isSlot(value: unknown, min: number, max: number): value is number {
  return isNumber(value) && Number.isInteger(value) && value >= min && value <= max;
}

function isDeviceInfo(value: unknown): value is DeviceInfo {
  return (
    isRecord(value) &&
    isNumber(value.id) &&
    isString(value.name) &&
    isString(value.className) &&
    isBoolean(value.isRack)
  );
}

function isRackParam(value: unknown): value is RackParam {
  return (
    isRecord(value) &&
    isSlot(value.slot, 0, 7) &&
    isNumber(value.id) &&
    isString(value.name) &&
    isNumber(value.value) &&
    isString(value.displayValue) &&
    isNumber(value.min) &&
    isNumber(value.max) &&
    isNormalized(value.normalized) &&
    isBoolean(value.isQuantized) &&
    isBoolean(value.isEnabled) &&
    Array.isArray(value.valueItems) &&
    value.valueItems.every(isString)
  );
}
