import { useEffect, useRef } from 'react';
import { platform } from '../services/platform';
import { useMedia } from '../state/MediaContext';

export const DEFAULT_SPOTIFY_SOURCE = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
export const DEFAULT_YOUTUBE_SOURCE = 'https://www.youtube.com/watch?v=M7lc1UVf-VE';

interface SpotifyEmbedController {
  addListener(event: string, callback: (event: { data?: Record<string, unknown> }) => void): void;
  destroy(): void;
  loadEntity(source: string): void;
  togglePlay(): void;
}

interface SpotifyIframeApi {
  createController(
    element: HTMLElement,
    options: { uri: string; width: string; height: number },
    callback: (controller: SpotifyEmbedController) => void,
  ): void;
}

interface YouTubePlayer {
  destroy(): void;
  cuePlaylist(options: { list: string; listType: 'playlist'; index: number }): void;
  cueVideoById(videoId: string): void;
  getPlayerState(): number;
  getVideoData(): { author?: string; title?: string; video_id?: string };
  getVolume(): number;
  nextVideo(): void;
  pauseVideo(): void;
  playVideo(): void;
  previousVideo(): void;
  setVolume(value: number): void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, number>;
      events: {
        onReady(event: { target: YouTubePlayer }): void;
        onStateChange(event: { data: number; target: YouTubePlayer }): void;
        onError(event: { data: number }): void;
      };
    },
  ) => YouTubePlayer;
}

interface SpotifyPlaybackTrack {
  name: string;
  uri: string;
  artists: Array<{ name: string }>;
  album: { images: Array<{ url: string }> };
}

interface SpotifyPlaybackState {
  paused: boolean;
  track_window: { current_track: SpotifyPlaybackTrack };
}

interface SpotifySdkPlayer {
  addListener(event: string, callback: (...args: any[]) => void): boolean;
  activateElement(): Promise<void>;
  connect(): Promise<boolean>;
  disconnect(): void;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  setVolume(value: number): Promise<void>;
  togglePlay(): Promise<void>;
}

interface SpotifySdk {
  Player: new (options: {
    name: string;
    getOAuthToken(callback: (token: string) => void): void;
    volume: number;
  }) => SpotifySdkPlayer;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
    onYouTubeIframeAPIReady?: () => void;
    YT?: YouTubeApi;
    Spotify?: SpotifySdk;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

let spotifyApiPromise: Promise<SpotifyIframeApi> | null = null;
let youtubeApiPromise: Promise<YouTubeApi> | null = null;
let spotifySdkPromise: Promise<SpotifySdk> | null = null;

function loadSpotifyApi() {
  if (!spotifyApiPromise) {
    spotifyApiPromise = new Promise((resolve, reject) => {
      window.onSpotifyIframeApiReady = resolve;
      const existing = document.querySelector<HTMLScriptElement>('script[data-media-api="spotify"]');
      if (existing) return;
      const script = document.createElement('script');
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      script.dataset.mediaApi = 'spotify';
      script.onerror = () => reject(new Error('Spotify embed API failed to load.'));
      document.head.append(script);
    });
  }
  return spotifyApiPromise;
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve, reject) => {
      window.onYouTubeIframeAPIReady = () => {
        if (window.YT) resolve(window.YT);
        else reject(new Error('YouTube API was not available.'));
      };
      const existing = document.querySelector<HTMLScriptElement>('script[data-media-api="youtube"]');
      if (existing) return;
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.mediaApi = 'youtube';
      script.onerror = () => reject(new Error('YouTube player API failed to load.'));
      document.head.append(script);
    });
  }
  return youtubeApiPromise;
}

function loadSpotifySdk() {
  if (window.Spotify?.Player) return Promise.resolve(window.Spotify);
  if (!spotifySdkPromise) {
    spotifySdkPromise = new Promise((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = () => {
        if (window.Spotify) resolve(window.Spotify);
        else reject(new Error('Spotify Playback SDK was not available.'));
      };
      const existing = document.querySelector<HTMLScriptElement>('script[data-media-api="spotify-premium"]');
      if (existing) return;
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.dataset.mediaApi = 'spotify-premium';
      script.onerror = () => reject(new Error('Spotify Playback SDK failed to load.'));
      document.head.append(script);
    });
  }
  return spotifySdkPromise;
}

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

function cueYouTubeSource(
  player: YouTubePlayer,
  parsed: { videoId?: string; playlistId?: string } | null,
) {
  if (parsed?.playlistId) {
    player.cuePlaylist({ list: parsed.playlistId, listType: 'playlist', index: 0 });
  } else if (parsed?.videoId) {
    player.cueVideoById(parsed.videoId);
  }
}

async function sendWindowsMediaKey(
  command: 'previous' | 'next' | 'volume-up' | 'volume-down',
  unavailable: () => void,
) {
  const sent = await platform.sendMediaKey(command);
  if (!sent) unavailable();
}

export function SpotifyPlayer({ source }: { source: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const sourceRef = useRef(source);
  const volumeRef = useRef(50);
  const { registerController, updateStatus } = useMedia();

  sourceRef.current = source;

  useEffect(() => {
    let active = true;
    let controller: SpotifyEmbedController | null = null;
    const unavailable = () => updateStatus('spotify', {
      message: 'Spotify skip and volume use Windows media keys in the installed app.',
    });

    const unregister = registerController('spotify', {
      previous: () => sendWindowsMediaKey('previous', unavailable),
      toggle: () => controllerRef.current?.togglePlay(),
      next: () => sendWindowsMediaKey('next', unavailable),
      setVolume: async (value) => {
        const direction = value >= volumeRef.current ? 'volume-up' : 'volume-down';
        await sendWindowsMediaKey(direction, unavailable);
        volumeRef.current = value;
        updateStatus('spotify', { volume: value });
      },
    });

    if (hostRef.current) {
      void loadSpotifyApi().then((api) => {
        if (!active || !hostRef.current) return;
        api.createController(hostRef.current, {
          uri: sourceRef.current,
          width: '100%',
          height: 352,
        }, (created) => {
          if (!active) {
            created.destroy();
            return;
          }
          controller = created;
          controllerRef.current = created;
          created.addListener('ready', () => updateStatus('spotify', {
            ready: true,
            detail: 'Playing inside XREAL WIN HUB',
            message: undefined,
          }));
          created.addListener('playback_started', () => updateStatus('spotify', {
            playing: true,
            detail: 'Spotify embed playback',
            message: undefined,
          }));
          created.addListener('playback_update', (event) => {
            const paused = event.data?.isPaused;
            if (typeof paused === 'boolean') updateStatus('spotify', { playing: !paused });
          });
        });
      }).catch(() => {
        if (active) updateStatus('spotify', {
          ready: false,
          message: 'Spotify could not load. Check the connection and restart the Hub.',
        });
      });
    }

    return () => {
      active = false;
      unregister();
      controller?.destroy();
      controllerRef.current = null;
    };
  // The official controller is created once; later source changes use loadEntity below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerController, updateStatus]);

  useEffect(() => {
    if (controllerRef.current && isSpotifySource(source)) {
      controllerRef.current.loadEntity(source);
      updateStatus('spotify', {
        title: source.includes('/track/') || source.startsWith('spotify:track:') ? 'Spotify track' : 'Spotify collection',
        playing: false,
        message: undefined,
      });
    }
  }, [source, updateStatus]);

  return <div className="embedded-player embedded-player--spotify" ref={hostRef} aria-label="Spotify player" />;
}

export function SpotifyPremiumPlayer({
  source,
  requestVersion,
}: {
  source: string;
  requestVersion: number;
}) {
  const playerRef = useRef<SpotifySdkPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const lastRequestRef = useRef(0);
  const sourceRef = useRef(source);
  const requestVersionRef = useRef(requestVersion);
  const { registerController, updateStatus } = useMedia();

  sourceRef.current = source;
  requestVersionRef.current = requestVersion;

  useEffect(() => {
    let active = true;
    let player: SpotifySdkPlayer | null = null;
    const unregister = registerController('spotify', {
      previous: () => playerRef.current?.previousTrack(),
      toggle: () => playerRef.current?.togglePlay(),
      next: () => playerRef.current?.nextTrack(),
      setVolume: async (value) => {
        await playerRef.current?.setVolume(value / 100);
        updateStatus('spotify', { volume: value, message: undefined });
      },
    });

    updateStatus('spotify', {
      ready: false,
      active: false,
      volumeMode: 'player',
      detail: 'Connecting Spotify Premium…',
      message: undefined,
    });

    void loadSpotifySdk().then((sdk) => {
      if (!active) return;
      player = new sdk.Player({
        name: 'XREAL WIN HUB',
        volume: 0.5,
        getOAuthToken: (callback) => {
          void platform.getSpotifyAccessToken().then((token) => {
            if (token) callback(token);
            else updateStatus('spotify', { message: 'Spotify authorization expired. Reconnect your account.' });
          });
        },
      });
      playerRef.current = player;
      player.addListener('ready', ({ device_id: deviceId }: { device_id: string }) => {
        if (!active) return;
        deviceIdRef.current = deviceId;
        updateStatus('spotify', {
          ready: true,
          active: true,
          detail: 'Spotify Premium ready',
          volume: 50,
          volumeMode: 'player',
          message: undefined,
        });
        const pendingVersion = requestVersionRef.current;
        const pendingSource = sourceRef.current;
        if (pendingVersion && pendingVersion !== lastRequestRef.current && isSpotifySource(pendingSource)) {
          lastRequestRef.current = pendingVersion;
          void player?.activateElement()
            .then(() => platform.playSpotifySource(pendingSource, deviceId))
            .then((played) => {
              if (!played) throw new Error('Spotify did not accept the playback request.');
              updateStatus('spotify', { message: undefined });
            })
            .catch((error) => updateStatus('spotify', {
              message: error instanceof Error ? error.message : 'Spotify could not play that link.',
            }));
        }
      });
      player.addListener('not_ready', () => updateStatus('spotify', {
        ready: false,
        active: false,
        message: 'Spotify Premium lost its playback connection.',
      }));
      player.addListener('player_state_changed', (state: SpotifyPlaybackState | null) => {
        if (!state || !active) return;
        const track = state.track_window.current_track;
        updateStatus('spotify', {
          ready: true,
          active: true,
          playing: !state.paused,
          title: track.name || 'Spotify',
          detail: track.artists.map((artist) => artist.name).join(', ') || 'Spotify Premium',
          artwork: track.album.images[0]?.url,
          message: undefined,
        });
      });
      for (const event of ['initialization_error', 'authentication_error', 'account_error', 'playback_error']) {
        player.addListener(event, ({ message }: { message: string }) => updateStatus('spotify', {
          ready: false,
          active: false,
          message: event === 'initialization_error'
            ? 'This Electron build cannot initialise Spotify encrypted playback. The embed fallback remains available.'
            : message,
        }));
      }
      void player.connect().then((connected) => {
        if (!connected) updateStatus('spotify', { message: 'Spotify Premium could not connect to playback.' });
      });
    }).catch(() => updateStatus('spotify', {
      ready: false,
      active: false,
      message: 'Spotify Premium SDK could not load. Check the connection and try again.',
    }));

    return () => {
      active = false;
      unregister();
      player?.disconnect();
      playerRef.current = null;
      deviceIdRef.current = null;
    };
  }, [registerController, updateStatus]);

  useEffect(() => {
    if (!requestVersion || requestVersion === lastRequestRef.current) return;
    const deviceId = deviceIdRef.current;
    if (!deviceId || !isSpotifySource(source)) {
      updateStatus('spotify', { message: 'Spotify Premium is preparing the player. Your link will load automatically.' });
      return;
    }
    lastRequestRef.current = requestVersion;
    void playerRef.current?.activateElement()
      .then(() => platform.playSpotifySource(source, deviceId))
      .then((played) => {
        if (!played) throw new Error('Spotify did not accept the playback request.');
        updateStatus('spotify', { message: undefined });
      })
      .catch((error) => updateStatus('spotify', { message: error.message || 'Spotify could not play that link.' }));
  }, [requestVersion, source, updateStatus]);

  return <div className="premium-player-runtime" aria-label="Spotify Premium player" />;
}

export function YouTubePlayer({ source }: { source: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const sourceRef = useRef(source);
  const { registerController, updateStatus } = useMedia();
  sourceRef.current = source;

  useEffect(() => {
    let active = true;
    let player: YouTubePlayer | null = null;
    const unregister = registerController('youtube', {
      previous: () => playerRef.current?.previousVideo(),
      toggle: () => {
        const current = playerRef.current;
        if (!current) return;
        if (current.getPlayerState() === 1) current.pauseVideo();
        else current.playVideo();
      },
      next: () => playerRef.current?.nextVideo(),
      setVolume: (value) => {
        playerRef.current?.setVolume(value);
        updateStatus('youtube', { volume: value });
      },
    });

    if (hostRef.current) {
      void loadYouTubeApi().then((api) => {
        if (!active || !hostRef.current) return;
        const parsed = parseYouTubeSource(sourceRef.current);
        player = new api.Player(hostRef.current, {
          width: '100%',
          height: '100%',
          videoId: parsed?.videoId ?? 'M7lc1UVf-VE',
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onReady: ({ target }) => {
              if (!active) return;
              playerRef.current = target;
              target.setVolume(70);
              cueYouTubeSource(target, parsed);
              updateStatus('youtube', {
                ready: true,
                active: true,
                title: target.getVideoData().title || 'YouTube',
                detail: target.getVideoData().author || (parsed?.playlistId ? 'YouTube playlist in Hub' : 'YouTube video in Hub'),
                artwork: target.getVideoData().video_id
                  ? `https://i.ytimg.com/vi/${target.getVideoData().video_id}/hqdefault.jpg`
                  : undefined,
                volume: target.getVolume(),
                message: undefined,
              });
            },
            onStateChange: ({ data, target }) => updateStatus('youtube', {
              playing: data === 1,
              active: true,
              title: target.getVideoData().title || 'YouTube',
              detail: target.getVideoData().author || 'YouTube',
              artwork: target.getVideoData().video_id
                ? `https://i.ytimg.com/vi/${target.getVideoData().video_id}/hqdefault.jpg`
                : undefined,
              message: undefined,
            }),
            onError: ({ data }) => updateStatus('youtube', {
              message: `YouTube could not play this item (error ${data}). It may block embedding.`,
            }),
          },
        });
      }).catch(() => {
        if (active) updateStatus('youtube', {
          ready: false,
          message: 'YouTube could not load. Check the connection and restart the Hub.',
        });
      });
    }

    return () => {
      active = false;
      unregister();
      player?.destroy();
      playerRef.current = null;
    };
  }, [registerController, updateStatus]);

  useEffect(() => {
    const parsed = parseYouTubeSource(source);
    const player = playerRef.current;
    if (!player || !parsed) return;
    cueYouTubeSource(player, parsed);
    updateStatus('youtube', {
      playing: false,
      detail: parsed.playlistId ? 'YouTube playlist in Hub' : 'YouTube video in Hub',
      message: undefined,
    });
  }, [source, updateStatus]);

  return <div className="embedded-player embedded-player--youtube" ref={hostRef} aria-label="YouTube player" />;
}
