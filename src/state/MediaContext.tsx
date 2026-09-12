import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { MediaService } from '../components/MediaBrandIcon';

export type MediaCommand = 'previous' | 'toggle' | 'next' | 'volume';

export interface MediaStatus {
  ready: boolean;
  playing: boolean;
  title: string;
  detail: string;
  volume: number;
  volumeMode: 'player' | 'system';
  message?: string;
}

interface MediaController {
  previous(): void | Promise<void>;
  toggle(): void | Promise<void>;
  next(): void | Promise<void>;
  setVolume(value: number): void | Promise<void>;
}

interface MediaContextValue {
  activeService: MediaService;
  setActiveService(service: MediaService): void;
  status: Record<MediaService, MediaStatus>;
  updateStatus(service: MediaService, update: Partial<MediaStatus>): void;
  registerController(service: MediaService, controller: MediaController): () => void;
  run(service: MediaService, command: MediaCommand, value?: number): void;
}

const initialStatus: Record<MediaService, MediaStatus> = {
  spotify: {
    ready: false,
    playing: false,
    title: 'Spotify',
    detail: 'Open Entertainment to load a playlist, album, or track.',
    volume: 50,
    volumeMode: 'system',
  },
  youtube: {
    ready: false,
    playing: false,
    title: 'YouTube',
    detail: 'Open Entertainment to load a video or playlist.',
    volume: 70,
    volumeMode: 'player',
  },
};

const MediaContext = createContext<MediaContextValue | null>(null);

export function MediaProvider({ children }: PropsWithChildren) {
  const [activeService, setActiveService] = useState<MediaService>('spotify');
  const [status, setStatus] = useState(initialStatus);
  const controllers = useRef<Partial<Record<MediaService, MediaController>>>({});

  const updateStatus = useCallback((service: MediaService, update: Partial<MediaStatus>) => {
    setStatus((current) => ({
      ...current,
      [service]: { ...current[service], ...update },
    }));
  }, []);

  const registerController = useCallback((service: MediaService, controller: MediaController) => {
    controllers.current[service] = controller;
    return () => {
      if (controllers.current[service] === controller) delete controllers.current[service];
    };
  }, []);

  const run = useCallback((service: MediaService, command: MediaCommand, value?: number) => {
    const controller = controllers.current[service];
    if (!controller) {
      updateStatus(service, { message: 'The player is still loading. Try again in a moment.' });
      return;
    }
    setActiveService(service);
    const action = command === 'volume'
      ? controller.setVolume(Math.max(0, Math.min(100, value ?? 0)))
      : controller[command]();
    void Promise.resolve(action).catch(() => {
      updateStatus(service, { message: 'That media control was unavailable.' });
    });
  }, [updateStatus]);

  const value = useMemo<MediaContextValue>(() => ({
    activeService,
    setActiveService,
    status,
    updateStatus,
    registerController,
    run,
  }), [activeService, registerController, run, status, updateStatus]);

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedia() {
  const value = useContext(MediaContext);
  if (!value) throw new Error('useMedia must be used inside MediaProvider.');
  return value;
}
