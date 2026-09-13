'use strict';

const { createHash, randomBytes } = require('node:crypto');
const { promises: fs } = require('node:fs');
const { createServer } = require('node:http');
const path = require('node:path');

const SPOTIFY_CALLBACK_PORT = 8888;
const REDIRECT_REGISTRATION = `http://127.0.0.1:${SPOTIFY_CALLBACK_PORT}/callback`;
const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-top-read',
  'user-read-recently-played',
  'user-follow-read',
].join(' ');

function spotifyUriFromSource(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  const trimmed = value.trim();
  const uriMatch = /^spotify:(track|album|playlist|show|episode|artist):([A-Za-z0-9]+)$/i.exec(trimmed);
  if (uriMatch) return `spotify:${uriMatch[1].toLowerCase()}:${uriMatch[2]}`;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com') return null;
    const match = /^\/(track|album|playlist|show|episode|artist)\/([A-Za-z0-9]+)\/?$/i.exec(url.pathname);
    return match ? `spotify:${match[1].toLowerCase()}:${match[2]}` : null;
  } catch {
    return null;
  }
}

function callbackPage(success, message) {
  const title = success ? 'Spotify connected' : 'Spotify connection failed';
  const accent = success ? '#5ee5d5' : '#ff6f78';
  const safeMessage = String(message).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{margin:0;display:grid;min-height:100vh;place-items:center;background:#070b12;color:#f3f7fb;font-family:Segoe UI,sans-serif}main{max-width:480px;padding:38px;text-align:center;background:#0d131e;border:1px solid #273344;border-radius:18px}h1{color:${accent}}p{color:#9ba9b8;line-height:1.55}</style><main><h1>${title}</h1><p>${safeMessage}</p><p>You can close this tab and return to XREAL WIN HUB.</p></main>`;
}

function chooseSpotifyDevice(items, preferredDeviceId) {
  const usable = (Array.isArray(items) ? items : []).filter((device) => device && !device.restricted);
  return usable.find((device) => device.active)
    || usable.find((device) => device.id === preferredDeviceId)
    || usable.find((device) => /computer|desktop/i.test(device.type))
    || usable[0]
    || null;
}

function createSpotifyAuth({ app, safeStorage, shell }) {
  let loaded = false;
  let record = null;
  let connectPromise = null;

  function authPath() {
    return path.join(app.getPath('userData'), 'spotify-auth.json');
  }

  async function load() {
    if (loaded) return;
    loaded = true;
    try {
      const saved = JSON.parse(await fs.readFile(authPath(), 'utf8'));
      record = {
        clientId: typeof saved.clientId === 'string' ? saved.clientId : null,
        accountName: typeof saved.accountName === 'string' ? saved.accountName : null,
        product: typeof saved.product === 'string' ? saved.product : null,
        preferredDeviceId: typeof saved.preferredDeviceId === 'string' ? saved.preferredDeviceId : null,
        token: null,
      };
      if (saved.encryptedToken && safeStorage.isEncryptionAvailable()) {
        record.token = JSON.parse(safeStorage.decryptString(Buffer.from(saved.encryptedToken, 'base64')));
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') console.error('Unable to load Spotify authorization', error);
    }
  }

  async function save() {
    if (!record?.clientId) return;
    const output = {
      clientId: record.clientId,
      accountName: record.accountName,
      product: record.product,
      preferredDeviceId: record.preferredDeviceId ?? null,
      encryptedToken: null,
    };
    if (record.token && safeStorage.isEncryptionAvailable()) {
      output.encryptedToken = safeStorage.encryptString(JSON.stringify(record.token)).toString('base64');
    }
    await fs.mkdir(path.dirname(authPath()), { recursive: true });
    const temporary = `${authPath()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(output, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, authPath());
  }

  function status(message) {
    return {
      supported: process.platform === 'win32',
      configured: Boolean(record?.clientId),
      connected: Boolean(record?.token?.refreshToken || (record?.token?.accessToken && record.token.expiresAt > Date.now())),
      clientId: record?.clientId ?? null,
      accountName: record?.accountName ?? null,
      product: record?.product ?? null,
      redirectUri: REDIRECT_REGISTRATION,
      message,
    };
  }

  async function exchangeToken(parameters) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(parameters),
    });
    const body = await response.json();
    if (!response.ok || !body.access_token) {
      throw new Error(body.error_description || body.error || `Spotify token request failed (${response.status}).`);
    }
    return body;
  }

  async function accessToken() {
    await load();
    if (!record?.token) return null;
    if (record.token.expiresAt > Date.now() + 60_000) return record.token.accessToken;
    if (!record.token.refreshToken || !record.clientId) return null;
    const refreshed = await exchangeToken({
      client_id: record.clientId,
      grant_type: 'refresh_token',
      refresh_token: record.token.refreshToken,
    });
    record.token = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || record.token.refreshToken,
      expiresAt: Date.now() + (Number(refreshed.expires_in) || 3600) * 1000,
      scope: refreshed.scope || record.token.scope,
    };
    await save();
    return record.token.accessToken;
  }

  async function fetchProfile() {
    const token = await accessToken();
    if (!token) return;
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const profile = await response.json();
    record.accountName = profile.display_name || profile.id || null;
    record.product = profile.product || null;
    await save();
  }

  async function getStatus() {
    await load();
    return status();
  }

  async function connect(clientId) {
    await load();
    const cleanedClientId = typeof clientId === 'string' ? clientId.trim() : '';
    if (!/^[A-Za-z0-9]{16,64}$/.test(cleanedClientId)) {
      throw new TypeError('Enter the Client ID from your Spotify Developer app.');
    }
    if (connectPromise) return connectPromise;

    connectPromise = new Promise((resolve, reject) => {
      const verifier = randomBytes(64).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const expectedState = randomBytes(24).toString('base64url');
      const server = createServer();
      let settled = false;

      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        server.close();
        connectPromise = null;
        callback(value);
      };

      const timeout = setTimeout(() => {
        finish(reject, new Error('Spotify sign-in timed out. Please try again.'));
      }, 5 * 60 * 1000);

      server.on('request', async (request, response) => {
        try {
          const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
          if (requestUrl.pathname !== '/callback') {
            response.writeHead(404).end();
            return;
          }
          if (requestUrl.searchParams.get('state') !== expectedState) {
            throw new Error('Spotify returned an invalid authorization state.');
          }
          const authorizationError = requestUrl.searchParams.get('error');
          if (authorizationError) throw new Error(`Spotify authorization was declined: ${authorizationError}.`);
          const code = requestUrl.searchParams.get('code');
          if (!code) throw new Error('Spotify did not return an authorization code.');
          const token = await exchangeToken({
            client_id: cleanedClientId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_REGISTRATION,
            code_verifier: verifier,
          });
          record = {
            clientId: cleanedClientId,
            accountName: null,
            product: null,
            preferredDeviceId: null,
            token: {
              accessToken: token.access_token,
              refreshToken: token.refresh_token || null,
              expiresAt: Date.now() + (Number(token.expires_in) || 3600) * 1000,
              scope: token.scope || SPOTIFY_SCOPES,
            },
          };
          await save();
          await fetchProfile();
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          response.end(callbackPage(true, 'Your Premium account is now available to the Hub.'));
          finish(resolve, status('Spotify Premium connected.'));
        } catch (error) {
          response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          response.end(callbackPage(false, error.message));
          finish(reject, error);
        }
      });

      server.on('error', (error) => {
        const message = error?.code === 'EADDRINUSE'
          ? `Spotify sign-in port ${SPOTIFY_CALLBACK_PORT} is already in use. Close any other Hub instance and try again.`
          : error;
        finish(reject, message instanceof Error ? message : new Error(String(message)));
      });
      server.listen(SPOTIFY_CALLBACK_PORT, '127.0.0.1', async () => {
        try {
          const authorizeUrl = new URL('https://accounts.spotify.com/authorize');
          authorizeUrl.search = new URLSearchParams({
            response_type: 'code',
            client_id: cleanedClientId,
            scope: SPOTIFY_SCOPES,
            redirect_uri: REDIRECT_REGISTRATION,
            state: expectedState,
            code_challenge_method: 'S256',
            code_challenge: challenge,
          }).toString();
          await shell.openExternal(authorizeUrl.toString());
        } catch (error) {
          finish(reject, error);
        }
      });
    });

    return connectPromise;
  }

  async function disconnect() {
    await load();
    record = null;
    await fs.rm(authPath(), { force: true });
    return status('Spotify disconnected.');
  }

  async function spotifyRequest(endpoint, options = {}) {
    const token = await accessToken();
    if (!token) throw new Error('Spotify is not connected.');
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
    });
    if (!response.ok && response.status !== 204) {
      const body = await response.text();
      let spotifyMessage = '';
      let reason = '';
      try {
        const parsed = JSON.parse(body);
        spotifyMessage = parsed?.error?.message || parsed?.error_description || '';
        reason = parsed?.error?.reason || parsed?.error || '';
      } catch {
        // Spotify occasionally returns a plain-text upstream error.
      }
      const error = new Error(spotifyMessage || `Spotify request failed (${response.status}).`);
      error.status = response.status;
      error.reason = typeof reason === 'string' ? reason : '';
      throw error;
    }
    if (response.status === 204) return null;
    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('application/json') ? response.json() : null;
  }

  function normaliseDevice(value) {
    if (!value || typeof value.id !== 'string' || !value.id) return null;
    return {
      id: value.id,
      name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Spotify device',
      type: typeof value.type === 'string' ? value.type : 'Unknown',
      active: Boolean(value.is_active),
      restricted: Boolean(value.is_restricted),
      privateSession: Boolean(value.is_private_session),
      volume: Number.isFinite(value.volume_percent) ? value.volume_percent : null,
    };
  }

  async function devices() {
    const result = await spotifyRequest('/me/player/devices');
    return (Array.isArray(result?.devices) ? result.devices : []).map(normaliseDevice).filter(Boolean);
  }

  async function transferToDevice(deviceId, play = false) {
    const available = await devices();
    const selected = available.find((device) => device.id === deviceId && !device.restricted);
    if (!selected) throw new Error('That Spotify device is no longer available. Refresh the device list and try again.');
    await spotifyRequest('/me/player', {
      method: 'PUT',
      body: JSON.stringify({ device_ids: [selected.id], play: Boolean(play) }),
    });
    record.preferredDeviceId = selected.id;
    await save();
    await new Promise((resolve) => setTimeout(resolve, 250));
    return selected;
  }

  async function ensurePlaybackDevice() {
    const available = await devices();
    const selected = chooseSpotifyDevice(available, record?.preferredDeviceId);
    if (!selected) {
      throw new Error('No Spotify Connect device is available. Open Spotify on this PC or phone, then press Refresh devices.');
    }
    if (!selected.active) return transferToDevice(selected.id, false);
    record.preferredDeviceId = selected.id;
    return selected;
  }

  async function playSource(source) {
    const uri = spotifyUriFromSource(source);
    if (!uri) return false;
    const type = uri.split(':')[1];
    const body = ['track', 'episode'].includes(type) ? { uris: [uri] } : { context_uri: uri };
    const device = await ensurePlaybackDevice();
    const endpoint = `/me/player/play?device_id=${encodeURIComponent(device.id)}`;
    try {
      await spotifyRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) });
    } catch (error) {
      if (error?.reason !== 'NO_ACTIVE_DEVICE' && error?.status !== 404) throw error;
      await transferToDevice(device.id, false);
      await spotifyRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) });
    }
    return true;
  }

  async function playbackStatus(message) {
    const state = await spotifyRequest('/me/player');
    const item = state?.item;
    return {
      available: Boolean(state?.device),
      playing: Boolean(state?.is_playing),
      title: typeof item?.name === 'string' ? item.name : 'Spotify',
      detail: Array.isArray(item?.artists)
        ? item.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
        : (state?.device?.name || 'No active Spotify device'),
      volume: Number.isFinite(state?.device?.volume_percent) ? state.device.volume_percent : 50,
      artwork: item?.album?.images?.[0]?.url,
      positionMs: Number.isFinite(state?.progress_ms) ? state.progress_ms : 0,
      durationMs: Number.isFinite(item?.duration_ms) ? item.duration_ms : 0,
      shuffle: Boolean(state?.shuffle_state),
      repeatMode: ['off', 'track', 'context'].includes(state?.repeat_state) ? state.repeat_state : 'off',
      deviceName: state?.device?.name || null,
      deviceId: state?.device?.id || null,
      ...(message ? { message } : {}),
    };
  }

  async function control(command, value) {
    if (!['previous', 'toggle', 'next', 'volume', 'seek', 'shuffle', 'repeat'].includes(command)) {
      throw new TypeError('Unsupported Spotify command.');
    }
    let current = await playbackStatus();
    if (!current.available) {
      await ensurePlaybackDevice();
      current = await playbackStatus('Spotify device activated.');
    }
    if (command === 'previous' || command === 'next') {
      await spotifyRequest(`/me/player/${command}`, { method: 'POST' });
    } else if (command === 'toggle') {
      await spotifyRequest(`/me/player/${current.playing ? 'pause' : 'play'}`, { method: 'PUT' });
    } else if (command === 'volume') {
      const volume = Math.max(0, Math.min(100, Math.round(Number(value))));
      if (!Number.isFinite(volume)) throw new TypeError('Spotify volume must be a number.');
      await spotifyRequest(`/me/player/volume?volume_percent=${volume}`, { method: 'PUT' });
    } else if (command === 'seek') {
      const position = Math.max(0, Math.min(current.durationMs || 86_400_000, Math.round(Number(value))));
      if (!Number.isFinite(position)) throw new TypeError('Spotify seek position must be a number.');
      await spotifyRequest(`/me/player/seek?position_ms=${position}`, { method: 'PUT' });
    } else if (command === 'shuffle') {
      await spotifyRequest(`/me/player/shuffle?state=${Boolean(value)}`, { method: 'PUT' });
    } else {
      const state = ['off', 'track', 'context'].includes(value) ? value : 'off';
      await spotifyRequest(`/me/player/repeat?state=${state}`, { method: 'PUT' });
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
    return playbackStatus();
  }

  async function selectDevice(deviceId) {
    if (typeof deviceId !== 'string' || deviceId.length < 1 || deviceId.length > 256) {
      throw new TypeError('Invalid Spotify device.');
    }
    const selected = await transferToDevice(deviceId, false);
    const current = await playbackStatus(`Playback moved to ${selected.name}.`);
    return { ...current, deviceId: selected.id, deviceName: selected.name, available: true };
  }

  function normaliseItem(value) {
    const item = value?.track ?? value?.album ?? value?.item ?? value;
    if (!item || typeof item !== 'object' || typeof item.name !== 'string') return null;
    const artists = Array.isArray(item.artists)
      ? item.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
      : '';
    const subtitle = artists || item.owner?.display_name || item.publisher || item.type || '';
    const images = Array.isArray(item.images)
      ? item.images
      : Array.isArray(item.album?.images) ? item.album.images : [];
    return {
      id: typeof item.id === 'string' ? item.id : '',
      uri: typeof item.uri === 'string' ? item.uri : '',
      type: typeof item.type === 'string' ? item.type : 'track',
      name: item.name,
      subtitle,
      imageUrl: images.find((image) => typeof image?.url === 'string')?.url || null,
      durationMs: Number.isFinite(item.duration_ms) ? item.duration_ms : 0,
      explicit: Boolean(item.explicit),
    };
  }

  function normaliseItems(values) {
    return (Array.isArray(values) ? values : []).map(normaliseItem).filter(Boolean);
  }

  async function optionalRequest(endpoint) {
    try {
      return await spotifyRequest(endpoint);
    } catch (error) {
      console.warn('Optional Spotify shelf unavailable', endpoint, error?.message);
      return null;
    }
  }

  async function catalog(action, payload = {}) {
    if (!['home', 'search', 'library', 'collection'].includes(action)) {
      throw new TypeError('Unsupported Spotify catalogue action.');
    }
    if (action === 'home') {
      const [recent, top, playlists, albums] = await Promise.all([
        optionalRequest('/me/player/recently-played?limit=12'),
        optionalRequest('/me/top/tracks?limit=12&time_range=short_term'),
        optionalRequest('/me/playlists?limit=12'),
        optionalRequest('/me/albums?limit=12'),
      ]);
      return { sections: [
        { id: 'recent', title: 'Recently played', items: normaliseItems(recent?.items) },
        { id: 'top', title: 'Made from your listening', items: normaliseItems(top?.items) },
        { id: 'playlists', title: 'Your playlists', items: normaliseItems(playlists?.items) },
        { id: 'albums', title: 'Saved albums', items: normaliseItems(albums?.items) },
      ].filter((section) => section.items.length) };
    }
    if (action === 'library') {
      const [tracks, albums, playlists, artists] = await Promise.all([
        optionalRequest('/me/tracks?limit=24'),
        optionalRequest('/me/albums?limit=18'),
        optionalRequest('/me/playlists?limit=24'),
        optionalRequest('/me/following?type=artist&limit=18'),
      ]);
      return { sections: [
        { id: 'liked', title: 'Liked songs', items: normaliseItems(tracks?.items) },
        { id: 'albums', title: 'Albums', items: normaliseItems(albums?.items) },
        { id: 'playlists', title: 'Playlists', items: normaliseItems(playlists?.items) },
        { id: 'artists', title: 'Followed artists', items: normaliseItems(artists?.artists?.items) },
      ].filter((section) => section.items.length) };
    }
    if (action === 'search') {
      const query = typeof payload.query === 'string' ? payload.query.trim().slice(0, 100) : '';
      if (!query) return { sections: [] };
      const result = await spotifyRequest(`/search?q=${encodeURIComponent(query)}&type=track,album,artist,playlist,show&limit=12`);
      const definitions = [
        ['tracks', 'Songs'], ['artists', 'Artists'], ['albums', 'Albums'],
        ['playlists', 'Playlists'], ['shows', 'Podcasts'],
      ];
      return { sections: definitions.map(([key, title]) => ({
        id: key,
        title,
        items: normaliseItems(result?.[key]?.items),
      })).filter((section) => section.items.length) };
    }

    const uri = spotifyUriFromSource(payload.uri);
    if (!uri) throw new TypeError('Unsupported Spotify collection.');
    const [, type, id] = uri.split(':');
    let detail;
    let children = [];
    if (type === 'artist') {
      const [artist, tracks] = await Promise.all([
        spotifyRequest(`/artists/${id}`),
        spotifyRequest(`/artists/${id}/top-tracks`),
      ]);
      detail = artist;
      children = tracks?.tracks;
    } else {
      detail = await spotifyRequest(`/${type}s/${id}`);
      children = detail?.tracks?.items ?? detail?.items?.items ?? detail?.episodes?.items ?? [];
    }
    return { header: normaliseItem(detail), items: normaliseItems(children) };
  }

  return { getStatus, connect, disconnect, accessToken, playSource, playbackStatus, devices, selectDevice, control, catalog };
}

module.exports = { chooseSpotifyDevice, createSpotifyAuth, spotifyUriFromSource, REDIRECT_REGISTRATION };
