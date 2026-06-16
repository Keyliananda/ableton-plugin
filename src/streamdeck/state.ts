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
  dialBanks: DialBanks;
  params: RackParam[];
}

type DialBanks = [0 | 1, 0 | 1, 0 | 1, 0 | 1];

export function createDisconnectedState(): StreamDeckState {
  return {
    connected: false,
    device: null,
    bankCount: 2,
    activeBank: 0,
    dialBanks: [0, 0, 0, 0],
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
        dialBanks: state.dialBanks,
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
        dialBanks: [0, 0, 0, 0],
        params: []
      };
  }
}

export function getVisibleSlots(state: StreamDeckState): BankSlot[] {
  return state.dialBanks.map((bank, dialIndex) => buildBankView(state.params, bank)[dialIndex]);
}

export function setActiveBank(state: StreamDeckState, bank: number): StreamDeckState {
  const activeBank = normalizeBank(bank);

  return {
    ...state,
    activeBank,
    dialBanks: [activeBank, activeBank, activeBank, activeBank]
  };
}

export function toggleDialBank(state: StreamDeckState, dialIndex: number): StreamDeckState {
  if (!Number.isInteger(dialIndex) || dialIndex < 0 || dialIndex > 3) {
    return state;
  }

  const nextBanks: DialBanks = [...state.dialBanks] as DialBanks;
  nextBanks[dialIndex] = nextBanks[dialIndex] === 0 ? 1 : 0;

  return {
    ...state,
    dialBanks: nextBanks
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
