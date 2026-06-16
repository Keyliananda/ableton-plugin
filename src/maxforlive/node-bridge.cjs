const maxApi = require("max-api");
const WebSocket = require("ws");

const DEFAULT_URL = "ws://127.0.0.1:17375";
const RECONNECT_DELAY_MS = 1000;
const BRIDGE_HELLO = {
  type: "bridge.hello",
  protocolVersion: 1,
  bridgeName: "Ableton Rack Bridge"
};

let url = DEFAULT_URL;
let socket = null;
let reconnectTimer = null;
let shouldReconnect = false;

function log(message) {
  maxApi.post(`[ableton-rack-node] ${message}`);
}

function connect() {
  clearReconnect();
  closeSocket();

  shouldReconnect = true;
  socket = new WebSocket(url);

  socket.on("open", () => {
    log(`connected to ${url}`);
    socket.send(JSON.stringify(BRIDGE_HELLO));
    log("sent bridge.hello");
    maxApi.outlet("bridge_connected");
  });

  socket.on("message", (data) => {
    const text = data.toString();
    try {
      JSON.parse(text);
    } catch {
      log(`ignored non-json websocket message: ${text}`);
      return;
    }

    log(`received from plugin: ${text}`);
    maxApi.outlet("plugin_message_uri", encodeURIComponent(text));
  });

  socket.on("close", () => {
    socket = null;
    log("disconnected");
    scheduleReconnect();
  });

  socket.on("error", (error) => {
    log(`socket error: ${error.message}`);
  });
}

function scheduleReconnect() {
  if (!shouldReconnect || reconnectTimer !== null) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_DELAY_MS);
}

function clearReconnect() {
  if (reconnectTimer === null) {
    return;
  }

  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function closeSocket() {
  if (socket === null) {
    return;
  }

  const current = socket;
  socket = null;
  current.removeAllListeners();
  current.close();
}

function sendJsonText(text) {
  if (socket === null || socket.readyState !== WebSocket.OPEN) {
    log(`not connected, dropped message: ${text}`);
    return;
  }

  socket.send(text);
}

maxApi.addHandler("start", () => {
  connect();
});

maxApi.addHandler("stop", () => {
  shouldReconnect = false;
  clearReconnect();
  closeSocket();
  log("stopped");
});

maxApi.addHandler("url", (nextUrl) => {
  url = String(nextUrl || DEFAULT_URL);
  log(`url set to ${url}`);
  if (shouldReconnect) {
    connect();
  }
});

maxApi.addHandler("bridge_message_uri", (encoded) => {
  const text = decodeURIComponent(String(encoded));
  sendJsonText(text);
});

maxApi.addHandler("anything", (...args) => {
  log(`unknown message: ${args.join(" ")}`);
});

log("loaded; connecting");
connect();
