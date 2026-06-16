import { createHash } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Socket } from "node:net";
import { isBridgeToPluginMessage, type BridgeToPluginMessage, type PluginToBridgeMessage } from "../protocol/messages.js";

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export interface StreamDeckBridgeServerOptions {
  host?: string;
  port: number;
}

export interface StreamDeckBridgeServerAddress {
  host: string;
  port: number;
}

export type BridgeMessageListener = (message: BridgeToPluginMessage) => void;
export type BridgeDisconnectListener = () => void;

export class StreamDeckBridgeServer {
  private readonly host: string;
  private readonly port: number;
  private readonly server: http.Server;
  private readonly clients = new Set<Socket>();
  private readonly listeners = new Set<BridgeMessageListener>();
  private readonly disconnectListeners = new Set<BridgeDisconnectListener>();
  private started = false;

  constructor(options: StreamDeckBridgeServerOptions) {
    this.host = options.host ?? "127.0.0.1";
    this.port = options.port;
    this.server = http.createServer();
    this.server.on("upgrade", (request, socket) => {
      this.acceptUpgrade(request, socket as Socket);
    });
  }

  get address(): StreamDeckBridgeServerAddress {
    const address = this.server.address() as AddressInfo | null;

    return {
      host: this.host,
      port: address?.port ?? this.port
    };
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        this.server.off("listening", onListening);
        reject(error);
      };
      const onListening = (): void => {
        this.server.off("error", onError);
        this.started = true;
        resolve();
      };

      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(this.port, this.host);
    });
  }

  onMessage(listener: BridgeMessageListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  onDisconnect(listener: BridgeDisconnectListener): () => void {
    this.disconnectListeners.add(listener);

    return () => {
      this.disconnectListeners.delete(listener);
    };
  }

  send(message: PluginToBridgeMessage): void {
    const frame = encodeTextFrame(JSON.stringify(message));

    for (const client of this.clients) {
      if (!client.destroyed) {
        client.write(frame);
      }
    }
  }

  async close(): Promise<void> {
    for (const client of this.clients) {
      client.end(encodeCloseFrame());
      client.destroy();
    }

    this.clients.clear();

    if (!this.started) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        this.started = false;
        resolve();
      });
    });
  }

  private acceptUpgrade(request: http.IncomingMessage, socket: Socket): void {
    const websocketKey = request.headers["sec-websocket-key"];

    if (typeof websocketKey !== "string") {
      socket.destroy();
      return;
    }

    const acceptKey = createHash("sha1")
      .update(`${websocketKey}${WEBSOCKET_GUID}`)
      .digest("base64");

    socket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${acceptKey}`,
        "\r\n"
      ].join("\r\n")
    );

    this.clients.add(socket);
    this.attachSocket(socket);
  }

  private attachSocket(socket: Socket): void {
    let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const result = decodeTextFrames(buffer);
      buffer = result.remaining;

      for (const text of result.messages) {
        this.receiveText(text);
      }

      if (result.shouldClose) {
        socket.end(encodeCloseFrame());
        socket.destroy();
        this.deleteClient(socket);
      }
    });
    socket.on("close", () => {
      this.deleteClient(socket);
    });
    socket.on("error", () => {
      this.deleteClient(socket);
    });
  }

  private deleteClient(socket: Socket): void {
    const existed = this.clients.delete(socket);
    if (!existed) {
      return;
    }

    for (const listener of this.disconnectListeners) {
      listener();
    }
  }

  private receiveText(text: string): void {
    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }

    if (!isBridgeToPluginMessage(parsed)) {
      return;
    }

    for (const listener of this.listeners) {
      listener(parsed);
    }
  }
}

function encodeTextFrame(text: string): Buffer {
  return encodeFrame(0x1, Buffer.from(text, "utf8"));
}

function encodeCloseFrame(): Buffer {
  return encodeFrame(0x8, Buffer.alloc(0));
}

function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const payloadLength = payload.length;

  if (payloadLength < 126) {
    return Buffer.concat([Buffer.from([0x80 | opcode, payloadLength]), payload]);
  }

  if (payloadLength <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payloadLength, 2);
    return Buffer.concat([header, payload]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payloadLength), 2);
  return Buffer.concat([header, payload]);
}

function decodeTextFrames(
  buffer: Buffer<ArrayBufferLike>
): { messages: string[]; remaining: Buffer<ArrayBufferLike>; shouldClose: boolean } {
  const messages: string[] = [];
  let offset = 0;
  let shouldClose = false;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const opcode = firstByte & 0x0f;
    const isMasked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let headerLength = 2;

    if (payloadLength === 126) {
      if (offset + headerLength + 2 > buffer.length) {
        break;
      }

      payloadLength = buffer.readUInt16BE(offset + headerLength);
      headerLength += 2;
    } else if (payloadLength === 127) {
      if (offset + headerLength + 8 > buffer.length) {
        break;
      }

      const largeLength = buffer.readBigUInt64BE(offset + headerLength);
      if (largeLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        return { messages, remaining: Buffer.alloc(0), shouldClose: true };
      }

      payloadLength = Number(largeLength);
      headerLength += 8;
    }

    const maskLength = isMasked ? 4 : 0;
    const frameEnd = offset + headerLength + maskLength + payloadLength;

    if (frameEnd > buffer.length) {
      break;
    }

    if (opcode === 0x8) {
      shouldClose = true;
      offset = frameEnd;
      continue;
    }

    if (opcode === 0x1) {
      const mask = isMasked ? buffer.subarray(offset + headerLength, offset + headerLength + 4) : null;
      const payloadStart = offset + headerLength + maskLength;
      const payload = Buffer.from(buffer.subarray(payloadStart, frameEnd));

      if (mask) {
        for (let index = 0; index < payload.length; index += 1) {
          payload[index] ^= mask[index % 4];
        }
      }

      messages.push(payload.toString("utf8"));
    }

    offset = frameEnd;
  }

  return { messages, remaining: buffer.subarray(offset), shouldClose };
}
