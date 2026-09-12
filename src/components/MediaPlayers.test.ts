/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { isSpotifySource, parseYouTubeSource } from './MediaPlayers';

describe('media source validation', () => {
  it('accepts supported Spotify links and rejects unrelated hosts', () => {
    expect(isSpotifySource('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true);
    expect(isSpotifySource('spotify:track:0VjIjW4GlUZAMYd2vXMi3b')).toBe(true);
    expect(isSpotifySource('https://example.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(false);
    expect(isSpotifySource('javascript:alert(1)')).toBe(false);
  });

  it('parses YouTube videos, Shorts, and playlists', () => {
    expect(parseYouTubeSource('https://youtu.be/M7lc1UVf-VE')).toEqual({ videoId: 'M7lc1UVf-VE' });
    expect(parseYouTubeSource('https://www.youtube.com/shorts/M7lc1UVf-VE')).toEqual({ videoId: 'M7lc1UVf-VE' });
    expect(parseYouTubeSource('https://music.youtube.com/watch?v=M7lc1UVf-VE')).toEqual({ videoId: 'M7lc1UVf-VE' });
    expect(parseYouTubeSource('https://www.youtube.com/watch?v=M7lc1UVf-VE&list=PL1234567890')).toEqual({
      videoId: 'M7lc1UVf-VE',
      playlistId: 'PL1234567890',
    });
    expect(parseYouTubeSource('https://example.com/watch?v=M7lc1UVf-VE')).toBeNull();
  });
});
