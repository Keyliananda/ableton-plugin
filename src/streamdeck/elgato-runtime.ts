import {
  SingletonAction,
  type DialDownEvent,
  type DialRotateEvent,
  type FeedbackPayload as ElgatoFeedbackPayload,
  type TouchTapEvent,
  type WillAppearEvent,
  type WillDisappearEvent
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { StreamDeckPluginController } from "./plugin.js";
import type { FeedbackPayload, StreamDeckFeedbackAdapter } from "./feedback.js";
import { StreamDeckSdkEventAdapter, type StreamDeckSdkController } from "./sdk-adapter.js";

export const PLUGIN_UUID = "de.daniel.ableton-rack-control";
export const ACTION_UUID = `${PLUGIN_UUID}.dial`;

export interface RuntimeStreamDeck {
  actions: {
    registerAction(action: unknown): void;
  };
  connect(): Promise<void>;
}

interface RuntimeOptions {
  controller?: RuntimeController;
  streamDeck: RuntimeStreamDeck;
}

type RuntimeController = StreamDeckSdkController & {
  start(): Promise<void>;
  sendHello(): void;
  requestDeviceRefresh(): void;
  toggleSelectedDevice(): boolean;
};

export interface FeedbackTarget {
  setFeedback(payload: ElgatoFeedbackPayload): void | Promise<void>;
}

export class StreamDeckActionFeedbackAdapter implements StreamDeckFeedbackAdapter {
  private readonly actionsByContext = new Map<string, FeedbackTarget>();

  setAction(context: string, action: FeedbackTarget): void {
    this.actionsByContext.set(context, action);
  }

  removeAction(context: string): void {
    this.actionsByContext.delete(context);
  }

  async setFeedback(context: string, payload: FeedbackPayload): Promise<void> {
    await this.actionsByContext.get(context)?.setFeedback(toElgatoFeedback(payload));
  }
}

export class RackDialAction extends SingletonAction {
  readonly manifestId = ACTION_UUID;
  private readonly sdkEvents: StreamDeckSdkEventAdapter;

  constructor(
    controller: StreamDeckSdkController,
    private readonly feedback: StreamDeckActionFeedbackAdapter
  ) {
    super();
    this.sdkEvents = new StreamDeckSdkEventAdapter(controller);
  }

  override onWillAppear(ev: WillAppearEvent<JsonObject>): void {
    if (ev.action.isDial()) {
      this.feedback.setAction(ev.action.id, ev.action);
    }

    this.sdkEvents.handleEvent({
      event: "willAppear",
      context: ev.action.id,
      payload: {
        controller: ev.payload.controller,
        coordinates: "coordinates" in ev.payload ? ev.payload.coordinates : { column: -1, row: -1 }
      }
    });
  }

  override onWillDisappear(ev: WillDisappearEvent<JsonObject>): void {
    this.feedback.removeAction(ev.action.id);
    this.sdkEvents.handleEvent({
      event: "willDisappear",
      context: ev.action.id
    });
  }

  override onDialRotate(ev: DialRotateEvent<JsonObject>): void {
    this.sdkEvents.handleEvent({
      event: "dialRotate",
      context: ev.action.id,
      payload: {
        controller: ev.payload.controller,
        coordinates: ev.payload.coordinates,
        ticks: ev.payload.ticks,
        pressed: ev.payload.pressed
      }
    });
  }

  override onDialDown(ev: DialDownEvent<JsonObject>): void {
    this.sdkEvents.handleEvent({
      event: "dialDown",
      context: ev.action.id,
      payload: {
        controller: ev.payload.controller,
        coordinates: ev.payload.coordinates
      }
    });
  }

  override onTouchTap(ev: TouchTapEvent<JsonObject>): void {
    this.sdkEvents.handleEvent({
      event: "touchTap",
      context: ev.action.id,
      payload: {
        controller: ev.payload.controller,
        coordinates: ev.payload.coordinates,
        hold: ev.payload.hold,
        tapPos: ev.payload.tapPos
      }
    });
  }
}

export async function startAbletonRackStreamDeckPlugin(options: RuntimeOptions): Promise<void> {
  const feedback = new StreamDeckActionFeedbackAdapter();
  const controller =
    options.controller ??
    new StreamDeckPluginController({
      server: { port: 17375 },
      feedback
    });

  options.streamDeck.actions.registerAction(new RackDialAction(controller, feedback));
  await controller.start();
  controller.sendHello();
  controller.requestDeviceRefresh();
  await options.streamDeck.connect();
}

function toElgatoFeedback(payload: FeedbackPayload): ElgatoFeedbackPayload {
  return {
    title: payload.title,
    value: payload.value,
    layer: payload.layer,
    indicator: payload.indicator.value
  };
}
