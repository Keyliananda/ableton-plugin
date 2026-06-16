import { afterEach, describe, expect, it } from "vitest";
import type { PluginToBridgeMessage } from "../../src/protocol/messages.js";
import type { FeedbackPayload, StreamDeckFeedbackAdapter } from "../../src/streamdeck/feedback.js";
import { StreamDeckPluginController } from "../../src/streamdeck/plugin.js";

const controllers: StreamDeckPluginController[] = [];
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.close();
  }

  await Promise.all(controllers.splice(0).map((controller) => controller.stop()));
});

describe("Stream Deck bridge websocket roundtrip", () => {
  it("receives device state from the bridge and sends dial deltas with the absolute slot", async () => {
    const controller = new StreamDeckPluginController({
      server: { port: 0 },
      feedback: { setFeedback: () => undefined }
    });
    controllers.push(controller);

    await controller.start();
    controller.registerDialContext(0, "dial-0");
    controller.registerDialContext(1, "dial-1");
    controller.registerDialContext(2, "dial-2");
    controller.registerDialContext(3, "dial-3");

    const bridge = await connect(controller.address.port);
    sockets.push(bridge);
    const delta = onceSocketMessage(bridge);

    bridge.send(
      JSON.stringify({
        type: "device.changed",
        device: {
          id: 12345,
          name: "Performance Rack",
          className: "AudioEffectGroupDevice",
          isRack: true
        },
        bankCount: 2,
        activeBank: 0,
        params: Array.from({ length: 8 }, (_, slot) => ({
          slot,
          id: 9000 + slot,
          name: `Macro ${slot + 1}`,
          value: 0.5,
          displayValue: "50%",
          min: 0,
          max: 1,
          normalized: 0.5,
          isQuantized: false,
          isEnabled: true,
          valueItems: []
        }))
      })
    );
    await waitFor(() => controller.getState().device?.id === 12345);

    controller.rotateDial(1, 2, false);

    await expect(delta).resolves.toEqual({
      type: "param.delta",
      deviceId: 12345,
      paramId: 9001,
      slot: 1,
      ticks: 2,
      fine: false
    });
  });

  it("reports when a dial rotation cannot target a mapped parameter", async () => {
    const controller = new StreamDeckPluginController({
      server: { port: 0 },
      feedback: { setFeedback: () => undefined }
    });
    controllers.push(controller);

    await controller.start();

    expect(controller.rotateDial(1, 2, false)).toBe(false);
  });

  it("sends device.refresh to the bridge when refresh is requested", async () => {
    const controller = new StreamDeckPluginController({
      server: { port: 0 },
      feedback: { setFeedback: () => undefined }
    });
    controllers.push(controller);

    await controller.start();
    const bridge = await connect(controller.address.port);
    sockets.push(bridge);
    const refresh = onceSocketMessage(bridge);

    controller.requestDeviceRefresh();

    await expect(refresh).resolves.toEqual({ type: "device.refresh" });
  });

  it("sends device.toggle for the currently selected device", async () => {
    const controller = new StreamDeckPluginController({
      server: { port: 0 },
      feedback: { setFeedback: () => undefined }
    });
    controllers.push(controller);

    await controller.start();
    const bridge = await connect(controller.address.port);
    sockets.push(bridge);
    bridge.send(
      JSON.stringify({
        type: "device.changed",
        device: {
          id: 12345,
          name: "Performance Rack",
          className: "AudioEffectGroupDevice",
          isRack: true
        },
        bankCount: 2,
        activeBank: 0,
        params: []
      })
    );
    await waitFor(() => controller.getState().device?.id === 12345);

    const toggle = onceSocketMessage(bridge);

    expect(controller.toggleSelectedDevice()).toBe(true);
    await expect(toggle).resolves.toEqual({ type: "device.toggle", deviceId: 12345 });
  });

  it("requests a device refresh when the bridge says hello", async () => {
    const controller = new StreamDeckPluginController({
      server: { port: 0 },
      feedback: { setFeedback: () => undefined }
    });
    controllers.push(controller);

    await controller.start();
    const bridge = await connect(controller.address.port);
    sockets.push(bridge);
    const refresh = onceSocketMessage(bridge);

    bridge.send(
      JSON.stringify({
        type: "bridge.hello",
        protocolVersion: 1,
        bridgeName: "Ableton Rack Bridge"
      })
    );

    await expect(refresh).resolves.toEqual({ type: "device.refresh" });
  });

  it("shows no-rack feedback after the bridge connects before a Rack is selected", async () => {
    const feedback = new RecordingFeedbackAdapter();
    const controller = new StreamDeckPluginController({
      server: { port: 0 },
      feedback
    });
    controllers.push(controller);

    await controller.start();
    controller.registerDialContext(0, "dial-0");
    controller.registerDialContext(1, "dial-1");

    const bridge = await connect(controller.address.port);
    sockets.push(bridge);
    bridge.send(
      JSON.stringify({
        type: "bridge.hello",
        protocolVersion: 1,
        bridgeName: "Ableton Rack Bridge"
      })
    );

    await waitFor(() => feedback.latest("dial-0")?.title === "No Rack");
    expect(feedback.latest("dial-0")).toEqual({
      title: "No Rack",
      value: "",
      indicator: { value: 0 },
      isEnabled: false
    });
    expect(feedback.latest("dial-1")).toEqual({
      title: "",
      value: "",
      indicator: { value: 0 },
      isEnabled: false
    });
  });

  it("toggles only one dial bank at a time", async () => {
    const controller = new StreamDeckPluginController({
      server: { port: 0 },
      feedback: { setFeedback: () => undefined }
    });
    controllers.push(controller);

    await controller.start();

    const bridge = await connect(controller.address.port);
    sockets.push(bridge);

    bridge.send(
      JSON.stringify({
        type: "device.changed",
        device: {
          id: 12345,
          name: "Performance Rack",
          className: "AudioEffectGroupDevice",
          isRack: true
        },
        bankCount: 2,
        activeBank: 0,
        params: Array.from({ length: 8 }, (_, slot) => ({
          slot,
          id: 9000 + slot,
          name: `Macro ${slot + 1}`,
          value: 0.5,
          displayValue: "50%",
          min: 0,
          max: 1,
          normalized: 0.5,
          isQuantized: false,
          isEnabled: true,
          valueItems: []
        }))
      })
    );
    await waitFor(() => controller.getState().device?.id === 12345);

    controller.toggleDialBank(1);

    const secondDialDelta = onceSocketMessage(bridge);
    controller.rotateDial(1, 2, false);
    await expect(secondDialDelta).resolves.toMatchObject({ paramId: 9005, slot: 5 });

    const firstDialDelta = onceSocketMessage(bridge);
    controller.rotateDial(0, 2, false);
    await expect(firstDialDelta).resolves.toMatchObject({ paramId: 9000, slot: 0 });
  });

  it("clears cached state and dial feedback when the bridge disconnects", async () => {
    const feedback = new RecordingFeedbackAdapter();
    const controller = new StreamDeckPluginController({
      server: { port: 0 },
      feedback
    });
    controllers.push(controller);

    await controller.start();
    controller.registerDialContext(0, "dial-0");

    const bridge = await connect(controller.address.port);
    sockets.push(bridge);
    bridge.send(
      JSON.stringify({
        type: "device.changed",
        device: {
          id: 12345,
          name: "Performance Rack",
          className: "AudioEffectGroupDevice",
          isRack: true
        },
        bankCount: 2,
        activeBank: 0,
        params: [
          {
            slot: 0,
            id: 9000,
            name: "Level",
            value: 0.5,
            displayValue: "50%",
            min: 0,
            max: 1,
            normalized: 0.5,
            isQuantized: false,
            isEnabled: true,
            valueItems: []
          }
        ]
      })
    );
    await waitFor(() => feedback.latest("dial-0")?.title === "Level");

    bridge.close();

    await waitFor(() => controller.getState().connected === false);
    await waitFor(() => feedback.latest("dial-0")?.title === "Offline");
    expect(feedback.latest("dial-0")).toEqual({
      title: "Offline",
      value: "Max",
      indicator: { value: 0 },
      isEnabled: false
    });
    expect(controller.getState().device).toBeNull();
  });
});

class RecordingFeedbackAdapter implements StreamDeckFeedbackAdapter {
  readonly payloads: Array<{ context: string; payload: FeedbackPayload }> = [];

  setFeedback(context: string, payload: FeedbackPayload): void {
    this.payloads.push({ context, payload });
  }

  latest(context: string): FeedbackPayload | undefined {
    return this.payloads.filter((entry) => entry.context === context).at(-1)?.payload;
  }
}

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", () => reject(new Error("WebSocket failed to connect")), { once: true });
  });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;

  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error("Timed out waiting for controller state");
}

function onceSocketMessage(socket: WebSocket): Promise<PluginToBridgeMessage> {
  return new Promise((resolve) => {
    socket.addEventListener(
      "message",
      (event) => {
        resolve(JSON.parse(String(event.data)) as PluginToBridgeMessage);
      },
      { once: true }
    );
  });
}
