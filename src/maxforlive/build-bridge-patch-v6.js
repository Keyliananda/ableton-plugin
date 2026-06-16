autowatch = 1;
inlets = 1;
outlets = 0;

function bang() {
  build();
}

function loadbang() {
  build();
}

function build() {
  var p = this.patcher;
  if (!p) {
    post("[ableton-rack-builder-v6] no patcher available yet.\n");
    return;
  }

  clearEverythingExceptAudioAndSelf(p);

  var plugin = findBoxByText(p, "plugin~") || p.newdefault(60, 60, "plugin~");
  var plugout = findBoxByText(p, "plugout~") || p.newdefault(60, 420, "plugout~");

  var title = p.newdefault(170, 60, "comment", "Ableton Rack Bridge live-test patch");
  var startMsg = p.newdefault(170, 115, "message");
  startMsg.message("set", "script start");
  var node = p.newdefault(170, 165, "node.script", "node-bridge.cjs");
  var refreshMsg = p.newdefault(390, 165, "message", "bang");
  var liveApi = p.newdefault(390, 230, "js", "live-api-adapter.js");
  var note = p.newdefault(390, 75, "comment", "Click script start, select a Rack, then click bang. No metro.");
  var print = p.newdefault(170, 295, "print", "ableton-rack-node");

  ignore(title);
  ignore(note);

  safeConnect(p, plugin, 0, plugout, 0);
  safeConnect(p, plugin, 1, plugout, 1);
  safeConnect(p, startMsg, 0, node, 0);
  safeConnect(p, node, 0, liveApi, 0);
  safeConnect(p, node, 1, print, 0);
  safeConnect(p, refreshMsg, 0, liveApi, 0);
  safeConnect(p, liveApi, 0, node, 0);

  post("[ableton-rack-builder-v6] clean patch created. Click script start, select a Rack, then click bang.\n");
}

function clearEverythingExceptAudioAndSelf(patcher) {
  var boxes = [];
  var self = this.box;

  patcher.apply(function(box) {
    var text = box && box.text ? String(box.text) : "";
    if (box === self || text === "plugin~" || text === "plugout~") {
      return;
    }
    boxes.push(box);
  });

  for (var i = 0; i < boxes.length; i += 1) {
    try {
      patcher.remove(boxes[i]);
    } catch (error) {
      post("[ableton-rack-builder-v6] remove failed: " + error + "\n");
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
    post("[ableton-rack-builder-v6] connect failed: " + error + "\n");
  }
}

function ignore(_) {
}

bang.local = 1;
loadbang.local = 1;
build.local = 1;
clearEverythingExceptAudioAndSelf.local = 1;

build();
