import { getVisibleSlots, hasActiveAlternateSlot, type StreamDeckState } from "./state.js";

export interface FeedbackPayload {
  title: string;
  value: string;
  layer: {
    value: string;
    enabled: boolean;
  };
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
  contexts: readonly (string | null)[]
): Promise<void> {
  if (!state.connected) {
    await renderStatusFeedback(adapter, contexts, statusPayload("Offline", "Max"));
    return;
  }

  if (state.device === null) {
    await renderStatusFeedback(adapter, contexts, statusPayload("No Rack", ""));
    return;
  }

  const slots = getVisibleSlots(state);

  await Promise.all(
    contexts.slice(0, 4).map((context, dialIndex) => {
      if (context === null) {
        return undefined;
      }

      const slot = slots[dialIndex];
      return adapter.setFeedback(
        context,
        slot?.isEnabled && slot.param ? mappedPayload(slot.param, hasActiveAlternateSlot(state, dialIndex)) : blankPayload()
      );
    })
  );
}

export function mappedPayload(param: {
  slot: number;
  name: string;
  displayValue: string;
  normalized: number;
}, hasAlternateAssignment = false): FeedbackPayload {
  const layerPrefix = param.slot >= 4 ? "[2] " : "";

  return {
    title: `${layerPrefix}${param.name}`,
    value: param.displayValue,
    layer: layerPayload(hasAlternateAssignment),
    indicator: { value: Math.round(clamp01(param.normalized) * 100) },
    isEnabled: true
  };
}

export function blankPayload(): FeedbackPayload {
  return {
    title: "",
    value: "",
    layer: layerPayload(false),
    indicator: { value: 0 },
    isEnabled: false
  };
}

function statusPayload(title: string, value: string): FeedbackPayload {
  return {
    title,
    value,
    layer: layerPayload(false),
    indicator: { value: 0 },
    isEnabled: false
  };
}

function layerPayload(enabled: boolean): FeedbackPayload["layer"] {
  return {
    value: enabled ? "↕" : "",
    enabled
  };
}

async function renderStatusFeedback(
  adapter: StreamDeckFeedbackAdapter,
  contexts: readonly (string | null)[],
  firstPayload: FeedbackPayload
): Promise<void> {
  await Promise.all(
    contexts.slice(0, 4).map((context, dialIndex) => {
      if (context === null) {
        return undefined;
      }

      return adapter.setFeedback(context, dialIndex === 0 ? firstPayload : blankPayload());
    })
  );
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
