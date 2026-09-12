import { type CSSProperties, useState } from 'react';
import {
  ArrowUpRight,
  Gamepad2,
  Link2,
  Maximize2,
  MonitorPlay,
  Music2,
  Radio,
  Sparkles,
  Tv,
  Volume2,
} from 'lucide-react';
import { MediaBrandIcon, type MediaService } from '../components/MediaBrandIcon';
import {
  DEFAULT_SPOTIFY_SOURCE,
  DEFAULT_YOUTUBE_SOURCE,
  isSpotifySource,
  parseYouTubeSource,
  SpotifyPlayer,
  YouTubePlayer,
} from '../components/MediaPlayers';
import { Button, SectionHeading, StatusPill, Toggle } from '../components/ui';
import { platform } from '../services/platform';
import { useHub } from '../state/HubContext';
import { useMedia } from '../state/MediaContext';
import type { SystemSnapshot } from '../types';

const EXTERNAL_SERVICES = [
  { name: 'Netflix', type: 'Streaming', url: 'https://www.netflix.com', monogram: 'N', color: '#e74752' },
  { name: 'Prime Video', type: 'Streaming', url: 'https://www.primevideo.com', monogram: 'P', color: '#52bff8' },
  { name: 'Disney+', type: 'Streaming', url: 'https://www.disneyplus.com', monogram: 'D+', color: '#7785ff' },
  { name: 'Plex', type: 'Personal media', url: 'https://app.plex.tv', monogram: 'PX', color: '#e5b84b' },
];

function savedSource(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveSource(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Playback still works when storage is unavailable; only persistence is skipped.
  }
}

export function Entertainment({
  snapshot,
  onToast,
}: {
  snapshot: SystemSnapshot | null;
  onToast(message: string, detail?: string): void;
}) {
  const { state, recordActivity } = useHub();
  const { activeService, setActiveService, status } = useMedia();
  const [theatre, setTheatre] = useState(false);
  const [spatialAudio, setSpatialAudio] = useState(false);
  const [spotifySource, setSpotifySource] = useState(() => {
    const saved = savedSource('xreal-win-hub:spotify-source', DEFAULT_SPOTIFY_SOURCE);
    return isSpotifySource(saved) ? saved : DEFAULT_SPOTIFY_SOURCE;
  });
  const [youtubeSource, setYouTubeSource] = useState(() => {
    const saved = savedSource('xreal-win-hub:youtube-source', DEFAULT_YOUTUBE_SOURCE);
    return parseYouTubeSource(saved) ? saved : DEFAULT_YOUTUBE_SOURCE;
  });
  const [sourceDraft, setSourceDraft] = useState(() => spotifySource);
  const selectedDisplay = snapshot?.displays.find(
    (display) => display.id === state.settings.preferredDisplayId,
  );

  async function toggleTheatre(enabled: boolean) {
    try {
      const ok = await platform.setTheatreMode(enabled, state.settings.preferredDisplayId);
      if (ok) {
        setTheatre(enabled);
        recordActivity({
          kind: 'device',
          title: enabled ? 'Theatre mode started' : 'Theatre mode ended',
          detail: enabled
            ? `Using ${selectedDisplay?.label ?? 'the current display'}.`
            : 'The hub returned to windowed mode.',
        });
      } else {
        onToast('Theatre mode needs the Windows app', 'Use the packaged app to control its window.');
      }
    } catch {
      onToast('Theatre mode was unavailable', 'Try the packaged Windows app.');
    }
  }

  function selectService(service: MediaService) {
    setActiveService(service);
    setSourceDraft(service === 'spotify' ? spotifySource : youtubeSource);
  }

  function loadSource() {
    const source = sourceDraft.trim();
    const valid = activeService === 'spotify'
      ? isSpotifySource(source)
      : Boolean(parseYouTubeSource(source));
    if (!valid) {
      onToast(
        `That ${activeService === 'spotify' ? 'Spotify' : 'YouTube'} link is not supported`,
        activeService === 'spotify'
          ? 'Paste a Spotify track, album, playlist, show, episode, or artist link.'
          : 'Paste a YouTube video, Short, or playlist link.',
      );
      return;
    }
    if (activeService === 'spotify') {
      setSpotifySource(source);
      saveSource('xreal-win-hub:spotify-source', source);
    } else {
      setYouTubeSource(source);
      saveSource('xreal-win-hub:youtube-source', source);
    }
    recordActivity({
      kind: 'workspace',
      title: `${activeService === 'spotify' ? 'Spotify' : 'YouTube'} loaded in Hub`,
      detail: 'The media player stayed inside Entertainment.',
    });
    onToast(`${activeService === 'spotify' ? 'Spotify' : 'YouTube'} loaded in Hub`);
  }

  async function openExternal(service: (typeof EXTERNAL_SERVICES)[number]) {
    try {
      const opened = await platform.openExternal(service.url);
      if (opened) {
        recordActivity({
          kind: 'workspace',
          title: `Opened ${service.name}`,
          detail: 'Launched securely in your default browser.',
        });
        onToast(`${service.name} opened`, 'Using your default browser for protected playback.');
      } else {
        onToast(`Could not open ${service.name}`, 'Your browser may have blocked the new window.');
      }
    } catch {
      onToast(`Could not open ${service.name}`, 'Check that your default browser is available.');
    }
  }

  return (
    <div className="module-page entertainment-page">
      <SectionHeading
        eyebrow="Lean back"
        title="Entertainment"
        description="Keep Spotify and YouTube playback inside the Hub, with controls available from every page."
        actions={
          <Button variant="primary" onClick={() => void toggleTheatre(!theatre)}>
            <Maximize2 size={17} /> {theatre ? 'Exit theatre' : 'Enter theatre'}
          </Button>
        }
      />

      <section className="media-hub card-surface">
        <header className="media-hub__header">
          <div className="media-service-picker">
            <MediaBrandIcon service={activeService} width={25} height={25} />
            <label htmlFor="media-service">Player</label>
            <select
              id="media-service"
              aria-label="Entertainment service"
              value={activeService}
              onChange={(event) => selectService(event.target.value as MediaService)}
            >
              <option value="spotify">Spotify</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          <StatusPill tone={status[activeService].ready ? 'positive' : 'neutral'}>
            {status[activeService].ready ? 'Player ready' : 'Connecting'}
          </StatusPill>
        </header>

        <div className="media-hub__source">
          <Link2 size={16} aria-hidden />
          <input
            aria-label={`${activeService === 'spotify' ? 'Spotify' : 'YouTube'} link`}
            value={sourceDraft}
            onChange={(event) => setSourceDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') loadSource();
            }}
            placeholder={activeService === 'spotify' ? 'Paste a Spotify link' : 'Paste a YouTube link'}
          />
          <Button onClick={loadSource}>Load in Hub</Button>
        </div>

        <div className="media-hub__stage" data-service={activeService}>
          <div hidden={activeService !== 'spotify'}>
            <SpotifyPlayer source={spotifySource} />
          </div>
          <div hidden={activeService !== 'youtube'}>
            <YouTubePlayer source={youtubeSource} />
          </div>
        </div>

        <footer className="media-hub__footer">
          <span><Sparkles size={15} /> Playback stays mounted when you move around the Hub.</span>
          <small>
            {activeService === 'spotify'
              ? 'Spotify skip and volume use Windows media controls; play/pause uses the official embed.'
              : 'YouTube video, playlist, skip, play/pause, and volume use the official player API.'}
          </small>
        </footer>
      </section>

      <section className="content-section">
        <div className="section-row-heading">
          <div><span className="eyebrow">Your services</span><h2>Choose what plays in the Hub</h2></div>
          <span className="subtle-copy">Spotify and YouTube stay in-app</span>
        </div>
        <div className="service-grid">
          {(['spotify', 'youtube'] as const).map((service) => (
            <button
              className="service-card service-card--integrated"
              key={service}
              onClick={() => selectService(service)}
              style={{ '--service-color': service === 'spotify' ? '#43d989' : '#ff5f68' } as CSSProperties}
            >
              <span className="service-card__brand"><MediaBrandIcon service={service} width={28} height={28} /></span>
              <span className="service-card__copy">
                <strong>{service === 'spotify' ? 'Spotify' : 'YouTube'}</strong>
                <small>Integrated player</small>
              </span>
              <span className="service-card__in-app">In Hub</span>
            </button>
          ))}
          {EXTERNAL_SERVICES.map((service) => (
            <button
              className="service-card"
              key={service.name}
              onClick={() => void openExternal(service)}
              style={{ '--service-color': service.color } as CSSProperties}
            >
              <span className="service-card__monogram">{service.monogram}</span>
              <span className="service-card__copy"><strong>{service.name}</strong><small>{service.type}</small></span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      </section>

      <section className="content-section media-tools">
        <div className="section-row-heading">
          <div><span className="eyebrow">Playback setup</span><h2>Before you settle in</h2></div>
        </div>
        <div className="media-tool-grid">
          <article className="setting-card">
            <span className="setting-card__icon"><Tv size={20} /></span>
            <div><strong>Theatre mode</strong><small>Full-screen the hub on the chosen display.</small></div>
            <Toggle checked={theatre} onChange={(value) => void toggleTheatre(value)} label="Theatre mode" />
          </article>
          <article className="setting-card">
            <span className="setting-card__icon"><Music2 size={20} /></span>
            <div><strong>Spatial-audio reminder</strong><small>Show the audio routing cue before playback.</small></div>
            <Toggle checked={spatialAudio} onChange={setSpatialAudio} label="Spatial audio reminder" />
          </article>
          <article className="setting-card setting-card--static">
            <span className="setting-card__icon"><MonitorPlay size={20} /></span>
            <div><strong>Playback display</strong><small>{selectedDisplay?.label ?? 'Current display'}</small></div>
            <StatusPill tone="info"><Volume2 size={12} /> Windows audio</StatusPill>
          </article>
          <article className="setting-card setting-card--static">
            <span className="setting-card__icon"><Gamepad2 size={20} /></span>
            <div><strong>Protected services</strong><small>Netflix and similar DRM services continue in your browser.</small></div>
            <StatusPill tone="positive"><Radio size={12} /> Safe launch</StatusPill>
          </article>
        </div>
      </section>
    </div>
  );
}
