import { normalizeParam, type RackParam, type RawRackParam } from "./messages.js";

export interface BankSlot {
  dialIndex: number;
  slot: number;
  isEnabled: boolean;
  param: RackParam | null;
}

export function buildBankView(params: RawRackParam[], bank: number): BankSlot[] {
  const baseSlot = bank === 0 || bank === 1 ? bank * 4 : 0;
  const paramsBySlot = buildEffectiveParamMap(params);

  return Array.from({ length: 4 }, (_, dialIndex) => {
    const slot = baseSlot + dialIndex;
    const param = bank === 0 || bank === 1 ? paramsBySlot.get(slot) ?? null : null;

    return {
      dialIndex,
      slot,
      isEnabled: param?.isEnabled ?? false,
      param
    };
  });
}

export function getParamForDial(
  params: RawRackParam[],
  bank: number,
  dialIndex: number
): RackParam | null {
  if ((bank !== 0 && bank !== 1) || !Number.isInteger(dialIndex) || dialIndex < 0 || dialIndex > 3) {
    return null;
  }

  const slot = buildBankView(params, bank)[dialIndex];
  return slot?.isEnabled ? slot.param : null;
}

function buildEffectiveParamMap(params: RawRackParam[]): Map<number, RackParam> {
  const paramsBySlot = new Map<number, RackParam>();

  for (const rawParam of params.slice(0, 8)) {
    const param = normalizeParam(rawParam);

    if (Number.isInteger(param.slot) && param.slot >= 0 && param.slot <= 7 && !paramsBySlot.has(param.slot)) {
      paramsBySlot.set(param.slot, param);
    }
  }

  return paramsBySlot;
}
