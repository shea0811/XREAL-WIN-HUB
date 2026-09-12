# Roadmap

## v0.1 — foundation (implemented)

- Secure Electron/React shell and Windows packaging.
- Display discovery, preferred display, window placement, theatre mode.
- Local notes, activity, settings, workspace profiles, and gesture mappings.
- Keyboard gesture simulator, simulated One Pro display, and focused AI prompt launchers.
- Integration tests across every module plus GitHub build checks.

## v0.2 — Windows-native refinement

- Persist and restore window geometry per display.
- Optional Windows notifications and global hotkeys with clear permission controls.
- Workspace target editing and richer layout orchestration.
- Export/import of local data with schema validation.
- Accessibility audit with keyboard and screen-reader test coverage.

## v0.3 — supported device provider

- Add a native adapter only when an official Windows-compatible XREAL path is available.
- Provider health diagnostics, version reporting, reconnection, and permission state.
- Hardware-in-the-loop tests for supported device/firmware combinations.
- Optional 3DoF/6DoF features only where the official capability contract supports them.

## Release readiness

- Configure Windows code signing.
- Test installer upgrade/uninstall behavior on clean Windows 10 and 11 machines.
- Add crash reporting only as explicit opt-in, with a published data policy.
- Establish semantic versioning and signed GitHub releases.
