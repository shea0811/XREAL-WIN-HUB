import { createDefaultState, normaliseState } from '../data/defaults';
import { validWebUrl } from '../lib/format';
import type {
  HubState,
  SystemSnapshot,
  WorkspaceLaunchResult,
  WorkspaceProfile,
  XrealHubBridge,
} from '../types';

const STORAGE_KEY = 'xreal-win-hub:state';
const SIMULATED_DISPLAY_ID = 'xreal-one-pro-simulated';
let browserSimulationEnabled = false;
const browserSnapshotListeners = new Set<(snapshot: SystemSnapshot) => void>();

function browserSnapshot(): SystemSnapshot {
  const primaryDisplay = {
    id: 'browser-primary',
    label: 'Browser preview display',
    primary: true,
    bounds: {
      x: 0,
      y: 0,
      width: window.screen.width,
      height: window.screen.height,
    },
    workArea: {
      x: 0,
      y: 0,
      width: window.screen.availWidth,
      height: window.screen.availHeight,
    },
    size: { width: window.screen.width, height: window.screen.height },
    scaleFactor: window.devicePixelRatio,
    rotation: 0,
  };
  const simulatedDisplay = {
    ...primaryDisplay,
    id: SIMULATED_DISPLAY_ID,
    label: 'XREAL One Pro (simulated)',
    primary: false,
    size: { width: 1920, height: 1080 },
    bounds: { x: window.screen.width, y: 0, width: 1920, height: 1080 },
    workArea: { x: window.screen.width, y: 0, width: 1920, height: 1040 },
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
    privacy: { telemetry: false, localStorage: true },
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
    const snapshot = browserSnapshot();
    browserSnapshotListeners.forEach((listener) => listener(snapshot));
    return snapshot;
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
