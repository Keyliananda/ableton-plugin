import {
  PROTOCOL_VERSION,
  isPluginToBridgeMessage,
  type BridgeToPluginMessage,
  type PluginToBridgeMessage
} from "../protocol/messages.js";

export interface BridgeSocket {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: ((error: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface ReconnectScheduler<Timer = ReturnType<typeof setTimeout>> {
  setTimeout(callback: () => void, delayMs: number): Timer;
  clearTimeout(timer: Timer): void;
}

export interface MaxForLiveBridgeClientOptions<Timer = ReturnType<typeof setTimeout>> {
  url?: string;
  port?: number;
  reconnectDelayMs?: number;
  socketFactory?: (url: string) => BridgeSocket;
  scheduler?: ReconnectScheduler<Timer>;
}

type MessageHandler = (message: PluginToBridgeMessage) => void;

const DEFAULT_PORT = 17375;
const DEFAULT_RECONNECT_DELAY_MS = 1000;

export class MaxForLiveBridgeClient<Timer = ReturnType<typeof setTimeout>> {
  private readonly url: string;
  private readonly reconnectDelayMs: number;
  private readonly socketFactory: (url: string) => BridgeSocket;
  private readonly scheduler: ReconnectScheduler<Timer>;
  private readonly handlers = new Set<MessageHandler>();
  private socket: BridgeSocket | null = null;
  private reconnectTimer: Timer | null = null;
  private reconnecting = false;

  constructor(options: MaxForLiveBridgeClientOptions<Timer> = {}) {
    this.url = options.url ?? `ws://127.0.0.1:${options.port ?? DEFAULT_PORT}`;
    this.reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    this.socketFactory = options.socketFactory ?? createGlobalWebSocket;
    this.scheduler = options.scheduler ?? {
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs) as Timer,
      clearTimeout: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>)
    };
  }

  connect(): void {
    this.clearReconnectTimer();
    const socket = this.socketFactory(this.url);
    this.socket = socket;

    socket.onopen = () => {
      this.send({
        type: "bridge.hello",
        protocolVersion: PROTOCOL_VERSION,
        bridgeName: "Ableton Rack Bridge"
      });
    };
    socket.onmessage = (event) => {
      const message = parseMessage(event.data);
      if (!isPluginToBridgeMessage(message)) {
        return;
      }

      for (const handler of this.handlers) {
        handler(message);
      }
    };
    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      this.scheduleReconnect();
    };
    socket.onerror = () => undefined;
  }

  startReconnectLoop(): void {
    if (this.reconnecting) {
      return;
    }

    this.reconnecting = true;
    this.connect();
  }

  stopReconnectLoop(): void {
    this.reconnecting = false;
    this.clearReconnectTimer();
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  disconnect(): void {
    this.stopReconnectLoop();
  }

  send(message: BridgeToPluginMessage): void {
    this.socket?.send(JSON.stringify(message));
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private scheduleReconnect(): void {
    if (!this.reconnecting || this.reconnectTimer !== null) {
      return;
    }

    this.reconnectTimer = this.scheduler.setTimeout(() => {
      const timer = this.reconnectTimer;
      this.reconnectTimer = null;
      if (timer !== null) {
        this.scheduler.clearTimeout(timer);
      }
      if (this.reconnecting) {
        this.connect();
      }
    }, this.reconnectDelayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) {
      return;
    }

    this.scheduler.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}

function parseMessage(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function createGlobalWebSocket(url: string): BridgeSocket {
  const WebSocketCtor = globalThis.WebSocket;
  if (typeof WebSocketCtor !== "function") {
    throw new Error("WebSocket is not available; pass socketFactory when constructing MaxForLiveBridgeClient.");
  }

  return new WebSocketCtor(url) as BridgeSocket;
}
