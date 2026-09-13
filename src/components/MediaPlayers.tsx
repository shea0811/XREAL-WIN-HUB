import { useEffect, useMemo, useRef } from 'react';
import { platform } from '../services/platform';
import { useMedia } from '../state/MediaContext';

export const DEFAULT_SPOTIFY_SOURCE = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
export const DEFAULT_YOUTUBE_SOURCE = 'https://www.youtube.com/watch?v=M7lc1UVf-VE';

export function isSpotifySource(value: string) {
  const source = value.trim();
  if (/^spotify:(track|album|playlist|show|episode|artist):[A-Za-z0-9]+$/i.test(source)) return true;
  try {
    const url = new URL(source);
    return url.protocol === 'https:'
      && url.hostname === 'open.spotify.com'
      && /^\/(track|album|playlist|show|episode|artist)\/[A-Za-z0-9]+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function parseYouTubeSource(value: string): { videoId?: string; playlistId?: string } | null {
  try {
    const url = new URL(value.trim());
    if (![
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'music.youtube.com',
      'www.youtube-nocookie.com',
      'youtu.be',
    ].includes(url.hostname)) return null;
    const playlistId = url.searchParams.get('list') ?? undefined;
    let videoId = url.hostname === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.searchParams.get('v') ?? undefined;
    if (!videoId && /^\/(shorts|embed)\//.test(url.pathname)) {
      videoId = url.pathname.split('/').filter(Boolean)[1];
    }
    if (videoId && !/^[\w-]{6,20}$/.test(videoId)) videoId = undefined;
    if (playlistId && !/^[\w-]{6,80}$/.test(playlistId)) return videoId ? { videoId } : null;
    return videoId || playlistId ? { videoId, playlistId } : null;
  } catch {
    return null;
  }
}

function spotifyEmbedUrl(source: string) {
  const uri = source.trim();
  const uriMatch = /^spotify:(track|album|playlist|show|episode|artist):([A-Za-z0-9]+)$/i.exec(uri);
  if (uriMatch) return `https://open.spotify.com/embed/${uriMatch[1].toLowerCase()}/${uriMatch[2]}?utm_source=generator&theme=0`;
  try {
    const url = new URL(uri);
    const match = /^\/(track|album|playlist|show|episode|artist)\/([A-Za-z0-9]+)\/?$/i.exec(url.pathname);
    if (url.hostname === 'open.spotify.com' && match) {
      return `https://open.spotify.com/embed/${match[1].toLowerCase()}/${match[2]}?utm_source=generator&theme=0`;
    }
  } catch {
    // The validated fallback below is safe.
  }
  return 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0';
}

function youtubeEmbedUrl(source: string) {
  const parsed = parseYouTubeSource(source);
  const parameters = new URLSearchParams({ enablejsapi: '1', playsinline: '1', rel: '0' });
  if (parsed?.playlistId) parameters.set('list', parsed.playlistId);
  return parsed?.playlistId && !parsed.videoId
    ? `https://www.youtube-nocookie.com/embed/videoseries?${parameters}`
    : `https://www.youtube-nocookie.com/embed/${parsed?.videoId ?? 'M7lc1UVf-VE'}?${parameters}`;
}

function SpotifyFrame({ source }: { source: string }) {
  const src = useMemo(() => spotifyEmbedUrl(source), [source]);
  return (
    <div className="embedded-player embedded-player--spotify" aria-label="Spotify player">
      <iframe
        key={src}
        src={src}
        title="Spotify player"
        height="352"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

export function SpotifyPlayer({ source }: { source: string }) {
  const volumeRef = useRef(50);
  const { registerController, updateStatus } = useMedia();

  useEffect(() => {
    updateStatus('spotify', {
      ready: true,
      active: true,
      title: source.includes('/track/') || source.startsWith('spotify:track:') ? 'Spotify track' : 'Spotify collection',
      detail: 'Secure Spotify embed',
      volumeMode: 'system',
      message: undefined,
    });
    const unavailable = () => updateStatus('spotify', { message: 'Connect Spotify Premium for exact playback controls.' });
    return registerController('spotify', {
      previous: async () => { if (!await platform.sendMediaKey('previous')) unavailable(); },
      toggle: async () => { if (!await platform.sendMediaKey('toggle')) unavailable(); },
      next: async () => { if (!await platform.sendMediaKey('next')) unavailable(); },
      setVolume: async (value) => {
        const command = value >= volumeRef.current ? 'volume-up' : 'volume-down';
        if (!await platform.sendMediaKey(command)) unavailable();
        volumeRef.current = value;
        updateStatus('spotify', { volume: value });
      },
    });
  }, [registerController, source, updateStatus]);

  return <SpotifyFrame source={source} />;
}

export function SpotifyPremiumPlayer({
  source,
  requestVersion,
}: {
  source: string;
  requestVersion: number;
}) {
  const { registerController, updateStatus } = useMedia();
  const lastRequest = useRef(0);

  useEffect(() => {
    let active = true;
    const apply = (state: Awaited<ReturnType<typeof platform.getSpotifyPlaybackStatus>>) => {
      if (!active) return;
      updateStatus('spotify', {
        ready: true,
        active: state.available,
        playing: state.playing,
        title: state.title,
        detail: state.detail,
        volume: state.volume,
        volumeMode: 'player',
        artwork: state.artwork,
        message: state.message,
      });
    };
    const refresh = async () => apply(await platform.getSpotifyPlaybackStatus());
    const run = async (command: 'previous' | 'toggle' | 'next' | 'volume', value?: number) =>
      apply(await platform.controlSpotify(command, value));
    const unregister = registerController('spotify', {
      previous: () => run('previous'),
      toggle: () => run('toggle'),
      next: () => run('next'),
      setVolume: (value) => run('volume', value),
    });
    void refresh().catch(() => updateStatus('spotify', { ready: false, message: 'Spotify playback status is unavailable.' }));
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      unregister();
    };
  }, [registerController, updateStatus]);

  useEffect(() => {
    if (!requestVersion || requestVersion === lastRequest.current || !isSpotifySource(source)) return;
    lastRequest.current = requestVersion;
    void platform.playSpotifySource(source)
      .then((played) => {
        if (!played) throw new Error('Spotify did not accept the playback request.');
        updateStatus('spotify', { message: undefined });
      })
      .catch((error) => updateStatus('spotify', {
        message: error instanceof Error ? error.message : 'Spotify could not play that link.',
      }));
  }, [requestVersion, source, updateStatus]);

  return <SpotifyFrame source={source} />;
}

export function YouTubePlayer({ source }: { source: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const playingRef = useRef(false);
  const { registerController, updateStatus } = useMedia();
  const src = useMemo(() => youtubeEmbedUrl(source), [source]);

  useEffect(() => {
    const command = (func: string, args: unknown[] = []) => {
      frameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        'https://www.youtube-nocookie.com',
      );
    };
    return registerController('youtube', {
      previous: () => command('previousVideo'),
      toggle: () => {
        playingRef.current = !playingRef.current;
        command(playingRef.current ? 'playVideo' : 'pauseVideo');
        updateStatus('youtube', { playing: playingRef.current });
      },
      next: () => command('nextVideo'),
      setVolume: (value) => {
        command('setVolume', [value]);
        updateStatus('youtube', { volume: value });
      },
    });
  }, [registerController, updateStatus]);

  useEffect(() => {
    playingRef.current = false;
    updateStatus('youtube', {
      ready: true,
      active: true,
      playing: false,
      title: 'YouTube',
      detail: parseYouTubeSource(source)?.playlistId ? 'YouTube playlist in Hub' : 'YouTube video in Hub',
      message: undefined,
    });
  }, [source, updateStatus]);

  return (
    <div className="embedded-player embedded-player--youtube" aria-label="YouTube player">
      <iframe
        ref={frameRef}
        key={src}
        src={src}
        title="YouTube player"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
