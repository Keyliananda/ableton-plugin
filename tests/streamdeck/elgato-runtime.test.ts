import { describe, expect, it } from "vitest";
import {
  ACTION_UUID,
  RackDialAction,
  REFRESH_ACTION_UUID,
  RefreshRackAction,
  StreamDeckActionFeedbackAdapter,
  startAbletonRackStreamDeckPlugin,
  type RuntimeStreamDeck
} from "../../src/streamdeck/elgato-runtime.js";

class FakeDialAction {
  readonly id: string;
  readonly feedback: unknown[] = [];

  constructor(id = "ctx-0") {
    this.id = id;
  }

  setFeedback(payload: unknown): void {
    this.feedback.push(payload);
  }

  isDial(): boolean {
    return true;
  }
}

class FakeController {
  started = false;
  helloSent = false;
  readonly registered: Array<{ dialIndex: number; context: string }> = [];
  readonly unregistered: string[] = [];
  readonly rotations: Array<{ dialIndex: number; ticks: number; fine: boolean }> = [];
  readonly toggled: number[] = [];
  refreshRequests = 0;

  async start(): Promise<void> {
    this.started = true;
  }

  sendHello(): void {
    this.helloSent = true;
  }

  registerDialContext(dialIndex: number, context: string): void {
    this.registered.push({ dialIndex, context });
  }

  unregisterDialContext(context: string): void {
    this.unregistered.push(context);
  }

  rotateDial(dialIndex: number, ticks: number, fine: boolean): boolean {
    this.rotations.push({ dialIndex, ticks, fine });
    return true;
  }

  toggleDialBank(dialIndex: number): 0 | 1 {
    this.toggled.push(dialIndex);
    return 1;
  }

  requestDeviceRefresh(): void {
    this.refreshRequests += 1;
  }
}

class FakeStreamDeck implements RuntimeStreamDeck {
  connected = false;
  readonly actionConstructors: Array<new (...args: never[]) => unknown> = [];
  readonly actions = {
    registerAction: (action: unknown): void => {
      this.actionConstructors.push(action?.constructor as new (...args: never[]) => unknown);
    }
  };

  async connect(): Promise<void> {
    this.connected = true;
  }
}

describe("Stream Deck Elgato runtime", () => {
  it("routes feedback payloads to visible dial actions by context", async () => {
    const adapter = new StreamDeckActionFeedbackAdapter();
    const action = new FakeDialAction();

    adapter.setAction("ctx-0", action);
    await adapter.setFeedback("ctx-0", {
      title: "Level",
      value: "65",
      indicator: { value: 51 },
      isEnabled: true
    });
    await adapter.setFeedback("missing", {
      title: "Ignored",
      value: "0",
      indicator: { value: 0 },
      isEnabled: false
    });

    expect(action.feedback).toEqual([
      {
        title: "Level",
        value: "65",
        indicator: 51
      }
    ]);
  });

  it("translates SDK action events into controller calls", async () => {
    const controller = new FakeController();
    const feedback = new StreamDeckActionFeedbackAdapter();
    const action = new RackDialAction(controller, feedback);
    const dialAction = new FakeDialAction("ctx-2");

    await action.onWillAppear?.({
      action: dialAction,
      payload: {
        controller: "Encoder",
        coordinates: { column: 2, row: 0 }
      }
    } as never);
    await action.onDialRotate?.({
      action: dialAction,
      payload: {
        controller: "Encoder",
        coordinates: { column: 2, row: 0 },
        ticks: 4,
        pressed: false
      }
    } as never);
    await action.onDialDown?.({
      action: dialAction,
      payload: {
        controller: "Encoder",
        coordinates: { column: 2, row: 0 }
      }
    } as never);
    await action.onWillDisappear?.({ action: dialAction } as never);

    expect(action.manifestId).toBe(ACTION_UUID);
    expect(controller.registered).toEqual([{ dialIndex: 2, context: "ctx-2" }]);
    expect(controller.rotations).toEqual([{ dialIndex: 2, ticks: 4, fine: false }]);
    expect(controller.toggled).toEqual([2]);
    expect(controller.unregistered).toEqual(["ctx-2"]);
  });

  it("requests a selected Rack refresh from the refresh key action", async () => {
    const controller = new FakeController();
    const action = new RefreshRackAction(controller);

    await action.onKeyDown?.({} as never);

    expect(action.manifestId).toBe(REFRESH_ACTION_UUID);
    expect(controller.refreshRequests).toBe(1);
  });

  it("starts the bridge controller before connecting to Stream Deck", async () => {
    const controller = new FakeController();
    const streamDeck = new FakeStreamDeck();

    await startAbletonRackStreamDeckPlugin({ controller, streamDeck });

    expect(controller.started).toBe(true);
    expect(controller.helloSent).toBe(true);
    expect(controller.refreshRequests).toBe(1);
    expect(streamDeck.actionConstructors).toEqual([RackDialAction, RefreshRackAction]);
    expect(streamDeck.connected).toBe(true);
  });
});
