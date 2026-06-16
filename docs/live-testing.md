# Live Testing With Ableton

This is the first real Ableton smoke test. It uses:

- `node .\dist\src\harness\dev-live-host.js` as the Stream Deck plugin stand-in.
- a Max for Live Audio Effect with one `js` object and one `node.script` object.

## 1. Sync The Max Runtime Files

Max loads the JavaScript files from a stable folder without spaces in the path:

```text
S:/AbletonRackBridge
```

After changing any file in `src/maxforlive`, sync the runtime copies before
reloading the Max device:

```powershell
npm run maxforlive:sync
```

The sync copies the Max patch builder, `live-api-adapter.js`,
`node-bridge-safe.js`, and `node-smoke.js`, then makes `node_modules` available
in the Max runtime folder.

## 2. Start The Local Host

Open PowerShell in the repo and run:

```powershell
node .\dist\src\harness\dev-live-host.js
```

If your PowerShell execution policy allows `npm.ps1`, this equivalent command
also works:

```powershell
npm run harness:dev-live-host
```

Leave it running.

## 3. Create The Max For Live Device

In Ableton Live:

1. Create or open a set.
2. Add an Audio Track.
3. Drop **Max Audio Effect** on the track.
4. Click the device edit button to open Max.
5. Add one object:

```text
js S:/AbletonRackBridge/build-bridge-patch-v5.js
```

The builder creates the rest of the patch automatically. The node bridge starts
automatically through `live.thisdevice`, and the small `script start`,
`script stop`, and `bang` messages are only recovery controls while testing.

If you prefer to patch manually, add these objects:

```text
[loadbang]
[live.thisdevice]
[message script start]
[message script stop]
[message bang]
[js S:/AbletonRackBridge/live-api-adapter.js]
[node.script S:/AbletonRackBridge/node-bridge-safe.js]
```

Wire them like this:

```text
[live.thisdevice] -> [message script start] -> [node.script ...]
[message script stop] -> [node.script ...]
[message bang] -> [js ...]
[js ...] left outlet -> [node.script ...]
[node.script ...] left outlet -> [js ...]
```

Reload the Max device, select the Rack in Ableton, and the bridge should start
and refresh automatically. Click `script start` or `bang` only as manual
fallbacks while testing. The bridge polls again after each successful dial
write, and it gently watches the selected Ableton device so the dial labels
switch automatically after selecting another Rack.

After the bridge is connected, the dev host can also request that same selected
Rack refresh from the console with:

```text
refresh
```

The real Stream Deck plugin does not need a visible refresh key. It requests a
refresh automatically when the Max bridge connects, and the Max device refreshes
the mapping automatically when the selected Ableton device changes.

## 4. Select A Rack

In Ableton:

1. Put an Audio Effect Rack or Instrument Rack on any track.
2. Map one to eight Macros.
3. Click/select that Rack in Ableton's device area.

The PowerShell host should print feedback lines such as:

```text
[feedback:dial-0] on title="Macro 1" value="..."
```

## 5. Simulate Stream Deck Dial Input

In the PowerShell host, type:

```text
state
refresh
t
r 0 1
r 1 -2
b1
r 0 3
```

Expected result:

- `refresh` asks Max for Live to resend the currently selected Rack mapping; it
  is a dev-host fallback, not a required Stream Deck action.
- `t` toggles the selected Rack's `Device On` parameter.
- `r 0 1` changes the first visible Macro.
- `b1` switches to Macros 5-8.
- `r 0 3` changes Macro 5.

## Notes

This proves Ableton Live API read/write plus protocol behavior through the
developer host. The Stream Deck plugin uses the same bridge protocol, but the
actual hardware display and dial events still need real-device verification.
