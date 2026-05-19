import { buildBankView, type BankSlot } from "../protocol/banks.js";
import type {
  BridgeToPluginMessage,
  DeviceInfo,
  ParamDeltaMessage,
  RackParam
} from "../protocol/messages.js";

export interface StreamDeckState {
  connected: boolean;
  device: DeviceInfo | null;
  bankCount: number;
  activeBank: 0 | 1;
  params: RackParam[];
}

export function createDisconnectedState(): StreamDeckState {
  return {
    connected: false,
    device: null,
    bankCount: 2,
    activeBank: 0,
    params: []
  };
}

export function applyBridgeMessage(
  state: StreamDeckState,
  message: BridgeToPluginMessage
): StreamDeckState {
  switch (message.type) {
    case "bridge.hello":
      return { ...state, connected: true };
    case "device.changed":
      return {
        connected: true,
        device: message.device,
        bankCount: message.bankCount,
        activeBank: normalizeBank(message.activeBank),
        params: message.params
      };
    case "param.changed":
      if (state.device?.id !== message.deviceId) {
        return state;
      }

      return {
        ...state,
        params: state.params.map((param) =>
          param.id === message.paramId && param.slot === message.slot
            ? {
                ...param,
                value: message.value,
                displayValue: message.displayValue,
                normalized: message.normalized
              }
            : param
        )
      };
    case "device.cleared":
      return {
        ...state,
        device: null,
        activeBank: 0,
        params: []
      };
  }
}

export function getVisibleSlots(state: StreamDeckState): BankSlot[] {
  return buildBankView(state.params, state.activeBank);
}

export function setActiveBank(state: StreamDeckState, bank: number): StreamDeckState {
  return {
    ...state,
    activeBank: normalizeBank(bank)
  };
}

export function rotateDial(
  state: StreamDeckState,
  dialIndex: number,
  ticks: number,
  fine: boolean
): ParamDeltaMessage | null {
  const visibleSlot = getVisibleSlots(state)[dialIndex];

  if (!state.device || !visibleSlot?.isEnabled || !visibleSlot.param) {
    return null;
  }

  return {
    type: "param.delta",
    deviceId: state.device.id,
    paramId: visibleSlot.param.id,
    slot: visibleSlot.param.slot,
    ticks,
    fine
  };
}

function normalizeBank(bank: number): 0 | 1 {
  return bank === 1 ? 1 : 0;
}
