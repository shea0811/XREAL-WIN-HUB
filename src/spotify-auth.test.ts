import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  REDIRECT_REGISTRATION,
  chooseSpotifyDevice,
  spotifyUriFromSource,
}: {
  REDIRECT_REGISTRATION: string;
  spotifyUriFromSource(value: unknown): string | null;
  chooseSpotifyDevice(items: Array<{ id: string; type: string; active: boolean; restricted: boolean }>, preferred?: string): { id: string } | null;
} = require('../electron/spotify-auth.cjs');

describe('Spotify desktop authorization helpers', () => {
  it('uses the registered loopback redirect required by the desktop PKCE flow', () => {
    expect(REDIRECT_REGISTRATION).toBe('http://127.0.0.1:8888/callback');
  });

  it('uses the same explicit loopback URI for registration and runtime', async () => {
    const source = await readFile(new URL('../electron/spotify-auth.cjs', import.meta.url), 'utf8');
    expect(source).toContain("server.listen(SPOTIFY_CALLBACK_PORT, '127.0.0.1'");
    expect(source).toContain('redirect_uri: REDIRECT_REGISTRATION');
    expect(source).not.toContain('http://localhost');
  });

  it('normalises supported Spotify links and URIs', () => {
    expect(spotifyUriFromSource('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'))
      .toBe('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
    expect(spotifyUriFromSource('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'))
      .toBe('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M');
  });

  it('rejects untrusted hosts and malformed sources', () => {
    expect(spotifyUriFromSource('https://example.com/track/4uLU6hMCjMI75M1A2tKUQC')).toBeNull();
    expect(spotifyUriFromSource('javascript:alert(1)')).toBeNull();
    expect(spotifyUriFromSource(null)).toBeNull();
  });

  it('requests only user-facing catalogue and playback permissions', async () => {
    const source = await readFile(new URL('../electron/spotify-auth.cjs', import.meta.url), 'utf8');
    expect(source).toContain("'user-library-read'");
    expect(source).toContain("'playlist-read-private'");
    expect(source).toContain("'user-top-read'");
    expect(source).not.toContain('client_secret');
  });

  it('chooses an active, preferred, or desktop Spotify Connect device safely', () => {
    const devices = [
      { id: 'phone', type: 'Smartphone', active: false, restricted: false },
      { id: 'pc', type: 'Computer', active: false, restricted: false },
    ];
    expect(chooseSpotifyDevice(devices, 'phone')?.id).toBe('phone');
    expect(chooseSpotifyDevice(devices)?.id).toBe('pc');
    expect(chooseSpotifyDevice([{ ...devices[0], active: true }, devices[1]])?.id).toBe('phone');
    expect(chooseSpotifyDevice([{ ...devices[0], restricted: true }])).toBeNull();
  });

  it('activates a Connect device and retries transient no-active-device playback', async () => {
    const source = await readFile(new URL('../electron/spotify-auth.cjs', import.meta.url), 'utf8');
    expect(source).toContain("spotifyRequest('/me/player/devices')");
    expect(source).toContain('device_ids: [selected.id]');
    expect(source).toContain("error?.reason !== 'NO_ACTIVE_DEVICE'");
    expect(source).toContain('No Spotify Connect device is available.');
  });
});
