# XREAL WIN HUB Security Assessment

**Assessment date:** 13 September 2026  
**Application version:** 0.2.0-beta.5 + WhatsApp workspace changes  
**Scope:** Electron main/preload processes, React renderer, local persistence, Spotify and YouTube integrations, Windows display helper, workspace launching, packaging configuration, dependencies, and the new WhatsApp Web integration.

## Executive assessment

The application is suitable for a **personal beta with moderate residual risk**, but it is not yet ready for broad or enterprise distribution. No critical vulnerabilities or known vulnerable npm dependencies were identified. The new WhatsApp surface has a strong isolation boundary: it uses a separate persistent Chromium session, enables sandboxing and context isolation, disables Node.js and preload access, restricts navigation, denies screen capture, validates its IPC sender and view geometry, and prompts before notification or camera/microphone access.

The most important remaining risk is architectural: Spotify and YouTube code currently execute in the Hub's primary renderer, which also receives the privileged `window.xrealHub` bridge. Existing IPC endpoints also lack consistent sender validation. These should be addressed before agents, third-party automation, enterprise deployment, or additional remote services are introduced.

### Risk rating

| Area | Rating | Summary |
| --- | --- | --- |
| WhatsApp integration | Low–moderate | Strong isolation; persistent session data and floating-window privacy still need user controls. |
| Electron renderer boundary | High | Remote media scripts share a renderer that has access to the Hub bridge. |
| Local data | Moderate | Notes and Hub state are local but not encrypted. |
| Windows integration | Moderate | Inputs are validated, but PowerShell execution increases consequence if the renderer boundary is compromised. |
| Dependencies | Low | `npm audit` reported zero known vulnerabilities across production and development dependencies. |
| Distribution | Moderate–high | No configured Windows code signing, hardened Electron fuses, or authenticated update channel. |

## Controls verified

- Electron main window uses `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`.
- The WhatsApp page has no preload script and therefore receives no Hub IPC API.
- WhatsApp uses its own `persist:whatsapp` storage partition.
- Only `https://web.whatsapp.com` may remain inside the WhatsApp surface.
- New windows are denied; HTTPS links are delegated to the system browser.
- Screen-sharing requests from WhatsApp are denied.
- Clipboard sanitised write is allowed; notifications and media require an explicit Hub confirmation; all other permissions are denied.
- New WhatsApp IPC handlers verify that the sender is the main Hub window.
- WhatsApp view bounds and navigation commands are allowlisted and validated.
- Hub state writes are size-limited, atomic, and created with owner-only file mode where supported.
- Spotify tokens are protected with Electron `safeStorage` when OS encryption is available.
- Display-layout proposals validate connected identities, coordinates, primary-display rules and resolutions before PowerShell execution.
- Child processes use fixed executable names and argument arrays rather than interpolating user input into a shell, except for a fixed internal media-key PowerShell definition.
- The application declares no telemetry.
- The renderer has a Content Security Policy and blocks unrestricted object/embed content through `default-src 'self'`.

## Findings and recommendations

### H-01 — Remote scripts share the privileged Hub renderer

**Evidence:** The primary page CSP permits Spotify and YouTube script origins. The Spotify SDK and YouTube player execute in the same renderer that receives `window.xrealHub` from the preload script.

**Impact:** A compromised provider script, unsafe future media code, or renderer XSS could invoke local Hub capabilities such as opening URLs, changing window state, controlling displays or launching workspaces.

**Recommendation:** Move Spotify and YouTube remote execution into isolated `WebContentsView` sessions with no preload, following the WhatsApp model. Keep only trusted, bundled UI in the main renderer. Expose narrowly scoped media commands through validated main-process controllers.

### H-02 — Existing IPC handlers do not consistently validate senders

**Evidence:** The new WhatsApp handlers validate the sending `webContents`; older state, workspace, display, window, media and Spotify handlers do not.

**Impact:** Any unexpected renderer or subframe that gains bridge access could call privileged handlers. Sender validation will not cure a compromise of the trusted main renderer, but it meaningfully reduces attack paths and prevents future windows from inheriting unintended authority.

**Recommendation:** Route every privileged handler through one `registerTrustedHandler` wrapper. Validate `event.senderFrame.origin`, the exact main `webContents`, argument schemas and maximum request rates. Split read-only and mutating capabilities.

### M-01 — Windows packages are not configured for code signing or trusted updates

**Impact:** Users cannot reliably verify publisher identity, Windows SmartScreen warnings are more likely, and future update distribution could become a supply-chain risk.

**Recommendation:** Sign release executables and NSIS installers with an organisation-owned certificate. Add a verified release pipeline, protected tags, reproducible build records, checksums and an authenticated update channel before distribution.

### M-02 — Persistent WhatsApp session needs lifecycle controls

**Evidence:** The isolated partition deliberately persists linked-device cookies and local storage so the user stays signed in.

**Impact:** Anyone with access to the unlocked Windows profile may inherit the WhatsApp session. Deleting normal Hub state does not clear this partition.

**Recommendation:** Add **Lock WhatsApp**, **Sign out / clear linked session**, automatic privacy hide on workstation lock, and an optional inactivity timeout. Document that the device appears in WhatsApp's Linked Devices list. Encourage Windows Hello and full-disk encryption.

### M-03 — Notes and Hub state are plaintext at rest

**Impact:** Local malware, another administrator, backups, or physical access to an unlocked profile can read study notes, workspace URLs and activity history.

**Recommendation:** Encrypt sensitive fields with `safeStorage`, add a user-controlled app lock, minimise activity retention, provide deletion/export controls, and avoid placing secrets in notes or workspace URLs.

### M-04 — PowerShell display integration expands the trusted computing base

**Evidence:** Display management launches a packaged PowerShell helper with `ExecutionPolicy Bypass`; media keys also use PowerShell. Layout data is validated and passed through files/arguments rather than shell concatenation.

**Impact:** Tampering with unpacked helper files or a future validation regression could produce high-impact local actions.

**Recommendation:** Replace PowerShell with a signed native helper where practical. Until then, verify the helper hash at runtime, use restrictive ACLs, code-sign the package, keep validation in the main process and never pass free-form commands.

### M-05 — Production CSP can be tightened

**Evidence:** The shared CSP permits remote script execution, inline styles, localhost HTTP/WebSocket connections and multiple provider wildcards.

**Impact:** Broad directives increase the destinations available after renderer compromise.

**Recommendation:** Generate separate development and production policies. Remove localhost and WebSocket sources from production, eliminate remote scripts after provider isolation, use hashes/nonces where inline styles remain, and explicitly set `object-src 'none'`, `base-uri 'none'`, and `form-action 'self'`.

### L-01 — External HTTPS destinations are user-controlled

**Impact:** A malicious or mistaken workspace URL can open a phishing page in the system browser.

**Recommendation:** Display the hostname before first launch, warn on lookalike/internationalised domains, and offer per-workspace domain allowlists. Plain HTTP is now rejected except for loopback addresses.

### L-02 — Floating WhatsApp can expose sensitive content

**Impact:** Always-on-top chats may remain visible during screen sharing or when another person is nearby.

**Recommendation:** Default always-on-top to off after the first session, add a global privacy shortcut, obscure content in task switching where Windows permits it, and auto-hide when the workstation locks.

### L-03 — No IPC rate limiting or security-event audit trail

**Impact:** A compromised trusted renderer could repeatedly request expensive operations or make incident reconstruction difficult.

**Recommendation:** Add per-channel throttles, structured security logs with no message/note content, crash correlation IDs and a user-visible diagnostic export with automatic redaction.

## WhatsApp threat model

| Threat | Current mitigation | Residual risk |
| --- | --- | --- |
| Remote page reaches local Node/Electron APIs | No preload, Node disabled, context isolation and sandbox enabled | Electron/Chromium zero-day |
| Navigation to malicious page inside privileged surface | Exact WhatsApp origin restriction | Legitimate WhatsApp page compromise |
| Unexpected permission access | Deny-by-default allowlist and explicit prompts | User may approve a misleading request |
| Screen capture | Display-media requests denied | User can still share the whole desktop externally |
| Session theft | Separate persistent partition | Windows-profile or disk compromise |
| Automated message access | No DOM injection, scraping or messaging API | Future changes must preserve this boundary |
| UI overlay/phishing | View geometry validated; remote surface limited to its stage | WhatsApp itself controls all pixels inside the stage |

## Verification performed

- `npm run check`: **passed**
  - 10 test files passed.
  - 42 tests passed.
  - TypeScript project build passed.
  - Vite production build passed.
  - Electron main, preload and Spotify scripts passed Node syntax validation.
- `npm audit --json`: **0 known vulnerabilities** across 430 total dependency entries.
- `npm audit --omit=dev --json`: **0 known production vulnerabilities**.
- `npm run package:dir`: **passed**; Electron Builder produced an unpacked application.
- `git diff --check`: **passed**; no whitespace errors.
- Manual source review covered remote navigation, permission handling, IPC exposure, renderer isolation, state storage, OAuth token storage, child-process execution, CSP, packaging and telemetry declarations.

## Release gates

Before a public or enterprise release:

1. Resolve H-01 and H-02.
2. Add signed Windows builds and a protected release pipeline.
3. Add WhatsApp session clearing and workstation-lock privacy handling.
4. Encrypt sensitive local data and add a complete deletion workflow.
5. Run the Windows installer on a clean Windows VM and test QR linking, reconnect, microphone/camera prompts, notifications, detach/reattach, privacy hide, offline recovery and account unlinking.
6. Perform dynamic application security testing against the signed release and repeat dependency/SBOM scanning in CI.

## Reference baseline

- Electron security checklist: https://www.electronjs.org/docs/latest/tutorial/security
- Electron `WebContentsView`: https://www.electronjs.org/docs/latest/api/web-contents-view
- Electron sessions and permission handlers: https://www.electronjs.org/docs/latest/api/session
- WhatsApp linked-device guidance: https://faq.whatsapp.com/1428782138011916/
- WhatsApp Terms of Service: https://www.whatsapp.com/legal/terms-of-service-eea
