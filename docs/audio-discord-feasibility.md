# Audio and Discord implementation report

## Outcome

XREAL WIN HUB now provides a responsive Windows master-volume control, active-application volume controls, and an isolated Discord Web workspace. Spotify and YouTube remain beside the expanding command-search control, while their media popovers focus only on playback and device selection.

The implementation deliberately does not attempt to override Discord's microphone or voice-output selection from the Hub's Windows mixer panel. Those devices remain controlled in **Discord → User Settings → Voice & Video**, where Discord can enumerate and test the actual devices. This avoids presenting a setting that may appear to work while leaving Discord on a different device.

## Requirement assessment

| Requirement | Result | Notes |
| --- | --- | --- |
| Compact search icon that stretches right | Implemented | Expands on hover or keyboard focus and opens the existing command palette when clicked. |
| Spotify and YouTube left of search | Implemented | Both retain their now-playing and transport popovers. |
| Remove provider volume sliders | Implemented | Spotify and YouTube popovers no longer expose competing volume controls. |
| Master-volume button beside Display Ready | Implemented | Uses the Windows Core Audio endpoint-volume API through a narrowly scoped, integrity-pinned helper. |
| Per-app volume presets | Implemented | Spotify, YouTube/Hub, and Discord controls become available when Windows reports an active audio session. |
| Expanded preset hides other presets | Implemented | The selected preset has an explicit expand/collapse control. |
| Discord inside the Hub | Implemented | Discord Web runs in its own persistent, sandboxed Electron partition and can be embedded or detached. |
| Discord microphone and output switching from the Hub mixer | Not implemented | Discord's own Voice & Video page is the reliable control surface for call devices and testing. |
| Change the Windows default output device | Not implemented | Microsoft's supported Core Audio endpoint-volume API controls volume, not the default-device policy. The commonly used `IPolicyConfig` approach is undocumented and unsuitable for a security-sensitive release. |

## Audio architecture

The Windows helper uses documented Core Audio COM interfaces:

- `IAudioEndpointVolume` reads and writes the default render endpoint's master scalar volume.
- `IAudioSessionManager2` and `IAudioSessionEnumerator` discover active shared-mode audio sessions.
- `IAudioSessionControl2` provides the owning process ID used to produce a stable application key.
- `ISimpleAudioVolume` adjusts the selected session without changing the master endpoint.

The UI updates optimistically so slider motion remains immediate. Native writes are debounced to avoid launching a PowerShell/COM operation for every pointer movement. The main process validates volume ranges and session identifiers before writing a temporary JSON payload. The helper's SHA-256 digest is pinned in the main process, so an altered helper is rejected before execution.

Windows audio sessions are dynamic. An application normally appears only after it creates an audio stream, and multiple processes may share or recreate sessions. The Hub therefore labels these as **active app sessions**, refreshes them whenever the sound panel opens, and shows a clear inactive state when no matching session exists. Exclusive-mode audio streams may bypass normal shared-session controls.

## Discord architecture and security

Discord Web is hosted in an Electron `WebContentsView` rather than an iframe. It uses:

- a dedicated `persist:discord` storage partition;
- Chromium sandboxing, context isolation, no Node.js integration, and web security;
- an origin allowlist for Discord navigation;
- explicit user prompts for microphone, camera, and notification permissions;
- a detached, optional always-on-top window;
- automatic hiding on workstation lock and the Hub privacy shortcut;
- a data-clear operation as part of clearing Hub local data.

Discord's Embedded App SDK is intended for Activities that run *inside Discord*. It does not provide a supported mechanism for third-party desktop software to embed and remotely configure the complete Discord client. Hosting Discord Web in an isolated web surface is therefore the practical integration, while Discord remains responsible for login, calls, device selection, and account security.

## Validation performed

Automated coverage verifies:

- the Core Audio helper interface declarations and fixed action boundary;
- audio-helper integrity pinning;
- Discord's isolated partition and hardened renderer preferences;
- absence of Spotify and YouTube volume sliders in their popovers;
- presence of the master-volume panel and Discord navigation;
- all existing Spotify, display-layout, security, notification, UI, and build checks.

The full `npm run check` gate includes unit/component tests, TypeScript compilation, the production Vite build, and Node syntax checks for privileged Electron files.

## Windows acceptance checklist

Because the build environment used for this change is Linux, final hardware validation must be performed in the installed Windows build:

1. Open the volume panel and verify its initial percentage matches Windows Quick Settings.
2. Drag the master slider and confirm Windows master volume follows after release.
3. Start playback in Spotify, YouTube, and Discord one at a time; reopen the volume panel and verify the corresponding active-session control appears.
4. Change one application slider and verify the master level and other applications remain unchanged.
5. Open Discord, sign in, join a test call, and select/test the microphone and output under Voice & Video.
6. Lock Windows and confirm embedded/detached messaging surfaces are hidden.

## Primary references

- Microsoft, [EndpointVolume API](https://learn.microsoft.com/en-us/windows/win32/coreaudio/endpointvolume-api)
- Microsoft, [Audio sessions](https://learn.microsoft.com/en-us/windows/win32/coreaudio/audio-sessions)
- Microsoft, [`IAudioEndpointVolume`](https://learn.microsoft.com/en-us/windows/win32/api/endpointvolume/nn-endpointvolume-iaudioendpointvolume)
- Microsoft, [`SetMasterVolumeLevelScalar`](https://learn.microsoft.com/en-us/windows/win32/api/endpointvolume/nf-endpointvolume-iaudioendpointvolume-setmastervolumelevelscalar)
- Electron, [`webContents.setAudioOutputDevice`](https://www.electronjs.org/docs/latest/api/web-contents#contentssetaudiooutputdevicedeviceid)
- Discord, [Embedded App SDK](https://docs.discord.com/developers/developer-tools/embedded-app-sdk)
