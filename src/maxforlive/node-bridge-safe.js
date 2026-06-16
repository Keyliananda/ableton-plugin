const maxApi = require("max-api");
const WebSocket = require("ws");

const DEFAULT_URL = "ws://127.0.0.1:17375";
const RECONNECT_DELAY_MS = 5000;
const DEBUG = false;
const HELLO_RETRY_DELAYS_MS = [250, 1000];
const BRIDGE_HELLO = {
  type: "bridge.hello",
  protocolVersion: 1,
  bridgeName: "Ableton Rack Bridge"
};

let url = DEFAULT_URL;
let socket = null;
let reconnectTimer = null;
let shouldReconnect = false;
let lastError = "";

function log(message) {
  maxApi.post(`[ableton-rack-node-safe] ${message}`);
}

function debugLog(message) {
  if (DEBUG) {
    log(message);
  }
}

function connect() {
  clearReconnect();
  closeSocket();

  shouldReconnect = true;
  socket = new WebSocket(url);

  socket.on("open", () => {
    lastError = "";
    log(`connected to ${url}`);
    sendBridgeHello();
    for (const delay of HELLO_RETRY_DELAYS_MS) {
      setTimeout(sendBridgeHello, delay);
    }
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

    debugLog(`received from plugin: ${text}`);
    maxApi.outlet("plugin_message_uri", encodeURIComponent(text));
  });

  socket.on("close", () => {
    socket = null;
    scheduleReconnect();
  });

  socket.on("error", (error) => {
    const message = error && error.message ? error.message : String(error);
    if (message !== lastError) {
      lastError = message;
      log(`socket error: ${message}`);
    }
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
    log(`not connected, dropped bridge message`);
    return;
  }

  socket.send(text);
}

function sendBridgeHello() {
  if (socket === null || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(BRIDGE_HELLO));
  debugLog("sent bridge.hello");
}

maxApi.addHandler("start", () => {
  log("start requested");
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
