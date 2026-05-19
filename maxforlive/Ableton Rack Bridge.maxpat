{
  "patcher": {
    "fileversion": 1,
    "appversion": {
      "major": 8,
      "minor": 0,
      "revision": 0,
      "architecture": "x64",
      "modernui": 1
    },
    "classnamespace": "box",
    "rect": [100.0, 100.0, 760.0, 520.0],
    "bglocked": 0,
    "openinpresentation": 0,
    "default_fontsize": 12.0,
    "default_fontface": 0,
    "default_fontname": "Arial",
    "gridonopen": 1,
    "gridsize": [15.0, 15.0],
    "gridsnaponopen": 1,
    "objectsnaponopen": 1,
    "statusbarvisible": 2,
    "toolbarvisible": 1,
    "lefttoolbarpinned": 0,
    "toptoolbarpinned": 0,
    "righttoolbarpinned": 0,
    "bottomtoolbarpinned": 0,
    "toolbars_unpinned_last_save": 0,
    "tallnewobj": 0,
    "boxanimatetime": 200,
    "enablehscroll": 1,
    "enablevscroll": 1,
    "devicewidth": 0.0,
    "description": "Ableton selected Rack bridge for Stream Deck testing",
    "digest": "",
    "tags": "",
    "style": "",
    "subpatcher_template": "",
    "boxes": [
      {
        "box": {
          "id": "obj-plugin",
          "maxclass": "newobj",
          "numinlets": 0,
          "numoutlets": 2,
          "outlettype": ["signal", "signal"],
          "patching_rect": [55.0, 55.0, 64.0, 22.0],
          "text": "plugin~"
        }
      },
      {
        "box": {
          "id": "obj-plugout",
          "maxclass": "newobj",
          "numinlets": 2,
          "numoutlets": 0,
          "patching_rect": [55.0, 420.0, 69.0, 22.0],
          "text": "plugout~"
        }
      },
      {
        "box": {
          "id": "comment-title",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [165.0, 54.0, 455.0, 20.0],
          "text": "Ableton Rack Bridge: polls selected device and talks to the local Stream Deck test host."
        }
      },
      {
        "box": {
          "id": "obj-live-thisdevice",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": ["bang"],
          "patching_rect": [165.0, 105.0, 96.0, 22.0],
          "text": "live.thisdevice"
        }
      },
      {
        "box": {
          "id": "msg-script-start",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [165.0, 150.0, 75.0, 22.0],
          "text": "script start"
        }
      },
      {
        "box": {
          "id": "obj-toggle",
          "maxclass": "toggle",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": ["int"],
          "patching_rect": [330.0, 103.0, 24.0, 24.0]
        }
      },
      {
        "box": {
          "id": "comment-toggle",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [365.0, 105.0, 190.0, 20.0],
          "text": "Turn on to poll Ableton every 250 ms."
        }
      },
      {
        "box": {
          "id": "obj-metro",
          "maxclass": "newobj",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": ["bang"],
          "patching_rect": [330.0, 150.0, 64.0, 22.0],
          "text": "metro 250"
        }
      },
      {
        "box": {
          "id": "obj-live-js",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 2,
          "outlettype": ["", ""],
          "patching_rect": [330.0, 210.0, 365.0, 22.0],
          "text": "js \"S:/Coding Stuff/ableton-plugin/src/maxforlive/live-api-adapter.js\""
        }
      },
      {
        "box": {
          "id": "obj-node",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 2,
          "outlettype": ["", ""],
          "patching_rect": [165.0, 270.0, 390.0, 22.0],
          "text": "node.script \"S:/Coding Stuff/ableton-plugin/src/maxforlive/node-bridge.cjs\""
        }
      },
      {
        "box": {
          "id": "obj-route",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 2,
          "outlettype": ["", ""],
          "patching_rect": [165.0, 330.0, 136.0, 22.0],
          "text": "route plugin_message_uri"
        }
      },
      {
        "box": {
          "id": "obj-print",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [575.0, 330.0, 128.0, 22.0],
          "text": "print ableton-rack-node"
        }
      }
    ],
    "lines": [
      {
        "patchline": {
          "source": ["obj-plugin", 0],
          "destination": ["obj-plugout", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-plugin", 1],
          "destination": ["obj-plugout", 1]
        }
      },
      {
        "patchline": {
          "source": ["obj-live-thisdevice", 0],
          "destination": ["msg-script-start", 0]
        }
      },
      {
        "patchline": {
          "source": ["msg-script-start", 0],
          "destination": ["obj-node", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-toggle", 0],
          "destination": ["obj-metro", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-metro", 0],
          "destination": ["obj-live-js", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-live-js", 0],
          "destination": ["obj-node", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-node", 0],
          "destination": ["obj-route", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-route", 0],
          "destination": ["obj-live-js", 0]
        }
      },
      {
        "patchline": {
          "source": ["obj-node", 1],
          "destination": ["obj-print", 0]
        }
      }
    ]
  }
}
