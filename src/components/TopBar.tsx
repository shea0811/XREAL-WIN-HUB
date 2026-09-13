import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CircleHelp,
  Command,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
} from 'lucide-react';
import { MediaBrandIcon, type MediaService } from './MediaBrandIcon';
import { getNavigationItem } from '../navigation';
import { useMedia } from '../state/MediaContext';
import { platform } from '../services/platform';
import type { HubSection, SpotifyDevice, SystemSnapshot } from '../types';

export function TopBar({
  section,
  snapshot,
  preferredDisplayId,
  onOpenPalette,
  unreadNotifications,
  notificationCenterOpen,
  onToggleNotifications,
  onHelp,
}: {
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
  const mediaMenuRef = useRef<HTMLDivElement>(null);
  const item = getNavigationItem(section);
  const detected = snapshot?.xreal.connection === 'display-detected';
  const manuallySelected = Boolean(
    preferredDisplayId && snapshot?.displays.some((display) => display.id === preferredDisplayId),
  );
  const connected = detected || manuallySelected;

  useEffect(() => {
    if (!mediaMenu) return;
    const close = (event: MouseEvent) => {
      if (!mediaMenuRef.current?.contains(event.target as Node)) setMediaMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMediaMenu(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [mediaMenu]);

  async function refreshSpotifyDevices() {
    setDevicesLoading(true);
    try {
      setSpotifyDevices(await platform.getSpotifyDevices());
    } catch (error) {
      media.updateStatus('spotify', {
        message: error instanceof Error ? error.message : 'Spotify devices could not be loaded.',
      });
    } finally {
      setDevicesLoading(false);
    }
  }

  useEffect(() => {
    if (mediaMenu === 'spotify') void refreshSpotifyDevices();
  }, [mediaMenu]);

  async function selectSpotifyDevice(deviceId: string) {
    try {
      const next = await platform.setSpotifyDevice(deviceId);
      media.updateStatus('spotify', {
        ready: true,
        active: next.available,
        playing: next.playing,
        title: next.title,
        detail: next.detail,
        volume: next.volume,
        artwork: next.artwork,
        deviceId: next.deviceId,
        deviceName: next.deviceName,
        message: next.message,
      });
      await refreshSpotifyDevices();
    } catch (error) {
      media.updateStatus('spotify', {
        message: error instanceof Error ? error.message : 'Spotify could not switch devices.',
      });
    }
  }

  function toggleMediaMenu(service: MediaService) {
    media.setActiveService(service);
    setMediaMenu((current) => current === service ? null : service);
  }

  const mediaStatus = mediaMenu ? media.status[mediaMenu] : null;

  return (
    <header className="topbar">
      <div className="topbar__title">
        <span>{item.label}</span>
        <small>{item.description}</small>
      </div>

      <button className="command-trigger" onClick={onOpenPalette}>
        <Search size={17} aria-hidden />
        <span>Search or run a command</span>
        <kbd>
          <Command size={12} aria-hidden />K
        </kbd>
      </button>

      <div className="topbar__actions">
        <div className="topbar-media" ref={mediaMenuRef}>
          {(['spotify', 'youtube'] as const).map((service) => (
            <button
              key={service}
              className="media-trigger"
              data-active={mediaMenu === service}
              onClick={() => toggleMediaMenu(service)}
              aria-label={`Open ${service === 'spotify' ? 'Spotify' : 'YouTube'} controls`}
              aria-expanded={mediaMenu === service}
            >
              <MediaBrandIcon service={service} width={21} height={21} />
            </button>
          ))}

          {mediaMenu && mediaStatus ? (
            <section className="media-popover" aria-label={`${mediaMenu === 'spotify' ? 'Spotify' : 'YouTube'} controls`}>
              <header>
                {mediaStatus.artwork ? (
                  <img src={mediaStatus.artwork} alt="" className="media-popover__artwork" />
                ) : (
                  <MediaBrandIcon service={mediaMenu} width={30} height={30} />
                )}
                <span>
                  <strong>{mediaStatus.title}</strong>
                  <small>{mediaStatus.ready ? mediaStatus.detail : 'Player is connecting…'}</small>
                </span>
              </header>
              <div className="media-popover__transport">
                <button onClick={() => media.run(mediaMenu, 'previous')} aria-label="Previous">
                  <SkipBack size={18} />
                </button>
                <button
                  className="media-popover__play"
                  onClick={() => media.run(mediaMenu, 'toggle')}
                  aria-label={mediaStatus.playing ? 'Pause' : 'Play'}
                >
                  {mediaStatus.playing ? <Pause size={19} /> : <Play size={19} />}
                </button>
                <button onClick={() => media.run(mediaMenu, 'next')} aria-label="Next">
                  <SkipForward size={18} />
                </button>
              </div>
              {mediaMenu === 'spotify' ? (
                <label className="media-popover__device">
                  <span>Playback device</span>
                  <select
                    aria-label="Spotify playback device"
                    value={mediaStatus.deviceId ?? spotifyDevices.find((device) => device.active)?.id ?? ''}
                    onChange={(event) => void selectSpotifyDevice(event.target.value)}
                    disabled={devicesLoading || spotifyDevices.length === 0}
                  >
                    <option value="">{devicesLoading ? 'Finding devices…' : spotifyDevices.length ? 'Choose a device' : 'No devices found'}</option>
                    {spotifyDevices.map((device) => (
                      <option key={device.id} value={device.id} disabled={device.restricted}>
                        {device.name} · {device.type}{device.active ? ' (active)' : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void refreshSpotifyDevices()} disabled={devicesLoading}>Refresh</button>
                </label>
              ) : null}
              <label className="media-popover__volume">
                <Volume1 size={16} aria-hidden />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={mediaStatus.volume}
                  onChange={(event) => media.run(mediaMenu, 'volume', Number(event.target.value))}
                  aria-label={`${mediaMenu === 'spotify' ? 'Spotify' : 'YouTube'} volume`}
                />
                <Volume2 size={16} aria-hidden />
                <span>{mediaStatus.volume}%</span>
              </label>
              {mediaStatus.message ? <p>{mediaStatus.message}</p> : null}
            </section>
          ) : null}
        </div>
        <span className="device-indicator" data-connected={connected}>
          <span aria-hidden />
          {snapshot?.xreal.simulated ? 'One Pro simulated' : connected ? 'Display ready' : 'No XREAL display'}
        </span>
        <button
          className="icon-button notification-button"
          data-active={notificationCenterOpen}
          onClick={onToggleNotifications}
          aria-label={`Open notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
        >
          <Bell size={18} />
          {unreadNotifications ? <span>{Math.min(unreadNotifications, 9)}</span> : null}
        </button>
        <button className="icon-button" onClick={onHelp} aria-label="Open setup help">
          <CircleHelp size={19} />
        </button>
      </div>
    </header>
  );
}
