import { describe, expect, it } from "vitest";
import { buildBankView, getParamForDial } from "../../src/protocol/banks.js";
import type { RackParam } from "../../src/protocol/messages.js";

function param(slot: number, name = `Param ${slot}`): RackParam {
  return {
    slot,
    id: 9000 + slot,
    name,
    value: slot / 10,
    displayValue: `${slot / 10}`,
    min: 0,
    max: 1,
    normalized: slot / 10,
    isQuantized: false,
    isEnabled: true,
    valueItems: []
  };
}

describe("buildBankView", () => {
  it("maps one parameter and disables the remaining slots", () => {
    const view = buildBankView([param(0, "Cutoff")], 0);

    expect(view).toHaveLength(4);
    expect(view[0]).toMatchObject({
      dialIndex: 0,
      slot: 0,
      isEnabled: true,
      param: expect.objectContaining({ name: "Cutoff" })
    });
    expect(view.slice(1)).toEqual([
      { dialIndex: 1, slot: 1, isEnabled: false, param: null },
      { dialIndex: 2, slot: 2, isEnabled: false, param: null },
      { dialIndex: 3, slot: 3, isEnabled: false, param: null }
    ]);
  });

  it("maps four parameters into bank 0", () => {
    const view = buildBankView([param(0), param(1), param(2), param(3)], 0);

    expect(view.map((slot) => slot.param?.id)).toEqual([9000, 9001, 9002, 9003]);
    expect(view.every((slot) => slot.isEnabled)).toBe(true);
  });

  it("maps eight parameters across two banks", () => {
    const params = Array.from({ length: 8 }, (_, index) => param(index));

    expect(buildBankView(params, 0).map((slot) => slot.param?.slot)).toEqual([0, 1, 2, 3]);
    expect(buildBankView(params, 1).map((slot) => slot.param?.slot)).toEqual([4, 5, 6, 7]);
  });

  it("truncates the control surface to the first eight parameters", () => {
    const params = Array.from({ length: 10 }, (_, index) => param(index));

    expect(buildBankView(params, 1).map((slot) => slot.param?.slot)).toEqual([4, 5, 6, 7]);
    expect(getParamForDial(params, 1, 3)?.slot).toBe(7);
  });

  it("leaves missing slots disabled instead of duplicating parameters", () => {
    const duplicateSlotParams = [param(0, "Cutoff"), param(0, "Resonance"), param(5, "Drive")];

    expect(buildBankView(duplicateSlotParams, 0)).toEqual([
      expect.objectContaining({ dialIndex: 0, slot: 0, isEnabled: true }),
      { dialIndex: 1, slot: 1, isEnabled: false, param: null },
      { dialIndex: 2, slot: 2, isEnabled: false, param: null },
      { dialIndex: 3, slot: 3, isEnabled: false, param: null }
    ]);
    expect(buildBankView(duplicateSlotParams, 1)).toEqual([
      { dialIndex: 0, slot: 4, isEnabled: false, param: null },
      expect.objectContaining({ dialIndex: 1, slot: 5, isEnabled: true }),
      { dialIndex: 2, slot: 6, isEnabled: false, param: null },
      { dialIndex: 3, slot: 7, isEnabled: false, param: null }
    ]);
  });
});

describe("getParamForDial", () => {
  it("returns the mapped parameter for a bank and dial", () => {
    const params = Array.from({ length: 8 }, (_, index) => param(index));

    expect(getParamForDial(params, 1, 2)).toMatchObject({ slot: 6, id: 9006 });
  });

  it("returns null for disabled slots and invalid banks or dials", () => {
    expect(getParamForDial([param(0)], 0, 3)).toBeNull();
    expect(getParamForDial([param(0)], 2, 0)).toBeNull();
    expect(getParamForDial([param(0)], 0, -1)).toBeNull();
    expect(getParamForDial([param(0)], 0, 4)).toBeNull();
  });
});
