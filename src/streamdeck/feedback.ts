import { getVisibleSlots, type StreamDeckState } from "./state.js";

export interface FeedbackPayload {
  title: string;
  value: string;
  indicator: {
    value: number;
  };
  isEnabled: boolean;
}

export interface StreamDeckFeedbackAdapter {
  setFeedback(context: string, payload: FeedbackPayload): void | Promise<void>;
}

export async function renderFeedback(
  adapter: StreamDeckFeedbackAdapter,
  state: StreamDeckState,
  contexts: readonly string[]
): Promise<void> {
  const slots = getVisibleSlots(state);

  await Promise.all(
    contexts.slice(0, 4).map((context, dialIndex) => {
      const slot = slots[dialIndex];
      return adapter.setFeedback(context, slot?.isEnabled && slot.param ? mappedPayload(slot.param) : blankPayload());
    })
  );
}

export function mappedPayload(param: {
  slot: number;
  name: string;
  displayValue: string;
  normalized: number;
}): FeedbackPayload {
  return {
    title: param.slot >= 4 ? `[2] ${param.name}` : param.name,
    value: param.displayValue,
    indicator: { value: Math.round(clamp01(param.normalized) * 100) },
    isEnabled: true
  };
}

export function blankPayload(): FeedbackPayload {
  return {
    title: "",
    value: "",
    indicator: { value: 0 },
    isEnabled: false
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
