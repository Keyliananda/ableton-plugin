import { afterEach, describe, expect, it } from "vitest";
import type { BridgeToPluginMessage, PluginToBridgeMessage } from "../../src/protocol/messages.js";
import { StreamDeckBridgeServer } from "../../src/streamdeck/server.js";

const servers: StreamDeckBridgeServer[] = [];
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.close();
  }

  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("StreamDeckBridgeServer", () => {
  it("binds to 127.0.0.1 and notifies listeners for bridge messages", async () => {
    const server = new StreamDeckBridgeServer({ port: 0 });
    servers.push(server);
    const received = onceBridgeMessage(server);

    await server.start();
    expect(server.address.host).toBe("127.0.0.1");

    const socket = await connect(server.address.port);
    sockets.push(socket);
    socket.send(
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

    await expect(received).resolves.toMatchObject({ type: "device.changed", device: { id: 12345 } });
  });

  it("can send plugin messages to one or more connected bridge clients", async () => {
    const server = new StreamDeckBridgeServer({ port: 0 });
    servers.push(server);
    await server.start();
    const first = await connect(server.address.port);
    const second = await connect(server.address.port);
    sockets.push(first, second);

    const firstMessage = onceSocketMessage(first);
    const secondMessage = onceSocketMessage(second);
    const delta: PluginToBridgeMessage = {
      type: "param.delta",
      deviceId: 12345,
      paramId: 9001,
      slot: 1,
      ticks: 2,
      fine: false
    };

    server.send(delta);

    await expect(firstMessage).resolves.toEqual(delta);
    await expect(secondMessage).resolves.toEqual(delta);
  });

  it("ignores malformed JSON and non bridge-to-plugin payloads", async () => {
    const server = new StreamDeckBridgeServer({ port: 0 });
    servers.push(server);
    await server.start();
    const socket = await connect(server.address.port);
    sockets.push(socket);
    const messages: BridgeToPluginMessage[] = [];
    server.onMessage((message) => messages.push(message));

    socket.send("{not-json");
    socket.send(JSON.stringify({ type: "param.delta", deviceId: 1, paramId: 2, slot: 0, ticks: 1, fine: false }));
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(messages).toEqual([]);
  });
});

function onceBridgeMessage(server: StreamDeckBridgeServer): Promise<BridgeToPluginMessage> {
  return new Promise((resolve) => {
    server.onMessage((message) => resolve(message));
  });
}

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", () => reject(new Error("WebSocket failed to connect")), { once: true });
  });
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
