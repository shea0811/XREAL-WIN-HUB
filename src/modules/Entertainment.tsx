import { type CSSProperties, useState } from 'react';
import {
  ArrowUpRight,
  Gamepad2,
  Maximize2,
  MonitorPlay,
  Music2,
  Radio,
  Sparkles,
  Tv,
  Volume2,
} from 'lucide-react';
import { MediaBrandIcon, type MediaService } from '../components/MediaBrandIcon';
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

export function Entertainment({
  snapshot,
  onToast,
  onOpenMedia,
}: {
  snapshot: SystemSnapshot | null;
  onToast(message: string, detail?: string): void;
  onOpenMedia(service: MediaService): void;
}) {
  const { state, recordActivity } = useHub();
  const { enableService } = useMedia();
  const [theatre, setTheatre] = useState(false);
  const [spatialAudio, setSpatialAudio] = useState(false);
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

  function openIntegratedService(service: MediaService) {
    enableService(service);
    onOpenMedia(service);
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
        description="Launch persistent Spotify and YouTube pages, or open protected streaming services safely."
        actions={
          <Button variant="primary" onClick={() => void toggleTheatre(!theatre)}>
            <Maximize2 size={17} /> {theatre ? 'Exit theatre' : 'Enter theatre'}
          </Button>
        }
      />

      <section className="entertainment-launch card-surface">
        <div>
          <StatusPill tone="positive"><Sparkles size={12} /> Persistent players</StatusPill>
          <h2>Choose a service to add its page.</h2>
          <p>
            Spotify or YouTube appears directly beneath Entertainment in the navigation while it is in use.
            Playback and the top-bar controls stay available as you move around the Hub.
          </p>
        </div>
        <div className="entertainment-launch__brands" aria-hidden>
          <MediaBrandIcon service="spotify" width={64} height={64} />
          <MediaBrandIcon service="youtube" width={64} height={64} />
        </div>
      </section>

      <section className="content-section">
        <div className="section-row-heading">
          <div><span className="eyebrow">Your services</span><h2>Choose what plays in the Hub</h2></div>
          <span className="subtle-copy">Spotify and YouTube get dedicated pages</span>
        </div>
        <div className="service-grid">
          {(['spotify', 'youtube'] as const).map((service) => (
            <button
              className="service-card service-card--integrated"
              key={service}
              onClick={() => openIntegratedService(service)}
              style={{ '--service-color': service === 'spotify' ? '#43d989' : '#ff5f68' } as CSSProperties}
            >
              <span className="service-card__brand"><MediaBrandIcon service={service} width={28} height={28} /></span>
              <span className="service-card__copy">
                <strong>{service === 'spotify' ? 'Spotify Premium' : 'YouTube'}</strong>
                <small>Open dedicated player</small>
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
