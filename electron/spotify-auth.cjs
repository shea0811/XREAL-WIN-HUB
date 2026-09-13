'use strict';

const { createHash, randomBytes } = require('node:crypto');
const { promises: fs } = require('node:fs');
const { createServer } = require('node:http');
const path = require('node:path');

const REDIRECT_REGISTRATION = 'http://127.0.0.1/callback';
const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
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
          const address = server.address();
          if (!address || typeof address === 'string') throw new Error('Spotify callback address was unavailable.');
          const redirectUri = `http://127.0.0.1:${address.port}/callback`;
          const token = await exchangeToken({
            client_id: cleanedClientId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: verifier,
          });
          record = {
            clientId: cleanedClientId,
            accountName: null,
            product: null,
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

      server.on('error', (error) => finish(reject, error));
      server.listen(0, '127.0.0.1', async () => {
        try {
          const address = server.address();
          if (!address || typeof address === 'string') throw new Error('Spotify callback address was unavailable.');
          const redirectUri = `http://127.0.0.1:${address.port}/callback`;
          const authorizeUrl = new URL('https://accounts.spotify.com/authorize');
          authorizeUrl.search = new URLSearchParams({
            response_type: 'code',
            client_id: cleanedClientId,
            scope: SPOTIFY_SCOPES,
            redirect_uri: redirectUri,
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
      throw new Error(`Spotify playback request failed (${response.status}): ${body.slice(0, 180)}`);
    }
    if (response.status === 204) return null;
    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('application/json') ? response.json() : null;
  }

  async function playSource(source) {
    const uri = spotifyUriFromSource(source);
    if (!uri) return false;
    const type = uri.split(':')[1];
    const body = ['track', 'episode'].includes(type) ? { uris: [uri] } : { context_uri: uri };
    await spotifyRequest('/me/player/play', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
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
      ...(message ? { message } : {}),
    };
  }

  async function control(command, value) {
    if (!['previous', 'toggle', 'next', 'volume'].includes(command)) {
      throw new TypeError('Unsupported Spotify command.');
    }
    const current = await playbackStatus();
    if (!current.available) return { ...current, message: 'Open Spotify on a device once, then try the control again.' };
    if (command === 'previous' || command === 'next') {
      await spotifyRequest(`/me/player/${command}`, { method: 'POST' });
    } else if (command === 'toggle') {
      await spotifyRequest(`/me/player/${current.playing ? 'pause' : 'play'}`, { method: 'PUT' });
    } else {
      const volume = Math.max(0, Math.min(100, Math.round(Number(value))));
      if (!Number.isFinite(volume)) throw new TypeError('Spotify volume must be a number.');
      await spotifyRequest(`/me/player/volume?volume_percent=${volume}`, { method: 'PUT' });
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
    return playbackStatus();
  }

  return { getStatus, connect, disconnect, accessToken, playSource, playbackStatus, control };
}

module.exports = { createSpotifyAuth, spotifyUriFromSource, REDIRECT_REGISTRATION };
