autowatch = 1;
inlets = 1;
outlets = 1;

var ROOT = "S:/AbletonRackBridge";

function bang() {
  build();
}

function loadbang() {
  build();
}

function build() {
  var p = this.patcher;
  if (!p) {
    post("[ableton-rack-builder-v5] no patcher available yet.\n");
    return;
  }

  cleanupOldBridgeBoxes(p);

  var plugin = findBoxByText(p, "plugin~") || p.newdefault(60, 60, "plugin~");
  var plugout = findBoxByText(p, "plugout~") || p.newdefault(60, 420, "plugout~");

  var title = p.newdefault(170, 60, "comment", "Ableton Rack Bridge live-test patch");
  var thisDevice = p.newdefault(170, 105, "live.thisdevice");
  var startMsg = p.newdefault(170, 150, "message");
  startMsg.message("set", "script start");
  var refreshMsg = p.newdefault(330, 150, "message", "bang");
  var note = p.newdefault(330, 115, "comment", "Click bang once after selecting a Rack. No continuous metro.");
  var liveApi = p.newdefault(330, 210, "js", ROOT + "/live-api-adapter.js");
  var node = p.newdefault(170, 270, "node.script", ROOT + "/node-bridge.cjs");
  var print = p.newdefault(575, 330, "print", "ableton-rack-node");

  ignore(title);
  ignore(note);

  safeConnect(p, plugin, 0, plugout, 0);
  safeConnect(p, plugin, 1, plugout, 1);
  safeConnect(p, thisDevice, 0, startMsg, 0);
  safeConnect(p, startMsg, 0, node, 0);
  safeConnect(p, refreshMsg, 0, liveApi, 0);
  safeConnect(p, liveApi, 0, node, 0);
  safeConnect(p, node, 0, liveApi, 0);
  safeConnect(p, node, 1, print, 0);

  outlet(0, "done");
  post("[ableton-rack-builder-v5] old bridge boxes cleaned; bridge patch created with S:/AbletonRackBridge paths.\n");
}

function cleanupOldBridgeBoxes(patcher) {
  var boxes = [];
  patcher.apply(function(box) {
    var text = box && box.text ? String(box.text) : "";
    var maxclass = box && box.maxclass ? String(box.maxclass) : "";

    if (text === "plugin~" || text === "plugout~") {
      return;
    }

    if (text.indexOf("build-bridge-patch-v5.js") !== -1) {
      return;
    }

    if (
      text.indexOf("ableton-plugin/src/maxforlive") !== -1 ||
      text.indexOf("AbletonRackBridge") !== -1 ||
      text === "live.thisdevice" ||
      (text === "metro 250" || text === "metro 1000") ||
      text === "script start" ||
      text === "route plugin_message_uri" ||
      text === "print ableton-rack-node" ||
      text === "Ableton Rack Bridge live-test patch" ||
      text.indexOf("Turn on to poll Ableton") !== -1 ||
      text.indexOf("wait for connected") !== -1 ||
      maxclass === "toggle"
    ) {
      boxes.push(box);
    }
  });

  for (var i = 0; i < boxes.length; i += 1) {
    try {
      patcher.remove(boxes[i]);
    } catch (error) {
      post("[ableton-rack-builder-v5] remove failed: " + error + "\n");
    }
  }
}

function findBoxByText(patcher, text) {
  var found = null;
  patcher.apply(function(box) {
    if (found) {
      return;
    }

    if (box && box.maxclass === "newobj" && String(box.text) === text) {
      found = box;
    }
  });
  return found;
}

function safeConnect(patcher, source, sourceOutlet, destination, destinationInlet) {
  try {
    patcher.connect(source, sourceOutlet, destination, destinationInlet);
  } catch (error) {
    post("[ableton-rack-builder-v5] connect failed: " + error + "\n");
  }
}

function ignore(_) {
}

bang.local = 1;
loadbang.local = 1;
build.local = 1;
cleanupOldBridgeBoxes.local = 1;

build();
