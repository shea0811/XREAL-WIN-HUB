# Roadmap

## v0.1 — foundation (implemented)

- Secure Electron/React shell and Windows packaging.
- Display discovery, preferred display, window placement, theatre mode.
- Local notes, activity, settings, workspace profiles, and gesture mappings.
- Keyboard gesture simulator, simulated One Pro display, and focused AI prompt launchers.
- Integration tests across every module plus GitHub build checks.

## v0.2 — daily-driver beta (in progress)

- Five-second notification lifecycle, local Notification Centre, and particle-dissolve dismissal. ✅
- OneNote-style notebook, section, and page organisation with v0.1 data migration. ✅
- Native in-app notebook and section creation dialogs for packaged Electron builds. ✅
- Move recent activity from Home to Settings and diagnostics. ✅
- Add a safe visual editor for connected Windows/XREAL display topology. ✅
- Add an XREAL-targeted overlay and local Windows media-session listener.
- Expand Entertainment into a hybrid embedded/app-launching hub. ✅
- Add persistent Spotify/YouTube players and global top-bar media controls. ✅
- Add capability-tested brightness and electrochromic controls without undocumented assumptions.
- Persist and restore window geometry per display.
- Workspace target editing and richer layout orchestration.
- Export/import of local data with schema validation.
- Accessibility audit with keyboard and screen-reader test coverage.

## v0.3 — spatial workspace

- Add an FOV canvas with draggable Hub panels and saved layouts.
- Prototype head-locked overlays only when an official Windows pose provider is available.
- Evaluate a signed Windows Indirect Display Driver for arbitrary-app virtual monitors.

## Supported device provider

- Add a native adapter only when an official Windows-compatible XREAL path is available.
- Provider health diagnostics, version reporting, reconnection, and permission state.
- Hardware-in-the-loop tests for supported device/firmware combinations.
- Optional 3DoF/6DoF features only where the official capability contract supports them.

## Release readiness

- Configure Windows code signing.
- Test installer upgrade/uninstall behavior on clean Windows 10 and 11 machines.
- Add crash reporting only as explicit opt-in, with a published data policy.
- Establish semantic versioning and signed GitHub releases.
