autowatch = 1;
inlets = 1;
outlets = 1;

var ROOT = "S:/Coding Stuff/ableton-plugin";

function bang() {
  build();
}

function loadbang() {
  build();
}

function build() {
  var p = this.patcher;
  if (!p) {
    post("[ableton-rack-builder-v3] no patcher available yet.\n");
    return;
  }

  var plugin = findBoxByText(p, "plugin~") || p.newdefault(60, 60, "plugin~");
  var plugout = findBoxByText(p, "plugout~") || p.newdefault(60, 420, "plugout~");

  var title = p.newdefault(170, 60, "comment", "Ableton Rack Bridge live-test patch");
  var thisDevice = p.newdefault(170, 105, "live.thisdevice");
  var startMsg = p.newdefault(170, 150, "message");
  startMsg.message("set", "script start");
  var toggle = p.newdefault(330, 103, "toggle");
  var note = p.newdefault(365, 105, "comment", "Turn on to poll Ableton every 250 ms.");
  var metro = p.newdefault(330, 150, "metro", 250);
  var liveApi = p.newdefault(330, 210, "js", ROOT + "/src/maxforlive/live-api-adapter.js");
  var node = p.newdefault(170, 270, "node.script", ROOT + "/src/maxforlive/node-bridge.cjs");
  var route = p.newdefault(170, 330, "route", "plugin_message_uri");
  var print = p.newdefault(575, 330, "print", "ableton-rack-node");

  ignore(title);
  ignore(note);

  safeConnect(p, plugin, 0, plugout, 0);
  safeConnect(p, plugin, 1, plugout, 1);
  safeConnect(p, thisDevice, 0, startMsg, 0);
  safeConnect(p, startMsg, 0, node, 0);
  safeConnect(p, toggle, 0, metro, 0);
  safeConnect(p, metro, 0, liveApi, 0);
  safeConnect(p, liveApi, 0, node, 0);
  safeConnect(p, node, 0, route, 0);
  safeConnect(p, route, 0, liveApi, 0);
  safeConnect(p, node, 1, print, 0);

  outlet(0, "done");
  post("[ableton-rack-builder-v3] bridge patch created. Turn on the toggle.\n");
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
    post("[ableton-rack-builder-v3] connect failed: " + error + "\n");
  }
}

function ignore(_) {
}

bang.local = 1;
loadbang.local = 1;
build.local = 1;

build();
