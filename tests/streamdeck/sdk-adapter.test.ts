import { describe, expect, it } from "vitest";
import { StreamDeckSdkEventAdapter, type StreamDeckSdkController } from "../../src/streamdeck/sdk-adapter.js";

class FakeController implements StreamDeckSdkController {
  readonly registered: Array<{ dialIndex: number; context: string }> = [];
  readonly unregistered: string[] = [];
  readonly rotations: Array<{ dialIndex: number; ticks: number; fine: boolean }> = [];
  readonly toggled: number[] = [];
  deviceToggleRequests = 0;

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

  toggleSelectedDevice(): boolean {
    this.deviceToggleRequests += 1;
    return true;
  }
}

describe("StreamDeckSdkEventAdapter", () => {
  it("registers and unregisters Stream Deck + encoder contexts by column", () => {
    const controller = new FakeController();
    const adapter = new StreamDeckSdkEventAdapter(controller);

    adapter.handleEvent({
      event: "willAppear",
      context: "ctx-1",
      payload: {
        controller: "Encoder",
        coordinates: { column: 1, row: 0 }
      }
    });
    adapter.handleEvent({ event: "willDisappear", context: "ctx-1" });

    expect(controller.registered).toEqual([{ dialIndex: 1, context: "ctx-1" }]);
    expect(controller.unregistered).toEqual(["ctx-1"]);
  });

  it("forwards encoder rotations with ticks and always uses coarse mode", () => {
    const controller = new FakeController();
    const adapter = new StreamDeckSdkEventAdapter(controller);

    const handled = adapter.handleEvent({
      event: "dialRotate",
      context: "ctx-2",
      payload: {
        controller: "Encoder",
        coordinates: { column: 2, row: 0 },
        ticks: -3,
        pressed: true
      }
    });

    expect(handled).toBe(true);
    expect(controller.rotations).toEqual([{ dialIndex: 2, ticks: -3, fine: false }]);
  });

  it("toggles only the pressed encoder bank when an encoder is pressed", () => {
    const controller = new FakeController();
    const adapter = new StreamDeckSdkEventAdapter(controller);

    const handled = adapter.handleEvent({
      event: "dialDown",
      context: "ctx-0",
      payload: {
        controller: "Encoder",
        coordinates: { column: 0, row: 0 }
      }
    });

    expect(handled).toBe(true);
    expect(controller.toggled).toEqual([0]);
  });

  it("toggles the selected device when the encoder touchscreen is tapped", () => {
    const controller = new FakeController();
    const adapter = new StreamDeckSdkEventAdapter(controller);

    const handled = adapter.handleEvent({
      event: "touchTap",
      context: "ctx-0",
      payload: {
        controller: "Encoder",
        coordinates: { column: 0, row: 0 },
        hold: false,
        tapPos: [42, 12]
      }
    });

    expect(handled).toBe(true);
    expect(controller.deviceToggleRequests).toBe(1);
    expect(controller.toggled).toEqual([]);
  });

  it("ignores non-encoder and out-of-range dial events", () => {
    const controller = new FakeController();
    const adapter = new StreamDeckSdkEventAdapter(controller);

    expect(
      adapter.handleEvent({
        event: "willAppear",
        context: "key-context",
        payload: {
          controller: "Keypad",
          coordinates: { column: 0, row: 0 }
        }
      })
    ).toBe(false);
    expect(
      adapter.handleEvent({
        event: "dialRotate",
        context: "bad-dial",
        payload: {
          controller: "Encoder",
          coordinates: { column: 4, row: 0 },
          ticks: 2,
          pressed: false
        }
      })
    ).toBe(false);

    expect(controller.registered).toEqual([]);
    expect(controller.rotations).toEqual([]);
  });
});
