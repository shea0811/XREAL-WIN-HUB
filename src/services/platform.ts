import { createDefaultState, normaliseState } from '../data/defaults';
import { validateDisplayLayout } from '../lib/display-layout';
import { validWebUrl } from '../lib/format';
import type {
  DisplayLayoutItem,
  DisplayLayoutSnapshot,
  HubState,
  SystemSnapshot,
  WorkspaceLaunchResult,
  WorkspaceProfile,
  XrealHubBridge,
} from '../types';

const STORAGE_KEY = 'xreal-win-hub:state';
const SIMULATED_DISPLAY_ID = 'xreal-one-pro-simulated';
let browserSimulationEnabled = false;
let browserLayoutOverride: DisplayLayoutItem[] | null = null;
let browserPendingLayout: DisplayLayoutItem[] | null = null;
const browserSnapshotListeners = new Set<(snapshot: SystemSnapshot) => void>();
const browserWhatsAppListeners = new Set<Parameters<XrealHubBridge['onWhatsAppStatus']>[0]>();
const browserWhatsAppStatus = {
  supported: false,
  state: 'idle' as const,
  canGoBack: false,
  canGoForward: false,
  detached: false,
  message: 'WhatsApp Web is available in the installed Windows app.',
};

function browserSnapshot(): SystemSnapshot {
  const screenWidth = Math.max(1280, window.screen.width);
  const screenHeight = Math.max(720, window.screen.height);
  const primaryDisplay = {
    id: 'browser-primary',
    label: 'Browser preview display',
    primary: true,
    bounds: {
      x: 0,
      y: 0,
      width: screenWidth,
      height: screenHeight,
    },
    workArea: {
      x: 0,
      y: 0,
      width: Math.max(1280, window.screen.availWidth),
      height: Math.max(680, window.screen.availHeight),
    },
    size: { width: screenWidth, height: screenHeight },
    scaleFactor: window.devicePixelRatio,
    rotation: 0,
  };
  const simulatedDisplay = {
    ...primaryDisplay,
    id: SIMULATED_DISPLAY_ID,
    label: 'XREAL One Pro (simulated)',
    primary: false,
    size: { width: 1920, height: 1080 },
    bounds: { x: screenWidth, y: 0, width: 1920, height: 1080 },
    workArea: { x: screenWidth, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1,
  };
  return {
    appVersion: 'web-preview',
    platform: navigator.platform || 'browser',
    isElectron: false,
    updatedAt: new Date().toISOString(),
    displays: browserSimulationEnabled
      ? [primaryDisplay, simulatedDisplay]
      : [primaryDisplay],
    xreal: {
      connection: browserSimulationEnabled ? 'display-detected' : 'not-detected',
      displayId: browserSimulationEnabled ? SIMULATED_DISPLAY_ID : null,
      deviceName: browserSimulationEnabled ? simulatedDisplay.label : null,
      inputSource: 'simulation',
      simulated: browserSimulationEnabled,
      capabilities: {
        displayPlacement: false,
        theatreMode: true,
        handTracking: false,
        spatialTracking: false,
        hardwareControls: false,
      },
    },
    privacy: { telemetry: false, localStorage: true, encryptedStorage: false },
  };
}

function browserDisplayLayout(): DisplayLayoutSnapshot {
  const snapshot = browserSnapshot();
  const displays = snapshot.displays.map((display, index) => ({
    id: display.id,
    deviceName: display.id,
    label: display.label || `Display ${index + 1}`,
    primary: display.primary,
    internal: index === 0,
    xreal: display.id === snapshot.xreal.displayId,
    x: display.bounds.x,
    y: display.bounds.y,
    width: Math.max(1280, display.size.width),
    height: Math.max(720, display.size.height),
    rotation: display.rotation,
    scaleFactor: display.scaleFactor,
  }));
  return {
    source: browserSimulationEnabled ? 'simulation' : 'browser-preview',
    canApply: true,
    capturedAt: new Date().toISOString(),
    displays: browserLayoutOverride
      ? displays.map((display) => browserLayoutOverride?.find((item) => item.id === display.id) ?? display)
      : displays,
    warning: browserSimulationEnabled
      ? 'Simulator mode: layout changes are visual only and do not alter Windows.'
      : 'Browser preview: test the editor here, then use the Windows app to change real displays.',
  };
}

const browserBridge: XrealHubBridge = {
  async loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  },
  async saveState(state: HubState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  },
  async getSystemSnapshot() {
    return browserSnapshot();
  },
  async openExternal(url: string) {
    if (!validWebUrl(url)) return false;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    return Boolean(opened);
  },
  async launchWorkspace(profile: WorkspaceProfile): Promise<WorkspaceLaunchResult> {
    let opened = 0;
    for (const target of profile.targets.slice(0, 8)) {
      if (!validWebUrl(target.url)) continue;
      if (window.open(target.url, '_blank', 'noopener,noreferrer')) opened += 1;
    }
    return { opened, moved: false };
  },
  async moveToDisplay(displayId: string) {
    return browserSimulationEnabled && displayId === SIMULATED_DISPLAY_ID;
  },
  async setTheatreMode(enabled: boolean) {
    if (enabled && !document.fullscreenElement) {
      if (!document.documentElement.requestFullscreen) return false;
      await document.documentElement.requestFullscreen();
    } else if (!enabled && document.fullscreenElement) {
      if (!document.exitFullscreen) return false;
      await document.exitFullscreen();
    }
    return true;
  },
  async setAlwaysOnTop() {
    return false;
  },
  async setLaunchAtLogin() {
    return false;
  },
  async setSimulationMode(enabled: boolean) {
    browserSimulationEnabled = enabled;
    browserLayoutOverride = null;
    browserPendingLayout = null;
    const snapshot = browserSnapshot();
    browserSnapshotListeners.forEach((listener) => listener(snapshot));
    return snapshot;
  },
  async getDisplayLayout() {
    return browserDisplayLayout();
  },
  async previewDisplayLayout(displays: DisplayLayoutItem[]) {
    const error = validateDisplayLayout(displays);
    if (error) throw new Error(error);
    const current = browserDisplayLayout();
    if (displays.length !== current.displays.length) throw new Error('The connected display list changed.');
    browserPendingLayout = current.displays.map((display) => ({ ...display }));
    browserLayoutOverride = displays.map((display) => ({ ...display }));
    return {
      success: true,
      requiresConfirmation: true,
      message: browserSimulationEnabled
        ? 'Simulated layout preview is active.'
        : 'Browser layout preview is active.',
      layout: browserDisplayLayout(),
    };
  },
  async confirmDisplayLayout() {
    if (!browserPendingLayout) return false;
    browserPendingLayout = null;
    return true;
  },
  async revertDisplayLayout() {
    if (browserPendingLayout) browserLayoutOverride = browserPendingLayout;
    browserPendingLayout = null;
    return browserDisplayLayout();
  },
  async identifyDisplays() {
    return true;
  },
  async sendMediaKey() {
    return false;
  },
  async getSpotifyAuthStatus() {
    return {
      supported: false,
      configured: false,
      connected: false,
      clientId: null,
      accountName: null,
      product: null,
      redirectUri: 'http://127.0.0.1/callback',
      message: 'Spotify Premium sign-in is available in the installed Windows app.',
    };
  },
  async connectSpotify() {
    return this.getSpotifyAuthStatus();
  },
  async disconnectSpotify() {
    return this.getSpotifyAuthStatus();
  },
  async playSpotifySource() {
    return false;
  },
  async getSpotifyPlaybackStatus() {
    return { available: false, playing: false, title: 'Spotify', detail: 'Not connected', volume: 50 };
  },
  async controlSpotify() {
    return this.getSpotifyPlaybackStatus();
  },
  async clearLocalData() {
    localStorage.clear();
    return true;
  },
  async getWhatsAppStatus() {
    return browserWhatsAppStatus;
  },
  async setWhatsAppEmbedded() {
    return browserWhatsAppStatus;
  },
  async reloadWhatsApp() {
    return browserWhatsAppStatus;
  },
  async navigateWhatsApp() {
    return browserWhatsAppStatus;
  },
  async detachWhatsApp() {
    return browserWhatsAppStatus;
  },
  async setWhatsAppAlwaysOnTop() {
    return false;
  },
  async clearWhatsAppData() {
    return browserWhatsAppStatus;
  },
  onWhatsAppStatus(callback) {
    browserWhatsAppListeners.add(callback);
    return () => browserWhatsAppListeners.delete(callback);
  },
  onSystemSnapshot(callback) {
    browserSnapshotListeners.add(callback);
    return () => browserSnapshotListeners.delete(callback);
  },
};

export const platform: XrealHubBridge = window.xrealHub ?? browserBridge;

export async function loadHubState(): Promise<HubState> {
  try {
    return normaliseState(await platform.loadState());
  } catch {
    return createDefaultState();
  }
}
