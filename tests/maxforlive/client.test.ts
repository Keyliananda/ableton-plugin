import { describe, expect, it, vi } from "vitest";
import { MaxForLiveBridgeClient, type BridgeSocket } from "../../src/maxforlive/client.js";

class FakeSocket implements BridgeSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  readonly sent: string[] = [];
  close = vi.fn(() => {
    this.onclose?.();
  });

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(data);
  }

  open(): void {
    this.onopen?.();
  }

  receive(value: unknown): void {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}

function createSocketHarness() {
  const sockets: FakeSocket[] = [];

  return {
    sockets,
    factory: (url: string) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    }
  };
}

describe("MaxForLiveBridgeClient", () => {
  it("connects to localhost by port and sends bridge.hello after opening", () => {
    const harness = createSocketHarness();
    const client = new MaxForLiveBridgeClient({ port: 4123, socketFactory: harness.factory });

    client.connect();
    harness.sockets[0]?.open();

    expect(harness.sockets[0]?.url).toBe("ws://127.0.0.1:4123");
    expect(harness.sockets[0]?.sent.map((message) => JSON.parse(message))).toEqual([
      {
        type: "bridge.hello",
        protocolVersion: 1,
        bridgeName: "Ableton Rack Bridge"
      }
    ]);
  });

  it("forwards incoming param.delta and bank.set messages to handlers", () => {
    const harness = createSocketHarness();
    const client = new MaxForLiveBridgeClient({ url: "ws://127.0.0.1:9123", socketFactory: harness.factory });
    const received = vi.fn();
    client.onMessage(received);

    client.connect();
    harness.sockets[0]?.receive({
      type: "param.delta",
      deviceId: 12,
      paramId: 34,
      slot: 0,
      ticks: 2,
      fine: false
    });
    harness.sockets[0]?.receive({ type: "bank.set", bank: 1 });
    harness.sockets[0]?.receive({ type: "not.valid" });

    expect(received).toHaveBeenCalledTimes(2);
    expect(received).toHaveBeenNthCalledWith(1, {
      type: "param.delta",
      deviceId: 12,
      paramId: 34,
      slot: 0,
      ticks: 2,
      fine: false
    });
    expect(received).toHaveBeenNthCalledWith(2, { type: "bank.set", bank: 1 });
  });

  it("starts and stops reconnecting without leaving pending timers", () => {
    const harness = createSocketHarness();
    const pending = new Set<number>();
    const callbacks = new Map<number, () => void>();
    let nextTimer = 1;
    const scheduler = {
      setTimeout(callback: () => void, _delayMs: number): number {
        const id = nextTimer++;
        pending.add(id);
        callbacks.set(id, callback);
        return id;
      },
      clearTimeout(id: number): void {
        pending.delete(id);
        callbacks.delete(id);
      }
    };
    const client = new MaxForLiveBridgeClient({
      url: "ws://127.0.0.1:9999",
      reconnectDelayMs: 25,
      socketFactory: harness.factory,
      scheduler
    });

    client.startReconnectLoop();
    expect(harness.sockets).toHaveLength(1);

    harness.sockets[0]?.onclose?.();
    expect(pending.size).toBe(1);

    const reconnect = callbacks.get([...pending][0]);
    reconnect?.();
    expect(harness.sockets).toHaveLength(2);

    harness.sockets[1]?.onclose?.();
    expect(pending.size).toBe(1);

    client.stopReconnectLoop();
    expect(pending.size).toBe(0);

    harness.sockets[1]?.onclose?.();
    expect(pending.size).toBe(0);
  });
});
