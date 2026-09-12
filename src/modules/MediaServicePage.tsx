import { useEffect, useState } from 'react';
import { ExternalLink, Link2, LoaderCircle, LogIn, LogOut, ShieldCheck, Volume2 } from 'lucide-react';
import { MediaBrandIcon, type MediaService } from '../components/MediaBrandIcon';
import {
  isSpotifySource,
  parseYouTubeSource,
  SpotifyPlayer,
  SpotifyPremiumPlayer,
  YouTubePlayer,
} from '../components/MediaPlayers';
import { Button, SectionHeading, StatusPill } from '../components/ui';
import { platform } from '../services/platform';
import { useMedia } from '../state/MediaContext';
import type { SpotifyAuthStatus } from '../types';

export function MediaServicePage({
  service,
  onToast,
}: {
  service: MediaService;
  onToast(message: string, detail?: string): void;
}) {
  const media = useMedia();
  const playerStatus = media.status[service];
  const [sourceDraft, setSourceDraft] = useState(media.sources[service]);
  const [authStatus, setAuthStatus] = useState<SpotifyAuthStatus | null>(null);
  const [clientId, setClientId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const isSpotify = service === 'spotify';

  useEffect(() => setSourceDraft(media.sources[service]), [media.sources, service]);

  useEffect(() => {
    if (!isSpotify) return;
    let active = true;
    void platform.getSpotifyAuthStatus().then((value) => {
      if (!active) return;
      setAuthStatus(value);
      setClientId(value.clientId ?? '');
    });
    return () => { active = false; };
  }, [isSpotify]);

  function loadSource() {
    const source = sourceDraft.trim();
    const valid = isSpotify ? isSpotifySource(source) : Boolean(parseYouTubeSource(source));
    if (!valid) {
      onToast(
        `${isSpotify ? 'Spotify' : 'YouTube'} link not recognised`,
        isSpotify
          ? 'Paste a Spotify track, album, playlist, show, episode, or artist link.'
          : 'Paste a YouTube video, Short, Music, or playlist link.',
      );
      return;
    }
    media.setSource(service, source);
    onToast(`${isSpotify ? 'Spotify' : 'YouTube'} loaded`, 'The player is preparing it inside the Hub.');
  }

  async function connectSpotify() {
    setConnecting(true);
    try {
      const value = await platform.connectSpotify(clientId);
      setAuthStatus(value);
      onToast('Spotify Premium connected', value.accountName ?? undefined);
    } catch (error) {
      onToast('Spotify connection failed', error instanceof Error ? error.message : 'Try the sign-in again.');
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectSpotify() {
    const value = await platform.disconnectSpotify();
    setAuthStatus(value);
    onToast('Spotify disconnected');
  }

  const premiumConnected = Boolean(authStatus?.connected);

  return (
    <div className="module-page media-service-page" data-service={service}>
      <SectionHeading
        eyebrow="In-Hub player"
        title={isSpotify ? 'Spotify' : 'YouTube'}
        description={isSpotify
          ? 'Your Premium player, queue controls, volume, and now-playing information in one place.'
          : 'Videos and playlists stay inside XREAL WIN HUB with persistent playback controls.'}
        actions={
          <StatusPill tone={playerStatus.ready ? 'positive' : 'neutral'}>
            {playerStatus.ready ? 'Player ready' : 'Preparing player'}
          </StatusPill>
        }
      />

      {isSpotify && !premiumConnected ? (
        <section className="spotify-connect card-surface">
          <div className="spotify-connect__copy">
            <MediaBrandIcon service="spotify" width={48} height={48} />
            <div>
              <span className="eyebrow">Spotify Premium</span>
              <h2>Connect direct playback</h2>
              <p>
                Create a Spotify Developer app, add <code>{authStatus?.redirectUri ?? 'http://127.0.0.1/callback'}</code>
                {' '}as its redirect URI, then paste its Client ID below. Sign-in opens Spotify’s own authorization page.
              </p>
            </div>
          </div>
          <div className="spotify-connect__form">
            <input
              aria-label="Spotify Client ID"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder="Spotify Developer Client ID"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              variant="primary"
              busy={connecting}
              disabled={!authStatus?.supported || !clientId.trim()}
              onClick={() => void connectSpotify()}
            >
              <LogIn size={16} /> Connect Spotify
            </Button>
            <Button onClick={() => void platform.openExternal('https://developer.spotify.com/dashboard')}>
              <ExternalLink size={15} /> Developer dashboard
            </Button>
          </div>
          <small className="spotify-connect__note">
            <ShieldCheck size={14} /> Tokens are encrypted by Windows and never committed to the repository.
          </small>
          {authStatus?.message ? <p className="media-inline-message">{authStatus.message}</p> : null}
        </section>
      ) : null}

      {isSpotify && premiumConnected ? (
        <div className="spotify-account-row">
          <span><ShieldCheck size={15} /> {authStatus?.accountName ?? 'Spotify account'} · {authStatus?.product ?? 'Premium'}</span>
          <Button variant="ghost" onClick={() => void disconnectSpotify()}><LogOut size={15} /> Disconnect</Button>
        </div>
      ) : null}

      <section className="media-now-playing card-surface">
        <div className="media-now-playing__art">
          {playerStatus.artwork ? (
            <img src={playerStatus.artwork} alt="" />
          ) : (
            <MediaBrandIcon service={service} width={72} height={72} />
          )}
        </div>
        <div className="media-now-playing__copy">
          <span className="eyebrow">Now playing</span>
          <h2>{playerStatus.title}</h2>
          <p>{playerStatus.detail}</p>
          <span className="media-state-line">
            {playerStatus.ready ? <Volume2 size={15} /> : <LoaderCircle size={15} className="spin" />}
            {playerStatus.playing ? 'Playing' : playerStatus.ready ? 'Paused or ready' : 'Connecting'}
          </span>
        </div>
      </section>

      <section className="media-link-loader card-surface">
        <Link2 size={17} aria-hidden />
        <input
          aria-label={`${isSpotify ? 'Spotify' : 'YouTube'} link`}
          value={sourceDraft}
          onChange={(event) => setSourceDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') loadSource(); }}
          placeholder={isSpotify ? 'Paste a Spotify link' : 'Paste a YouTube link'}
        />
        <Button variant="primary" onClick={loadSource}>Load in Hub</Button>
      </section>

      {playerStatus.message ? <p className="media-inline-message">{playerStatus.message}</p> : null}

      <section className="media-player-surface card-surface">
        {isSpotify ? (
          premiumConnected ? (
            <SpotifyPremiumPlayer source={media.sources.spotify} requestVersion={media.requestVersion.spotify} />
          ) : (
            <SpotifyPlayer source={media.sources.spotify} />
          )
        ) : (
          <YouTubePlayer source={media.sources.youtube} />
        )}
      </section>
    </div>
  );
}
