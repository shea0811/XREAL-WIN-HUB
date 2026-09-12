import { useCallback, useEffect, useMemo, useState } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { NotificationCenter } from './components/NotificationCenter';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import {
  cycleSection,
  matchesShortcut,
  resolveGestureAction,
} from './lib/gesture-engine';
import { Dashboard } from './modules/Dashboard';
import { DeviceCenter } from './modules/DeviceCenter';
import { DisplayStudio } from './modules/DisplayStudio';
import { Entertainment } from './modules/Entertainment';
import { Gestures } from './modules/Gestures';
import { Notes } from './modules/Notes';
import { Workspaces } from './modules/Workspaces';
import { Agents } from './modules/Agents';
import { Settings } from './modules/Settings';
import { platform } from './services/platform';
import { useHub } from './state/HubContext';
import type {
  GestureId,
  HubActionId,
  HubSection,
  SystemSnapshot,
} from './types';

interface ToastState {
  id: number;
  message: string;
  detail?: string;
  tone: 'success' | 'info';
}

export default function App() {
  const {
    state,
    hydrated,
    createNote,
    recordActivity,
    updateSettings,
    pushNotification,
    markNotificationsRead,
    clearNotifications,
  } = useHub();
  const [activeSection, setActiveSection] = useState<HubSection>(() =>
    window.location.hash === '#display-studio' ? 'display-studio' : 'home',
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  const showToast = useCallback((message: string, detail?: string) => {
    const tone = detail?.toLowerCase().includes('unavailable') ? 'info' : 'success';
    pushNotification({ title: message, detail, tone });
    setToast({ id: Date.now(), message, detail, tone });
  }, [pushNotification]);

  const toggleNotifications = useCallback(() => {
    setNotificationCenterOpen((open) => {
      if (!open) markNotificationsRead();
      return !open;
    });
  }, [markNotificationsRead]);

  useEffect(() => {
    let active = true;
    void platform.getSystemSnapshot()
      .then((value) => {
        if (active) setSnapshot(value);
      })
      .catch(() => {
        if (active) showToast('Device service unavailable', 'The hub will continue with local features.');
      });
    const unsubscribe = platform.onSystemSnapshot((value) => setSnapshot(value));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [showToast]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = state.settings.theme;
    root.dataset.contrast = String(state.settings.highContrast);
    root.dataset.reduceMotion = String(state.settings.reduceMotion);
    root.style.setProperty('--interface-scale', String(state.settings.interfaceScale));
  }, [state.settings]);

  const targetDisplayId = useMemo(
    () => state.settings.preferredDisplayId ?? snapshot?.xreal.displayId ?? null,
    [snapshot?.xreal.displayId, state.settings.preferredDisplayId],
  );

  const navigate = useCallback((section: HubSection) => {
    setActiveSection(section);
    setPaletteOpen(false);
  }, []);

  const quickNote = useCallback(() => {
    createNote();
    recordActivity({
      kind: 'note',
      title: 'Quick note created',
      detail: 'Opened a blank local note.',
    });
    navigate('notes');
    showToast('Quick note ready');
  }, [createNote, navigate, recordActivity, showToast]);

  const moveToDisplay = useCallback(async () => {
    if (!targetDisplayId) {
      navigate('settings');
      showToast('Choose a display first', 'Select the XREAL display under Settings.');
      return;
    }
    const moved = await platform.moveToDisplay(targetDisplayId);
    if (moved) {
      const display = snapshot?.displays.find((item) => item.id === targetDisplayId);
      recordActivity({
        kind: 'device',
        title: 'Hub moved to display',
        detail: display?.label ?? 'Preferred display',
      });
      showToast('Hub moved', display?.label);
    } else {
      showToast('Display movement needs the Windows app', 'The browser preview cannot move its own window.');
    }
  }, [navigate, recordActivity, showToast, snapshot?.displays, targetDisplayId]);

  const enterTheatre = useCallback(async () => {
    try {
      const enabled = await platform.setTheatreMode(true, targetDisplayId);
      if (enabled) showToast('Theatre mode enabled');
    } catch {
      showToast('Theatre mode was unavailable');
    }
  }, [showToast, targetDisplayId]);

  const toggleFocus = useCallback(() => {
    if (activeSection !== 'home') setActiveSection('home');
    window.setTimeout(() => {
      window.dispatchEvent(new Event('hub:focus-toggle'));
    }, activeSection === 'home' ? 0 : 60);
    showToast('Focus timer toggled');
  }, [activeSection, showToast]);

  const executeAction = useCallback(
    (action: HubActionId) => {
      switch (action) {
        case 'activate-focused': {
          const focused = document.activeElement;
          if (focused instanceof HTMLElement) focused.click();
          break;
        }
        case 'open-command-palette':
          setPaletteOpen(true);
          break;
        case 'previous-section':
          setActiveSection((section) => cycleSection(section, 'previous'));
          break;
        case 'next-section':
          setActiveSection((section) => cycleSection(section, 'next'));
          break;
        case 'quick-note':
          quickNote();
          break;
        case 'toggle-focus':
          toggleFocus();
          break;
        case 'open-entertainment':
          navigate('entertainment');
          break;
        case 'none':
          break;
      }
    },
    [navigate, quickNote, toggleFocus],
  );

  const simulateGesture = useCallback(
    (gestureId: GestureId) => {
      const action = resolveGestureAction(state.gestures, gestureId);
      const gesture = state.gestures.find((mapping) => mapping.id === gestureId);
      if (!action) {
        showToast(`${gesture?.name ?? 'Gesture'} is disabled`);
        return;
      }
      recordActivity({
        kind: 'gesture',
        title: `${gesture?.name ?? 'Gesture'} simulated`,
        detail: `Action: ${action}.`,
      });
      executeAction(action);
      showToast(`${gesture?.name ?? 'Gesture'} recognised`, 'Simulation input executed.');
    },
    [executeAction, recordActivity, showToast, state.gestures],
  );

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }

      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const mapping = state.gestures.find(
        (gesture) => gesture.enabled && matchesShortcut(event, gesture.shortcut),
      );
      if (mapping) {
        event.preventDefault();
        simulateGesture(mapping.id);
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [simulateGesture, state.gestures]);

  async function refreshSnapshot() {
    setRefreshing(true);
    try {
      setSnapshot(await platform.getSystemSnapshot());
      showToast('Device list refreshed');
    } catch {
      showToast('Could not refresh displays', 'Reconnect the glasses or restart the app.');
    } finally {
      window.setTimeout(() => setRefreshing(false), 250);
    }
  }

  async function toggleSimulation(enabled: boolean) {
    try {
      const previousDisplayId = snapshot?.xreal.displayId;
      const value = await platform.setSimulationMode(enabled);
      setSnapshot(value);
      if (enabled && value.xreal.displayId) {
        updateSettings({ preferredDisplayId: value.xreal.displayId });
      } else if (previousDisplayId && state.settings.preferredDisplayId === previousDisplayId) {
        updateSettings({ preferredDisplayId: null });
      }
      recordActivity({
        kind: 'device',
        title: enabled ? 'One Pro simulator connected' : 'One Pro simulator disconnected',
        detail: enabled
          ? 'A safe 1920 × 1080 virtual display is active for feature testing.'
          : 'Returned to Windows display discovery.',
      });
      showToast(enabled ? 'Simulated One Pro connected' : 'Simulator disconnected');
    } catch {
      showToast('Could not change simulation mode', 'Restart the app and try again.');
    }
  }

  const page = (() => {
    switch (activeSection) {
      case 'home':
        return (
          <Dashboard
            snapshot={snapshot}
            onNavigate={navigate}
            onOpenPalette={() => setPaletteOpen(true)}
            onMoveToDisplay={() => void moveToDisplay()}
          />
        );
      case 'device':
        return (
          <DeviceCenter
            snapshot={snapshot}
            refreshing={refreshing}
            onRefresh={() => void refreshSnapshot()}
            onMoveToDisplay={() => void moveToDisplay()}
            onTheatre={() => void enterTheatre()}
            onToggleSimulation={(enabled) => void toggleSimulation(enabled)}
          />
        );
      case 'display-studio':
        return <DisplayStudio snapshot={snapshot} onToast={showToast} />;
      case 'entertainment':
        return <Entertainment snapshot={snapshot} onToast={showToast} />;
      case 'notes':
        return <Notes onToast={showToast} />;
      case 'workspaces':
        return <Workspaces snapshot={snapshot} onToast={showToast} />;
      case 'gestures':
        return <Gestures snapshot={snapshot} onSimulate={simulateGesture} />;
      case 'agents':
        return <Agents onToast={showToast} />;
      case 'settings':
        return <Settings snapshot={snapshot} onToast={showToast} />;
    }
  })();

  return (
    <div className="app-shell" data-ready={hydrated}>
      <Sidebar
        activeSection={activeSection}
        collapsed={sidebarCollapsed}
        onNavigate={navigate}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />
      <div className="app-main">
        <TopBar
          section={activeSection}
          snapshot={snapshot}
          preferredDisplayId={state.settings.preferredDisplayId}
          onOpenPalette={() => setPaletteOpen(true)}
          unreadNotifications={state.notifications.filter((item) => !item.read).length}
          notificationCenterOpen={notificationCenterOpen}
          onToggleNotifications={toggleNotifications}
          onHelp={() => navigate('device')}
        />
        <main className="content-scroll" tabIndex={-1}>{page}</main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
        onQuickNote={quickNote}
        onTheatre={() => void enterTheatre()}
        onMoveToDisplay={() => void moveToDisplay()}
        onFocus={toggleFocus}
      />

      <NotificationCenter
        open={notificationCenterOpen}
        notifications={state.notifications}
        onClose={() => setNotificationCenterOpen(false)}
        onMarkRead={markNotificationsRead}
        onClear={clearNotifications}
      />

      {toast ? (
        <Toast
          key={toast.id}
          toast={{ id: toast.id, title: toast.message, detail: toast.detail, tone: toast.tone }}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
