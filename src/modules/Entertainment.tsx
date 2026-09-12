import { type CSSProperties, useState } from 'react';
import {
  ArrowUpRight,
  Clapperboard,
  Gamepad2,
  Maximize2,
  MonitorPlay,
  Music2,
  Radio,
  Sparkles,
  Tv,
  Volume2,
} from 'lucide-react';
import { Button, SectionHeading, StatusPill, Toggle } from '../components/ui';
import { platform } from '../services/platform';
import { useHub } from '../state/HubContext';
import type { SystemSnapshot } from '../types';

const SERVICES = [
  {
    name: 'YouTube',
    type: 'Video',
    url: 'https://www.youtube.com',
    monogram: 'YT',
    color: '#ff5f68',
  },
  {
    name: 'Netflix',
    type: 'Streaming',
    url: 'https://www.netflix.com',
    monogram: 'N',
    color: '#e74752',
  },
  {
    name: 'Prime Video',
    type: 'Streaming',
    url: 'https://www.primevideo.com',
    monogram: 'P',
    color: '#52bff8',
  },
  {
    name: 'Disney+',
    type: 'Streaming',
    url: 'https://www.disneyplus.com',
    monogram: 'D+',
    color: '#7785ff',
  },
  {
    name: 'Spotify',
    type: 'Music',
    url: 'https://open.spotify.com',
    monogram: 'S',
    color: '#43d989',
  },
  {
    name: 'Plex',
    type: 'Personal media',
    url: 'https://app.plex.tv',
    monogram: 'PX',
    color: '#e5b84b',
  },
];

export function Entertainment({
  snapshot,
  onToast,
}: {
  snapshot: SystemSnapshot | null;
  onToast(message: string, detail?: string): void;
}) {
  const { state, recordActivity } = useHub();
  const [theatre, setTheatre] = useState(false);
  const [spatialAudio, setSpatialAudio] = useState(false);
  const selectedDisplay = snapshot?.displays.find(
    (display) => display.id === state.settings.preferredDisplayId,
  );

  async function toggleTheatre(enabled: boolean) {
    try {
      const ok = await platform.setTheatreMode(
        enabled,
        state.settings.preferredDisplayId,
      );
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

  async function openService(service: (typeof SERVICES)[number]) {
    try {
      const opened = await platform.openExternal(service.url);
      if (opened) {
        recordActivity({
          kind: 'workspace',
          title: `Opened ${service.name}`,
          detail: 'Launched securely in your default browser.',
        });
        onToast(`${service.name} opened`, 'Using your default browser for DRM compatibility.');
      } else {
        onToast(`Could not open ${service.name}`, 'Your browser may have blocked the new window.');
      }
    } catch {
      onToast(`Could not open ${service.name}`, 'Check that your default browser is available.');
    }
  }

  return (
    <div className="module-page">
      <SectionHeading
        eyebrow="Lean back"
        title="Entertainment"
        description="A distraction-free launch deck designed for the XREAL display."
        actions={
          <Button variant="primary" onClick={() => void toggleTheatre(!theatre)}>
            <Maximize2 size={17} /> {theatre ? 'Exit theatre' : 'Enter theatre'}
          </Button>
        }
      />

      <section className="cinema-banner">
        <div className="cinema-banner__orb" aria-hidden />
        <div className="cinema-banner__copy">
          <StatusPill tone={selectedDisplay ? 'positive' : 'neutral'}>
            {selectedDisplay ? 'Display selected' : 'Uses current display'}
          </StatusPill>
          <span className="card-kicker">Cinema launch mode</span>
          <h2>Big-screen mode without the clutter.</h2>
          <p>
            Move the hub to your preferred display, go full screen, then launch streaming
            services in the browser where protected video playback works best.
          </p>
          <div className="cinema-banner__meta">
            <span>
              <MonitorPlay size={17} /> {selectedDisplay?.label ?? 'Current display'}
            </span>
            <span>
              <Volume2 size={17} /> Windows audio output
            </span>
          </div>
        </div>
        <div className="cinema-screen" aria-hidden>
          <span className="cinema-screen__frame">
            <Clapperboard size={42} />
            <i />
          </span>
          <span className="cinema-screen__stand" />
        </div>
      </section>

      <section className="content-section">
        <div className="section-row-heading">
          <div>
            <span className="eyebrow">Your services</span>
            <h2>What do you want to watch?</h2>
          </div>
          <span className="subtle-copy">Opens in your default browser</span>
        </div>
        <div className="service-grid">
          {SERVICES.map((service) => (
            <button
              className="service-card"
              key={service.name}
              onClick={() => void openService(service)}
              style={{ '--service-color': service.color } as CSSProperties}
            >
              <span className="service-card__monogram">{service.monogram}</span>
              <span className="service-card__copy">
                <strong>{service.name}</strong>
                <small>{service.type}</small>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      </section>

      <section className="content-section media-tools">
        <div className="section-row-heading">
          <div>
            <span className="eyebrow">Playback setup</span>
            <h2>Before you settle in</h2>
          </div>
        </div>
        <div className="media-tool-grid">
          <article className="setting-card">
            <span className="setting-card__icon"><Tv size={20} /></span>
            <div>
              <strong>Theatre mode</strong>
              <small>Full-screen the hub on the chosen display.</small>
            </div>
            <Toggle checked={theatre} onChange={(value) => void toggleTheatre(value)} label="Theatre mode" />
          </article>
          <article className="setting-card">
            <span className="setting-card__icon"><Music2 size={20} /></span>
            <div>
              <strong>Spatial-audio reminder</strong>
              <small>Show the audio routing cue before playback.</small>
            </div>
            <Toggle checked={spatialAudio} onChange={setSpatialAudio} label="Spatial audio reminder" />
          </article>
          <article className="setting-card setting-card--static">
            <span className="setting-card__icon"><Gamepad2 size={20} /></span>
            <div>
              <strong>Game mode</strong>
              <small>Use the console or Windows display output directly.</small>
            </div>
            <StatusPill tone="info">Guide</StatusPill>
          </article>
          <article className="setting-card setting-card--static">
            <span className="setting-card__icon"><Radio size={20} /></span>
            <div>
              <strong>Protected playback</strong>
              <small>Streaming stays outside Electron for DRM support.</small>
            </div>
            <StatusPill tone="positive"><Sparkles size={12} /> Ready</StatusPill>
          </article>
        </div>
      </section>
    </div>
  );
}
