import { useEffect, useState } from 'react';
import {
  ArrowLeft, Disc3, Home, Library, LoaderCircle, Music2, Pause, Play,
  Repeat2, Search, Shuffle, SkipBack, SkipForward, Volume2,
} from 'lucide-react';
import { platform } from '../services/platform';
import { useMedia } from '../state/MediaContext';
import type { SpotifyCatalogItem, SpotifyCatalogResult } from '../types';
import { Button } from './ui';

type SpotifyView = 'home' | 'search' | 'library';

function itemSource(item: SpotifyCatalogItem) {
  return item.uri || `spotify:${item.type}:${item.id}`;
}

function clock(milliseconds = 0) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function ItemArtwork({ item }: { item: SpotifyCatalogItem }) {
  return item.imageUrl
    ? <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
    : <span className="spotify-artwork-fallback"><Music2 size={26} /></span>;
}

export function SpotifyHub({ onToast }: { onToast(message: string, detail?: string): void }) {
  const media = useMedia();
  const player = media.status.spotify;
  const [view, setView] = useState<SpotifyView>('home');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SpotifyCatalogResult>({ sections: [] });
  const [collection, setCollection] = useState<SpotifyCatalogResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(action: 'home' | 'library' | 'search', searchQuery?: string) {
    setLoading(true);
    setError(null);
    setCollection(null);
    try {
      setResult(await platform.getSpotifyCatalog(action, searchQuery ? { query: searchQuery } : undefined));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Spotify could not load this view.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load('home'); }, []);

  function changeView(next: SpotifyView) {
    setView(next);
    if (next === 'search') {
      setCollection(null);
      setResult({ sections: [] });
      setLoading(false);
    } else {
      void load(next);
    }
  }

  async function play(item: SpotifyCatalogItem) {
    const source = itemSource(item);
    try {
      media.setSource('spotify', source);
      await platform.playSpotifySource(source);
      onToast(`Playing ${item.name}`, item.subtitle);
    } catch (caught) {
      onToast('Spotify could not start playback', caught instanceof Error ? caught.message : undefined);
    }
  }

  async function open(item: SpotifyCatalogItem) {
    if (item.type === 'track' || item.type === 'episode') {
      await play(item);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setCollection(await platform.getSpotifyCatalog('collection', { uri: itemSource(item) }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Spotify could not open that collection.');
    } finally {
      setLoading(false);
    }
  }

  async function playerControl(command: 'seek' | 'shuffle' | 'repeat', value: number | boolean | string) {
    try {
      const next = await platform.controlSpotify(command, value);
      media.updateStatus('spotify', next);
    } catch (caught) {
      onToast('Spotify control failed', caught instanceof Error ? caught.message : undefined);
    }
  }

  const sections = collection?.header
    ? [{ id: 'collection', title: collection.header.name, items: collection.items ?? [] }]
    : result.sections ?? [];

  return (
    <section className="spotify-hub card-surface" aria-label="Spotify Hub">
      <aside className="spotify-hub__rail" aria-label="Spotify navigation">
        <button className={view === 'home' ? 'active' : ''} onClick={() => changeView('home')}><Home size={18} /><span>Home</span></button>
        <button className={view === 'search' ? 'active' : ''} onClick={() => changeView('search')}><Search size={18} /><span>Search</span></button>
        <button className={view === 'library' ? 'active' : ''} onClick={() => changeView('library')}><Library size={18} /><span>Library</span></button>
      </aside>

      <div className="spotify-hub__content">
        <header className="spotify-hub__header">
          <div>
            <span className="eyebrow">Spotify Premium</span>
            <h2>{collection?.header?.name ?? (view === 'home' ? 'Good listening' : view === 'library' ? 'Your library' : 'Search Spotify')}</h2>
            {collection?.header?.subtitle ? <p>{collection.header.subtitle}</p> : null}
          </div>
          {collection?.header ? (
            <div className="spotify-collection-actions">
              <Button variant="ghost" onClick={() => setCollection(null)}><ArrowLeft size={15} /> Back</Button>
              <Button variant="primary" onClick={() => void play(collection.header!)}><Play size={15} fill="currentColor" /> Play</Button>
            </div>
          ) : null}
        </header>

        {view === 'search' && !collection ? (
          <form className="spotify-search" onSubmit={(event) => { event.preventDefault(); void load('search', query.trim()); }}>
            <Search size={17} />
            <input aria-label="Search Spotify" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Songs, artists, albums, playlists or podcasts" />
            <Button variant="primary" type="submit" disabled={!query.trim()}>Search</Button>
          </form>
        ) : null}

        {error ? <div className="spotify-hub__state spotify-hub__state--error"><strong>Spotify could not load</strong><span>{error}</span></div> : null}
        {loading ? <div className="spotify-hub__state"><LoaderCircle className="spin" size={28} /><span>Loading Spotify…</span></div> : null}
        {!loading && !error && sections.length === 0 ? (
          <div className="spotify-hub__state"><Disc3 size={32} /><strong>{view === 'search' ? 'Search your Spotify catalogue' : 'Nothing to show yet'}</strong><span>{view === 'search' ? 'Enter a title, artist, album or podcast above.' : 'Reconnect Spotify once to grant the new library permissions.'}</span></div>
        ) : null}

        {!loading && !error ? sections.map((section) => (
          <div className="spotify-shelf" key={section.id}>
            <h3>{section.title}</h3>
            <div className={collection ? 'spotify-track-list' : 'spotify-card-grid'}>
              {section.items.map((item, index) => collection ? (
                <button className="spotify-track-row" key={`${item.uri}-${index}`} onClick={() => void play(item)}>
                  <span className="spotify-track-index">{index + 1}</span>
                  <span className="spotify-track-art"><ItemArtwork item={item} /></span>
                  <span className="spotify-track-copy"><strong>{item.name}</strong><small>{item.subtitle}</small></span>
                  <Play size={15} fill="currentColor" />
                </button>
              ) : (
                <button className="spotify-card" key={`${item.uri}-${index}`} onClick={() => void open(item)}>
                  <span className="spotify-card__art"><ItemArtwork item={item} /><span className="spotify-card__play"><Play size={17} fill="currentColor" /></span></span>
                  <strong>{item.name}</strong><small>{item.subtitle}</small>
                </button>
              ))}
            </div>
          </div>
        )) : null}
      </div>

      <footer className="spotify-full-player" aria-label="Spotify playback controls">
        <div className="spotify-full-player__track">
          {player.artwork ? <img src={player.artwork} alt="" /> : <span><Music2 size={18} /></span>}
          <div><strong>{player.title}</strong><small>{player.detail}</small></div>
        </div>
        <div className="spotify-full-player__centre">
          <div className="spotify-full-player__buttons">
            <button className={player.shuffle ? 'active' : ''} aria-label="Toggle shuffle" onClick={() => void playerControl('shuffle', !player.shuffle)}><Shuffle size={15} /></button>
            <button aria-label="Previous track" onClick={() => void media.run('spotify', 'previous')}><SkipBack size={17} fill="currentColor" /></button>
            <button className="spotify-play-button" aria-label={player.playing ? 'Pause' : 'Play'} onClick={() => void media.run('spotify', 'toggle')}>{player.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
            <button aria-label="Next track" onClick={() => void media.run('spotify', 'next')}><SkipForward size={17} fill="currentColor" /></button>
            <button className={player.repeatMode && player.repeatMode !== 'off' ? 'active' : ''} aria-label="Change repeat mode" onClick={() => void playerControl('repeat', player.repeatMode === 'off' ? 'context' : player.repeatMode === 'context' ? 'track' : 'off')}><Repeat2 size={15} /></button>
          </div>
          <div className="spotify-progress"><small>{clock(player.positionMs)}</small><input aria-label="Spotify seek" type="range" min="0" max={Math.max(1, player.durationMs ?? 1)} value={Math.min(player.positionMs ?? 0, player.durationMs ?? 1)} onChange={(event) => void playerControl('seek', Number(event.target.value))} /><small>{clock(player.durationMs)}</small></div>
        </div>
        <label className="spotify-full-player__volume"><Volume2 size={16} /><input aria-label="Spotify Hub volume" type="range" min="0" max="100" value={player.volume} onChange={(event) => void media.run('spotify', 'volume', Number(event.target.value))} /></label>
      </footer>
    </section>
  );
}
