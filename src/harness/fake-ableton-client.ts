import { pathToFileURL } from "node:url";
import type { BridgeToPluginMessage, PluginToBridgeMessage } from "../protocol/messages.js";

const PROTOCOL_VERSION = 1;
const DEFAULT_PORT = 17375;

export interface FakeAbletonClientOptions {
  url?: string;
  port?: number;
  activeBank?: 0 | 1;
}

export function createSampleDeviceChanged(activeBank: 0 | 1 = 0): BridgeToPluginMessage {
  return {
    type: "device.changed",
    device: {
      id: 12345,
      name: "Fake Performance Rack",
      className: "AudioEffectGroupDevice",
      isRack: true
    },
    bankCount: 2,
    activeBank,
    params: Array.from({ length: 8 }, (_, slot) => ({
      slot,
      id: 9000 + slot,
      name: `Macro ${slot + 1}`,
      value: slot / 8,
      displayValue: `${Math.round((slot / 8) * 100)}%`,
      min: 0,
      max: 1,
      normalized: slot / 8,
      isQuantized: false,
      isEnabled: true,
      valueItems: []
    }))
  };
}

export function createBridgeHello(): BridgeToPluginMessage {
  return {
    type: "bridge.hello",
    protocolVersion: PROTOCOL_VERSION,
    bridgeName: "Fake Ableton Rack Bridge"
  };
}

export function runFakeAbletonClient(options: FakeAbletonClientOptions = {}): WebSocket {
  const WebSocketCtor = globalThis.WebSocket;
  if (typeof WebSocketCtor !== "function") {
    throw new Error("WebSocket is not available in this Node runtime.");
  }

  const url = options.url ?? `ws://127.0.0.1:${options.port ?? DEFAULT_PORT}`;
  const activeBank = options.activeBank ?? 0;
  const socket = new WebSocketCtor(url);

  socket.addEventListener("open", () => {
    console.log(`[fake-ableton] connected to ${url}`);
    send(socket, createBridgeHello());
    send(socket, createSampleDeviceChanged(activeBank));
    console.log(`[fake-ableton] sent sample device.changed for bank ${activeBank}`);
  });

  socket.addEventListener("message", (event) => {
    const message = parsePluginMessage(String(event.data));
    if (message === null) {
      console.log(`[fake-ableton] received non-protocol payload: ${String(event.data)}`);
      return;
    }

    console.log(`[fake-ableton] received ${message.type}: ${JSON.stringify(message)}`);
  });

  socket.addEventListener("close", () => {
    console.log("[fake-ableton] disconnected");
  });

  socket.addEventListener("error", () => {
    console.error(`[fake-ableton] connection error for ${url}`);
  });

  return socket;
}

function send(socket: WebSocket, message: BridgeToPluginMessage): void {
  socket.send(JSON.stringify(message));
}

function parsePluginMessage(data: string): PluginToBridgeMessage | null {
  try {
    return JSON.parse(data) as PluginToBridgeMessage;
  } catch {
    return null;
  }
}

function parseCliArgs(argv: readonly string[]): FakeAbletonClientOptions {
  const port = readNumberArg(argv, "--port");
  const url = readStringArg(argv, "--url");
  const activeBank = readNumberArg(argv, "--bank");

  return {
    ...(url ? { url } : {}),
    ...(port === undefined ? {} : { port }),
    activeBank: activeBank === 1 ? 1 : 0
  };
}

function readStringArg(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return argv[index + 1];
}

function readNumberArg(argv: readonly string[], name: string): number | undefined {
  const raw = readStringArg(argv, name);
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const socket = runFakeAbletonClient(parseCliArgs(process.argv.slice(2)));

  process.once("SIGINT", () => {
    socket.close();
  });
}
