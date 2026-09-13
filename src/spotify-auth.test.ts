import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  REDIRECT_REGISTRATION,
  spotifyUriFromSource,
}: {
  REDIRECT_REGISTRATION: string;
  spotifyUriFromSource(value: unknown): string | null;
} = require('../electron/spotify-auth.cjs');

describe('Spotify desktop authorization helpers', () => {
  it('uses the registered loopback redirect required by the desktop PKCE flow', () => {
    expect(REDIRECT_REGISTRATION).toBe('http://127.0.0.1/callback');
  });

  it('uses an explicit loopback IP and adds only the dynamically assigned port at runtime', async () => {
    const source = await readFile(new URL('../electron/spotify-auth.cjs', import.meta.url), 'utf8');
    expect(source).toContain("server.listen(0, '127.0.0.1'");
    expect(source).toContain('`http://127.0.0.1:${address.port}/callback`');
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
});
