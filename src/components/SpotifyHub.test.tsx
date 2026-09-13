/**
 * @vitest-environment jsdom
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { platform } from '../services/platform';
import { MediaProvider } from '../state/MediaContext';
import { SpotifyHub } from './SpotifyHub';

const sample = {
  id: 'playlist-1',
  uri: 'spotify:playlist:playlist1',
  type: 'playlist',
  name: 'Focus Mix',
  subtitle: 'Shea',
  imageUrl: null,
  durationMs: 0,
  explicit: false,
};

describe('Spotify Hub', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('loads Home and provides Search and Library navigation', async () => {
    const catalog = vi.spyOn(platform, 'getSpotifyCatalog').mockResolvedValue({
      sections: [{ id: 'playlists', title: 'Your playlists', items: [sample] }],
    });

    await act(async () => {
      root.render(<MediaProvider><SpotifyHub onToast={() => undefined} /></MediaProvider>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(catalog).toHaveBeenCalledWith('home', undefined);
    expect(container.textContent).toContain('Focus Mix');
    expect(container.querySelector('[aria-label="Spotify playback controls"]')).not.toBeNull();

    const search = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Search');
    await act(async () => search?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector<HTMLInputElement>('[aria-label="Search Spotify"]')).not.toBeNull();
  });
});
