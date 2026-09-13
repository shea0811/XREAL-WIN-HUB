import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, ChevronUp, CircleHelp, Command, Pause, Play, Search, SkipBack, SkipForward, Volume1, Volume2 } from 'lucide-react';
import { MediaBrandIcon, type MediaService } from './MediaBrandIcon';
import { getNavigationItem } from '../navigation';
import { platform } from '../services/platform';
import { useMedia } from '../state/MediaContext';
import type { AudioSnapshot, HubSection, SpotifyDevice, SystemSnapshot } from '../types';

const AUDIO_PRESETS = [
  { id: 'spotify', label: 'Spotify', session: 'spotify' },
  { id: 'youtube', label: 'YouTube', session: 'xreal win hub' },
  { id: 'discord', label: 'Discord', session: 'discord' },
] as const;

export function TopBar({ section, snapshot, preferredDisplayId, onOpenPalette, unreadNotifications, notificationCenterOpen, onToggleNotifications, onHelp }: {
  section: HubSection;
  snapshot: SystemSnapshot | null;
  preferredDisplayId: string | null;
  onOpenPalette(): void;
  unreadNotifications: number;
  notificationCenterOpen: boolean;
  onToggleNotifications(): void;
  onHelp(): void;
}) {
  const media = useMedia();
  const [mediaMenu, setMediaMenu] = useState<MediaService | null>(null);
  const [spotifyDevices, setSpotifyDevices] = useState<SpotifyDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [audio, setAudio] = useState<AudioSnapshot>({ supported: false, masterVolume: 50, sessions: [] });
  const [audioPreset, setAudioPreset] = useState<string | null>(null);
  const [audioExpanded, setAudioExpanded] = useState(false);
  const mediaMenuRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const masterTimer = useRef<number | null>(null);
  const sessionTimer = useRef<number | null>(null);
  const item = getNavigationItem(section);
  const detected = snapshot?.xreal.connection === 'display-detected';
  const manuallySelected = Boolean(preferredDisplayId && snapshot?.displays.some((display) => display.id === preferredDisplayId));
  const connected = detected || manuallySelected;

  useEffect(() => {
    if (!mediaMenu) return;
    const close = (event: MouseEvent) => { if (!mediaMenuRef.current?.contains(event.target as Node)) setMediaMenu(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMediaMenu(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [mediaMenu]);

  useEffect(() => {
    if (!audioOpen) return;
    void platform.getAudioSnapshot().then(setAudio).catch((error) => setAudio((current) => ({ ...current, message: error instanceof Error ? error.message : 'Windows audio is unavailable.' })));
    const close = (event: MouseEvent) => { if (!audioRef.current?.contains(event.target as Node)) setAudioOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [audioOpen]);

  useEffect(() => () => {
    if (masterTimer.current) window.clearTimeout(masterTimer.current);
    if (sessionTimer.current) window.clearTimeout(sessionTimer.current);
  }, []);

  async function refreshSpotifyDevices() {
    setDevicesLoading(true);
    try { setSpotifyDevices(await platform.getSpotifyDevices()); }
    catch (error) { media.updateStatus('spotify', { message: error instanceof Error ? error.message : 'Spotify devices could not be loaded.' }); }
    finally { setDevicesLoading(false); }
  }

  useEffect(() => { if (mediaMenu === 'spotify') void refreshSpotifyDevices(); }, [mediaMenu]);

  async function selectSpotifyDevice(deviceId: string) {
    try {
      const next = await platform.setSpotifyDevice(deviceId);
      media.updateStatus('spotify', { ready: true, active: next.available, playing: next.playing, title: next.title, detail: next.detail, volume: next.volume, artwork: next.artwork, deviceId: next.deviceId, deviceName: next.deviceName, message: next.message });
      await refreshSpotifyDevices();
    } catch (error) { media.updateStatus('spotify', { message: error instanceof Error ? error.message : 'Spotify could not switch devices.' }); }
  }

  function toggleMediaMenu(service: MediaService) {
    media.setActiveService(service);
    setAudioOpen(false);
    setMediaMenu((current) => current === service ? null : service);
  }

  function changeMasterVolume(value: number) {
    const volume = Math.max(0, Math.min(100, value));
    setAudio((current) => ({ ...current, masterVolume: volume, message: undefined }));
    if (masterTimer.current) window.clearTimeout(masterTimer.current);
    masterTimer.current = window.setTimeout(() => {
      void platform.setMasterVolume(volume).then(setAudio).catch((error) => setAudio((current) => ({ ...current, message: error instanceof Error ? error.message : 'Master volume could not be changed.' })));
    }, 90);
  }

  function changeSessionVolume(sessionKey: string, value: number) {
    const volume = Math.max(0, Math.min(100, value));
    setAudio((current) => ({ ...current, sessions: current.sessions.map((session) => session.key === sessionKey ? { ...session, volume } : session) }));
    if (sessionTimer.current) window.clearTimeout(sessionTimer.current);
    sessionTimer.current = window.setTimeout(() => {
      void platform.setAudioSessionVolume(sessionKey, volume).then(setAudio).catch((error) => setAudio((current) => ({ ...current, message: error instanceof Error ? error.message : 'Application volume could not be changed.' })));
    }, 120);
  }

  const mediaStatus = mediaMenu ? media.status[mediaMenu] : null;
  const selectedPreset = AUDIO_PRESETS.find((preset) => preset.id === audioPreset);

  return (
    <header className="topbar">
      <div className="topbar__title"><span>{item.label}</span><small>{item.description}</small></div>
      <div className="topbar__search-cluster">
        <div className="topbar-media" ref={mediaMenuRef}>
          {(['spotify', 'youtube'] as const).map((service) => <button key={service} className="media-trigger" data-active={mediaMenu === service} onClick={() => toggleMediaMenu(service)} aria-label={`Open ${service === 'spotify' ? 'Spotify' : 'YouTube'} controls`} aria-expanded={mediaMenu === service}><MediaBrandIcon service={service} width={21} height={21} /></button>)}
          {mediaMenu && mediaStatus ? (
            <section className="media-popover" aria-label={`${mediaMenu === 'spotify' ? 'Spotify' : 'YouTube'} controls`}>
              <header>{mediaStatus.artwork ? <img src={mediaStatus.artwork} alt="" className="media-popover__artwork" /> : <MediaBrandIcon service={mediaMenu} width={30} height={30} />}<span><strong>{mediaStatus.title}</strong><small>{mediaStatus.ready ? mediaStatus.detail : 'Player is connecting…'}</small></span></header>
              <div className="media-popover__transport"><button onClick={() => media.run(mediaMenu, 'previous')} aria-label="Previous"><SkipBack size={18} /></button><button className="media-popover__play" onClick={() => media.run(mediaMenu, 'toggle')} aria-label={mediaStatus.playing ? 'Pause' : 'Play'}>{mediaStatus.playing ? <Pause size={19} /> : <Play size={19} />}</button><button onClick={() => media.run(mediaMenu, 'next')} aria-label="Next"><SkipForward size={18} /></button></div>
              {mediaMenu === 'spotify' ? <label className="media-popover__device"><span>Playback device</span><select aria-label="Spotify playback device" value={mediaStatus.deviceId ?? spotifyDevices.find((device) => device.active)?.id ?? ''} onChange={(event) => void selectSpotifyDevice(event.target.value)} disabled={devicesLoading || spotifyDevices.length === 0}><option value="">{devicesLoading ? 'Finding devices…' : spotifyDevices.length ? 'Choose a device' : 'No devices found'}</option>{spotifyDevices.map((device) => <option key={device.id} value={device.id} disabled={device.restricted}>{device.name} · {device.type}{device.active ? ' (active)' : ''}</option>)}</select><button type="button" onClick={() => void refreshSpotifyDevices()} disabled={devicesLoading}>Refresh</button></label> : null}
              {mediaStatus.message ? <p>{mediaStatus.message}</p> : null}
            </section>
          ) : null}
        </div>
        <button className="command-trigger" onClick={onOpenPalette} aria-label="Search or run a command"><Search size={17} aria-hidden /><span>Search or run a command</span><kbd><Command size={12} aria-hidden />K</kbd></button>
      </div>
      <div className="topbar__actions">
        <span className="device-indicator" data-connected={connected}><span aria-hidden />{snapshot?.xreal.simulated ? 'One Pro simulated' : connected ? 'Display ready' : 'No XREAL display'}</span>
        <div className="audio-menu" ref={audioRef}>
          <button className="icon-button" data-active={audioOpen} onClick={() => { setMediaMenu(null); setAudioOpen((open) => !open); }} aria-label="Open Windows volume controls" aria-expanded={audioOpen}><Volume2 size={19} /></button>
          {audioOpen ? <section className="audio-popover" aria-label="Windows volume controls">
            <header><span><strong>System sound</strong><small>{audio.supported ? 'Windows master and active app sessions' : 'Available in the Windows app'}</small></span><b>{audio.masterVolume}%</b></header>
            <label className="audio-master"><Volume1 size={17} /><input aria-label="Master volume" type="range" min="0" max="100" value={audio.masterVolume} onChange={(event) => changeMasterVolume(Number(event.target.value))} disabled={!audio.supported} /><Volume2 size={17} /></label>
            <div className="audio-presets" role="radiogroup" aria-label="Application sound presets">
              {AUDIO_PRESETS.filter((preset) => !audioExpanded || preset.id === audioPreset).map((preset) => {
                const active = preset.id === audioPreset;
                const session = audio.sessions.find((candidate) => candidate.key === preset.session || candidate.key.includes(preset.session));
                return <div className="audio-preset" data-active={active} key={preset.id}>
                  <button role="radio" aria-checked={active} onClick={() => { setAudioPreset(preset.id); setAudioExpanded(false); }}><span className={`audio-preset__brand audio-preset__brand--${preset.id}`}>{preset.label.slice(0, 1)}</span><span>{preset.label}<small>{session ? `${session.volume}% · active` : 'No active audio session'}</small></span></button>
                  {active ? <button className="audio-preset__expand" aria-label={`${audioExpanded ? 'Close' : 'Open'} ${preset.label} sound settings`} onClick={() => setAudioExpanded((value) => !value)}>{audioExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button> : null}
                  {active && audioExpanded ? <div className="audio-preset__detail">{session ? <label><span>Application volume</span><input aria-label={`${preset.label} application volume`} type="range" min="0" max="100" value={session.volume} onChange={(event) => changeSessionVolume(session.key, Number(event.target.value))} /></label> : <p>Start audio in {preset.label}, then reopen this panel so Windows can expose its audio session.</p>}{preset.id === 'discord' ? <p>Choose the microphone and call output inside Discord → User Settings → Voice &amp; Video, where Discord can test the selected hardware.</p> : null}</div> : null}
                </div>;
              })}
            </div>
            {selectedPreset && !audioExpanded ? <small className="audio-popover__hint">Press the arrow on {selectedPreset.label} for its sound settings.</small> : null}
            {audio.message ? <p className="audio-popover__message">{audio.message}</p> : null}
          </section> : null}
        </div>
        <button className="icon-button notification-button" data-active={notificationCenterOpen} onClick={onToggleNotifications} aria-label={`Open notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}><Bell size={18} />{unreadNotifications ? <span>{Math.min(unreadNotifications, 9)}</span> : null}</button>
        <button className="icon-button" onClick={onHelp} aria-label="Open setup help"><CircleHelp size={19} /></button>
      </div>
    </header>
  );
}
