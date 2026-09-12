# XREAL WIN HUB

A local-first Windows command centre for XREAL displays. It brings display placement, theatre launching, notes, repeatable workspaces, gesture-ready controls, and focused AI launchers into one desktop app.

> Status: v0.2 beta development. The original MVP remains functional while the notification, notes, entertainment, and Windows display workflows are expanded in tested checkpoints.

## What is included

- **Home dashboard** — device status, quick launch cards, and a 25-minute focus timer.
- **XREAL device centre** — Windows display discovery, preferred-display selection, window placement, and theatre mode.
- **Display Layout Studio** — draggable physical/XREAL topology, screen identification, primary-display selection, edge snapping, guarded Windows apply, and automatic rollback.
- **One Pro simulator** — deterministic 1920×1080 virtual-device mode for testing connection-dependent flows without hardware.
- **Entertainment hub** — dedicated, persistent Spotify and YouTube pages, saved media links, now-playing artwork, top-bar transport/volume controls, and secure browser launchers for DRM-only services.
- **Spotify Premium** — optional desktop PKCE sign-in for direct previous/play/next, an exact volume slider, and playback through the Hub; the credential-free embed remains available as a fallback.
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
| Play Spotify and YouTube in the Hub | Ready | Dedicated persistent pages using the official YouTube IFrame API, Spotify embed fallback, and optional Spotify Premium Web Playback SDK integration |
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

### Connect Spotify Premium

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add `http://127.0.0.1/callback` to its redirect URIs exactly as shown.
3. In the installed Windows Hub, open **Entertainment → Spotify**, paste the app's Client ID, and choose **Connect Spotify**.
4. Complete Spotify's browser sign-in. The Hub requests playback-only scopes and stores the resulting token encrypted with Windows secure storage.

Spotify Premium is required for direct Web Playback SDK control. The Client ID is public application configuration, not a client secret; never add a Spotify client secret to the Hub.

## Verify and package

```powershell
npm run check
npm run package:win
```

The Windows installer is emitted to `release/`. The build is unsigned until a Windows code-signing certificate is configured.

The automated suite covers application startup rendering, all primary modules,
One Pro simulation, display topology validation and previews, display events, notes, gesture actions, embedded-media URL validation,
external launchers, appearance settings, persistence boundaries, and unsafe-URL rejection.

## Security and privacy

- Renderer isolation is enabled (`contextIsolation`, sandbox, no Node integration).
- The renderer can access only the explicit preload bridge.
- Spotify and YouTube frames, scripts, media, artwork, and API connections are restricted to official HTTPS origins by Content Security Policy.
- Spotify uses Authorization Code with PKCE. Refresh credentials are encrypted with Electron `safeStorage` on Windows and are never written to the repository.
- Windows media commands accept only four fixed virtual-key actions; arbitrary keys or commands cannot cross the preload bridge.
- External destinations must use HTTP or HTTPS and open outside Electron.
- Local state is capped at 2 MB and written atomically.
- There is no analytics, telemetry, camera request, or client-secret store. Spotify authorization is provider-owned and opened in the default browser.

See [Architecture](docs/ARCHITECTURE.md), [XREAL integration](docs/XREAL_INTEGRATION.md), [Roadmap](docs/ROADMAP.md), [Contributing](CONTRIBUTING.md), and [Security](SECURITY.md).
