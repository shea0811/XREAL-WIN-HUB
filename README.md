# XREAL WIN HUB

A local-first Windows command centre for XREAL displays. It brings display placement, theatre launching, notes, repeatable workspaces, gesture-ready controls, and focused AI launchers into one desktop app.

> Status: v0.2 beta development. The original MVP remains functional while the notification, notes, entertainment, and Windows display workflows are expanded in tested checkpoints.

## What is included

- **Home dashboard** — device status, quick launch cards, and a 25-minute focus timer.
- **XREAL device centre** — Windows display discovery, preferred-display selection, window placement, and theatre mode.
- **Display Layout Studio** — draggable physical/XREAL topology, screen identification, primary-display selection, edge snapping, guarded Windows apply, and automatic rollback.
- **One Pro simulator** — deterministic 1920×1080 virtual-device mode for testing connection-dependent flows without hardware.
- **Entertainment deck** — full-screen setup and secure browser launchers for DRM-compatible playback.
- **Notes & study** — searchable, autosaved notebooks organised into sections and pages with lightweight tags.
- **Workspaces** — built-in study, cyber lab, entertainment, and service-desk launch profiles plus custom launchers.
- **Gesture studio** — six configurable mappings with keyboard simulation and a stable adapter boundary for future hardware input.
- **Agent desk** — purpose-built prompts for study, building, research, and support without storing credentials.
- **Notification Centre** — five-second alerts, hover pause, a left-to-right particle dissolve, unread state, and local history.
- **Settings** — theme, scale, contrast, reduced motion, Windows startup, always-on-top, display, privacy diagnostics, and recent activity.

## Capability boundary

| Capability | v0.1 state | Implementation |
|---|---|---|
| Discover connected displays | Ready | Electron `screen` API |
| Move the hub to a chosen display | Ready | Validated display ID and window bounds |
| Theatre/full-screen mode | Ready | Electron full-screen control |
| Local notebooks, settings, notifications, and activity | Ready | Versioned state with v0.1 migration and atomic JSON writes |
| Launch sites and workspace targets | Ready | Validated HTTP(S) URLs in the default browser |
| Gesture configuration and execution | Ready | Keyboard simulation (`Ctrl+Shift+1` through `6`) |
| Simulated One Pro connection | Ready | In-app virtual display and connection-event provider |
| Arrange the Windows desktop | Ready | Native display enumeration, position-only batch apply, 15-second confirmation, and independent 20-second rollback watcher |
| XREAL Eye/native hand input on Windows | Planned | Provider adapter; no undocumented SDK assumptions |
| Spatial anchoring and hardware controls | Planned | Requires a supported native integration path |

XREAL's public SDK documentation currently describes Unity XR development and an Android quickstart. XREAL Eye is advertised as enabling 6DoF on supported One-series hardware, but this project does not claim a public Windows hand-input API that XREAL does not document. See the [XREAL SDK documentation](https://docs.xreal.com/) and [SDK quickstart](https://docs.xreal.com/Getting%20Started%20with%20XREAL%20SDK).

## Run locally

Requirements: Node.js 22.12+ and npm. Windows 10/11 x64 is required to exercise the packaged desktop and display-placement features.

```powershell
git clone https://github.com/shea0811/XREAL-WIN-HUB.git
cd XREAL-WIN-HUB
npm ci
npm run dev
```

For a browser-only UI preview:

```powershell
npm run dev:web
```

Open **XREAL device → Simulate One Pro** to verify display selection, movement,
theatre controls, workspace targeting, and gesture workflows without attaching the glasses.
Simulation is clearly labelled and never enables native hand-tracking or spatial capabilities.

## Verify and package

```powershell
npm run check
npm run package:win
```

The Windows installer is emitted to `release/`. The build is unsigned until a Windows code-signing certificate is configured.

The automated suite covers application startup rendering, all primary modules,
One Pro simulation, display topology validation and previews, display events, notes, gesture actions, external launchers,
appearance settings, persistence boundaries, and unsafe-URL rejection.

## Security and privacy

- Renderer isolation is enabled (`contextIsolation`, sandbox, no Node integration).
- The renderer can access only the explicit preload bridge.
- External destinations must use HTTP or HTTPS and open outside Electron.
- Local state is capped at 2 MB and written atomically.
- There is no analytics, telemetry, camera request, API-key store, or embedded account login.

See [Architecture](docs/ARCHITECTURE.md), [XREAL integration](docs/XREAL_INTEGRATION.md), [Roadmap](docs/ROADMAP.md), [Contributing](CONTRIBUTING.md), and [Security](SECURITY.md).
