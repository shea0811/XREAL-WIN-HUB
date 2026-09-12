export type HubSection =
  | 'home'
  | 'device'
  | 'entertainment'
  | 'notes'
  | 'workspaces'
  | 'gestures'
  | 'agents'
  | 'settings';

export type ThemeMode = 'system' | 'dark' | 'light';
export type WorkspaceLayout = 'focus' | 'split' | 'theatre';
export type XrealConnection = 'display-detected' | 'not-detected';
export type GestureId =
  | 'pinch'
  | 'open-palm'
  | 'swipe-left'
  | 'swipe-right'
  | 'double-pinch'
  | 'fist';

export type HubActionId =
  | 'activate-focused'
  | 'open-command-palette'
  | 'previous-section'
  | 'next-section'
  | 'quick-note'
  | 'toggle-focus'
  | 'open-entertainment'
  | 'none';

export interface Note {
  id: string;
  notebookId: string;
  sectionId: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Notebook {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface NoteSection {
  id: string;
  notebookId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface HubNotification {
  id: string;
  title: string;
  detail?: string;
  tone: 'success' | 'info';
  createdAt: string;
  read: boolean;
}

export interface LaunchTarget {
  id: string;
  name: string;
  url: string;
}

export interface WorkspaceProfile {
  id: string;
  name: string;
  description: string;
  layout: WorkspaceLayout;
  accent: string;
  targets: LaunchTarget[];
  builtIn?: boolean;
}

export interface GestureMapping {
  id: GestureId;
  name: string;
  description: string;
  actionId: HubActionId;
  shortcut: string;
  enabled: boolean;
}

export interface HubSettings {
  theme: ThemeMode;
  interfaceScale: number;
  reduceMotion: boolean;
  highContrast: boolean;
  preferredDisplayId: string | null;
  alwaysOnTop: boolean;
  launchAtLogin: boolean;
  localOnly: boolean;
}

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  kind: 'device' | 'workspace' | 'note' | 'gesture' | 'system';
  createdAt: string;
}

export interface HubState {
  schemaVersion: 2;
  notebooks: Notebook[];
  noteSections: NoteSection[];
  notes: Note[];
  notifications: HubNotification[];
  workspaces: WorkspaceProfile[];
  gestures: GestureMapping[];
  settings: HubSettings;
  activity: ActivityItem[];
}

export interface DisplayInfo {
  id: string;
  label: string;
  primary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  scaleFactor: number;
  rotation: number;
}

export interface SystemSnapshot {
  appVersion: string;
  platform: string;
  isElectron: boolean;
  updatedAt: string;
  displays: DisplayInfo[];
  xreal: {
    connection: XrealConnection;
    displayId: string | null;
    deviceName: string | null;
    inputSource: 'simulation' | 'windows-display' | 'native-bridge';
    simulated: boolean;
    capabilities: {
      displayPlacement: boolean;
      theatreMode: boolean;
      handTracking: boolean;
      spatialTracking: boolean;
      hardwareControls: boolean;
    };
  };
  privacy: {
    telemetry: boolean;
    localStorage: boolean;
  };
}

export interface WorkspaceLaunchResult {
  opened: number;
  moved: boolean;
}

export interface XrealHubBridge {
  loadState(): Promise<unknown>;
  saveState(state: HubState): Promise<boolean>;
  getSystemSnapshot(): Promise<SystemSnapshot>;
  openExternal(url: string): Promise<boolean>;
  launchWorkspace(
    profile: WorkspaceProfile,
    displayId?: string | null,
  ): Promise<WorkspaceLaunchResult>;
  moveToDisplay(displayId: string): Promise<boolean>;
  setTheatreMode(enabled: boolean, displayId?: string | null): Promise<boolean>;
  setAlwaysOnTop(enabled: boolean): Promise<boolean>;
  setLaunchAtLogin(enabled: boolean): Promise<boolean>;
  setSimulationMode(enabled: boolean): Promise<SystemSnapshot>;
  onSystemSnapshot(callback: (snapshot: SystemSnapshot) => void): () => void;
}

declare global {
  interface Window {
    xrealHub?: XrealHubBridge;
  }
}
