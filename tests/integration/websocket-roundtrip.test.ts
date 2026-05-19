import { afterEach, describe, expect, it } from "vitest";
import type { PluginToBridgeMessage } from "../../src/protocol/messages.js";
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
        activeBank: 1,
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
      paramId: 9005,
      slot: 5,
      ticks: 2,
      fine: false
    });
  });
});

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
