# XREAL integration boundary

## Supported in v0.1

The hub treats XREAL glasses as a Windows display. Electron enumerates displays and uses conservative name matching (`XREAL`, legacy `NREAL`, `Air 2`, or `One Pro`) as a convenience. Because Windows display labels can be generic, the user can always select the correct display manually in Settings.

Once selected, the hub can move its own window into that display's work area and enter or leave full-screen theatre mode.

## Built-in One Pro simulator

The device centre can expose a labelled `XREAL One Pro (simulated)` display at
1920 × 1080. In Electron, safe window-placement and theatre actions are routed to
the primary display while the simulator is active. In the browser preview, the
same snapshot and event contract is exercised without attempting OS-level window
control.

The simulator deliberately reports hand tracking, spatial tracking, and hardware
controls as unavailable. It validates application behavior; it is not evidence
that a physical One Pro or XREAL Eye sensor is connected.

## Gesture provider contract

The renderer consumes these stable gesture IDs:

| Gesture ID | Default simulation shortcut | Default action |
|---|---:|---|
| `pinch` | Ctrl+Shift+1 | Activate focused control |
| `open-palm` | Ctrl+Shift+2 | Open command palette |
| `swipe-left` | Ctrl+Shift+3 | Previous section |
| `swipe-right` | Ctrl+Shift+4 | Next section |
| `double-pinch` | Ctrl+Shift+5 | Create quick note |
| `fist` | Ctrl+Shift+6 | Start/pause focus |

A native provider should translate hardware input into one of these IDs and send only that event across the preload boundary. Camera frames, skeletal data, and vendor objects should stay inside the provider process unless a future feature has a clear, consented need for them.

## Why native input is marked planned

The public [XREAL SDK](https://docs.xreal.com/) is documented around Unity XR, and its [getting-started flow](https://docs.xreal.com/Getting%20Started%20with%20XREAL%20SDK) targets an Android application. This MVP therefore avoids pretending that those APIs are an available production Windows hand-tracking bridge.

Before enabling native input:

1. Confirm supported XREAL hardware and firmware.
2. Obtain an official Windows-compatible SDK or documented local transport.
3. Run input recognition outside the sandboxed renderer.
4. Add explicit permission and diagnostics UI.
5. Contract-test provider events against the gesture IDs above.
6. Keep keyboard simulation as a deterministic fallback.
