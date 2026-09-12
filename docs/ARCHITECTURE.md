# Architecture

XREAL WIN HUB uses Electron for native Windows capabilities and React for the interface. The boundary is deliberately narrow so a future XREAL input provider can be added without coupling hardware code to UI modules.

```mermaid
flowchart TD
    UI["React renderer"] --> State["Hub state/context"]
    UI --> Bridge["Typed preload bridge"]
    Bridge --> Main["Electron main process"]
    Main --> Windows["Windows display and shell APIs"]
    Main --> Guard["Independent rollback watcher"]
    Main --> Disk["Atomic local JSON"]
```

## Process boundaries

### Renderer

`src/` contains the React application, modules, local state manager, browser preview fallback, and pure utility code. It has no Node.js access.

### Preload

`electron/preload.cjs` exposes a small `window.xrealHub` contract. No generic IPC method is exposed, which keeps renderer input constrained to known operations.

### Main process

`electron/main.cjs` owns display discovery, guarded topology changes, window movement, full-screen state, startup registration, secure external launching, and local persistence. All URLs, display identities, positions, and immutable modes are validated again here because renderer data is untrusted at a process boundary.

### Display Layout Studio

The renderer edits a draft containing positions and primary-display state. Resolution, scale, and rotation are read-only. Before applying, the main process re-enumerates attached Windows devices and rejects missing, duplicated, resized, non-integer, or out-of-range entries.

On Windows, `electron/windows-display.ps1` uses `EnumDisplayDevices`, `EnumDisplaySettings`, and `ChangeDisplaySettingsEx` to test and stage every position before a single batch apply. A detached watcher holds the original topology and restores it after 20 seconds unless the user confirms through the 15-second in-app prompt. The five-second margin allows rollback even if the renderer or main process exits during confirmation.

### Embedded media

`MediaProvider` keeps Spotify and YouTube controller state above page navigation. The Entertainment module remains mounted while hidden, so changing Hub sections does not destroy an active player. The renderer loads only Spotify's official Embed iFrame API and YouTube's official IFrame Player API, with both origins allowlisted in the Content Security Policy.

YouTube transport and volume commands remain inside its player API. Spotify's credential-free embed directly supports play/pause but not previous, next, or volume. In the packaged Windows app those three controls use a narrow IPC method that accepts only `previous`, `next`, `volume-up`, or `volume-down` and emits the corresponding Windows media virtual key. Browser preview reports that native limitation instead of simulating success.

## Persistence

The state schema is versioned with `schemaVersion: 2` and migrates v0.1 data. Electron stores `hub-state.json` beneath `app.getPath('userData')`; a temporary file is written and renamed to avoid partially written state. Browser previews use `localStorage` only as a development fallback.

Persisted data includes notebooks, sections, notes, notifications, workspace profiles, gesture mappings, preferences, and recent activity. It excludes secrets, ChatGPT content, credentials, camera data, and telemetry.

## Design decisions

- Spotify and YouTube use official in-app embeds. DRM-heavy services such as Netflix continue to open in the default browser for compatibility.
- Workspaces express launch intent (`focus`, `split`, or `theatre`) but v0.1 does not reposition arbitrary third-party windows.
- Gesture IDs are stable domain events. Simulation and future native providers must emit the same IDs.
- Browser preview behavior is intentionally degraded for native-only controls and communicates that boundary in the UI.
