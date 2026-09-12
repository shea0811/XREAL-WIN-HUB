import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createDefaultState } from '../data/defaults';
import { loadHubState, platform } from '../services/platform';
import type {
  ActivityItem,
  GestureId,
  HubActionId,
  HubNotification,
  HubSettings,
  HubState,
  Note,
  Notebook,
  NoteSection,
  WorkspaceProfile,
} from '../types';

interface HubContextValue {
  state: HubState;
  hydrated: boolean;
  selectedNoteId: string | null;
  setSelectedNoteId(id: string | null): void;
  createNote(sectionId?: string): Note;
  createNotebook(name: string): Notebook;
  createNoteSection(notebookId: string, name: string): NoteSection;
  updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'tags' | 'sectionId' | 'notebookId'>>): void;
  deleteNote(id: string): void;
  updateSettings(patch: Partial<HubSettings>): void;
  updateGesture(id: GestureId, actionId: HubActionId): void;
  toggleGesture(id: GestureId): void;
  addWorkspace(profile: WorkspaceProfile): void;
  removeWorkspace(id: string): void;
  recordActivity(item: Omit<ActivityItem, 'id' | 'createdAt'>): void;
  pushNotification(item: Pick<HubNotification, 'title' | 'detail' | 'tone'>): HubNotification;
  markNotificationsRead(): void;
  clearNotifications(): void;
}

const HubContext = createContext<HubContextValue | null>(null);

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function HubProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<HubState>(() => createDefaultState());
  const [hydrated, setHydrated] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const latestState = useRef(state);

  useEffect(() => {
    let active = true;
    void loadHubState().then((loaded) => {
      if (!active) return;
      setState(loaded);
      setSelectedNoteId(loaded.notes[0]?.id ?? null);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    latestState.current = state;
    if (!hydrated) return;
    const timeout = window.setTimeout(() => {
      void platform.saveState(latestState.current).catch((error) => {
        console.error('Unable to persist hub state', error);
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [state, hydrated]);

  const createNote = useCallback((requestedSectionId?: string) => {
    const now = new Date().toISOString();
    const current = latestState.current;
    const section = current.noteSections.find((item) => item.id === requestedSectionId)
      ?? current.noteSections[0];
    const note: Note = {
      id: uniqueId('note'),
      notebookId: section?.notebookId ?? current.notebooks[0]?.id ?? 'personal-notebook',
      sectionId: section?.id ?? 'quick-notes-section',
      title: 'Untitled note',
      body: '',
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    setState((current) => ({ ...current, notes: [note, ...current.notes] }));
    setSelectedNoteId(note.id);
    return note;
  }, []);

  const createNotebook = useCallback((name: string) => {
    const now = new Date().toISOString();
    const notebook: Notebook = {
      id: uniqueId('notebook'),
      name: name.trim() || 'Untitled notebook',
      color: '#5ee5d5',
      createdAt: now,
    };
    const section: NoteSection = {
      id: uniqueId('section'),
      notebookId: notebook.id,
      name: 'Quick notes',
      color: notebook.color,
      createdAt: now,
    };
    setState((current) => ({
      ...current,
      notebooks: [...current.notebooks, notebook],
      noteSections: [...current.noteSections, section],
    }));
    return notebook;
  }, []);

  const createNoteSection = useCallback((notebookId: string, name: string) => {
    const section: NoteSection = {
      id: uniqueId('section'),
      notebookId,
      name: name.trim() || 'New section',
      color: '#9d8cff',
      createdAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      noteSections: [...current.noteSections, section],
    }));
    return section;
  }, []);

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'tags' | 'sectionId' | 'notebookId'>>) => {
      setState((current) => ({
        ...current,
        notes: current.notes.map((note) =>
          note.id === id
            ? { ...note, ...patch, updatedAt: new Date().toISOString() }
            : note,
        ),
      }));
    },
    [],
  );

  const deleteNote = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      notes: current.notes.filter((note) => note.id !== id),
    }));
    setSelectedNoteId((selected) => (selected === id ? null : selected));
  }, []);

  const updateSettings = useCallback((patch: Partial<HubSettings>) => {
    setState((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  }, []);

  const updateGesture = useCallback((id: GestureId, actionId: HubActionId) => {
    setState((current) => ({
      ...current,
      gestures: current.gestures.map((gesture) =>
        gesture.id === id ? { ...gesture, actionId } : gesture,
      ),
    }));
  }, []);

  const toggleGesture = useCallback((id: GestureId) => {
    setState((current) => ({
      ...current,
      gestures: current.gestures.map((gesture) =>
        gesture.id === id ? { ...gesture, enabled: !gesture.enabled } : gesture,
      ),
    }));
  }, []);

  const addWorkspace = useCallback((profile: WorkspaceProfile) => {
    setState((current) => ({
      ...current,
      workspaces: [...current.workspaces, profile],
    }));
  }, []);

  const removeWorkspace = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.filter(
        (workspace) => workspace.id !== id || workspace.builtIn,
      ),
    }));
  }, []);

  const recordActivity = useCallback(
    (item: Omit<ActivityItem, 'id' | 'createdAt'>) => {
      setState((current) => ({
        ...current,
        activity: [
          {
            ...item,
            id: uniqueId('activity'),
            createdAt: new Date().toISOString(),
          },
          ...current.activity,
        ].slice(0, 30),
      }));
    },
    [],
  );

  const pushNotification = useCallback(
    (item: Pick<HubNotification, 'title' | 'detail' | 'tone'>) => {
      const notification: HubNotification = {
        ...item,
        id: uniqueId('notification'),
        createdAt: new Date().toISOString(),
        read: false,
      };
      setState((current) => ({
        ...current,
        notifications: [notification, ...current.notifications].slice(0, 50),
      }));
      return notification;
    },
    [],
  );

  const markNotificationsRead = useCallback(() => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((item) => ({ ...item, read: true })),
    }));
  }, []);

  const clearNotifications = useCallback(() => {
    setState((current) => ({ ...current, notifications: [] }));
  }, []);

  const value = useMemo<HubContextValue>(
    () => ({
      state,
      hydrated,
      selectedNoteId,
      setSelectedNoteId,
      createNote,
      createNotebook,
      createNoteSection,
      updateNote,
      deleteNote,
      updateSettings,
      updateGesture,
      toggleGesture,
      addWorkspace,
      removeWorkspace,
      recordActivity,
      pushNotification,
      markNotificationsRead,
      clearNotifications,
    }),
    [
      state,
      hydrated,
      selectedNoteId,
      createNote,
      createNotebook,
      createNoteSection,
      updateNote,
      deleteNote,
      updateSettings,
      updateGesture,
      toggleGesture,
      addWorkspace,
      removeWorkspace,
      recordActivity,
      pushNotification,
      markNotificationsRead,
      clearNotifications,
    ],
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub() {
  const context = useContext(HubContext);
  if (!context) throw new Error('useHub must be used inside HubProvider.');
  return context;
}
