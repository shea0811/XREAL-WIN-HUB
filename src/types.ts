export type HubSection =
  | 'home'
  | 'device'
  | 'display-studio'
  | 'entertainment'
  | 'spotify'
  | 'youtube'
  | 'whatsapp'
  | 'discord'
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

export interface DisplayLayoutItem {
  id: string;
  deviceName: string;
  label: string;
  primary: boolean;
  internal: boolean;
  xreal: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleFactor: number;
}

export interface DisplayLayoutSnapshot {
  source: 'windows-native' | 'electron-fallback' | 'simulation' | 'browser-preview';
  canApply: boolean;
  capturedAt: string;
  displays: DisplayLayoutItem[];
  warning?: string;
}

export interface DisplayLayoutResult {
  success: boolean;
  requiresConfirmation: boolean;
  message: string;
  layout: DisplayLayoutSnapshot;
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
    encryptedStorage?: boolean;
  };
}

export interface WorkspaceLaunchResult {
  opened: number;
  moved: boolean;
}

export interface SpotifyAuthStatus {
  supported: boolean;
  configured: boolean;
  connected: boolean;
  clientId: string | null;
  accountName: string | null;
  product: string | null;
  redirectUri: string;
  message?: string;
}

export interface SpotifyPlaybackStatus {
  available: boolean;
  playing: boolean;
  title: string;
  detail: string;
  volume: number;
  artwork?: string;
  positionMs?: number;
  durationMs?: number;
  shuffle?: boolean;
  repeatMode?: 'off' | 'track' | 'context';
  deviceName?: string | null;
  deviceId?: string | null;
  message?: string;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  active: boolean;
  restricted: boolean;
  privateSession: boolean;
  volume: number | null;
}

export interface AudioSessionInfo {
  key: string;
  name: string;
  volume: number;
  muted: boolean;
  processId: number;
}

export interface AudioSnapshot {
  supported: boolean;
  masterVolume: number;
  sessions: AudioSessionInfo[];
  message?: string;
}

export interface SpotifyCatalogItem {
  id: string;
  uri: string;
  type: string;
  name: string;
  subtitle: string;
  imageUrl: string | null;
  durationMs: number;
  explicit: boolean;
}

export interface SpotifyCatalogSection {
  id: string;
  title: string;
  items: SpotifyCatalogItem[];
}

export interface SpotifyCatalogResult {
  sections?: SpotifyCatalogSection[];
  header?: SpotifyCatalogItem | null;
  items?: SpotifyCatalogItem[];
}

export interface WhatsAppStatus {
  supported: boolean;
  state: 'idle' | 'loading' | 'ready' | 'failed' | 'detached';
  canGoBack: boolean;
  canGoForward: boolean;
  detached: boolean;
  message?: string;
}

export type DiscordStatus = WhatsAppStatus;

export interface EmbeddedViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
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
  getDisplayLayout(): Promise<DisplayLayoutSnapshot>;
  previewDisplayLayout(displays: DisplayLayoutItem[]): Promise<DisplayLayoutResult>;
  confirmDisplayLayout(): Promise<boolean>;
  revertDisplayLayout(): Promise<DisplayLayoutSnapshot>;
  identifyDisplays(): Promise<boolean>;
  sendMediaKey(command: 'previous' | 'toggle' | 'next' | 'volume-up' | 'volume-down'): Promise<boolean>;
  getAudioSnapshot(): Promise<AudioSnapshot>;
  setMasterVolume(volume: number): Promise<AudioSnapshot>;
  setAudioSessionVolume(sessionKey: string, volume: number): Promise<AudioSnapshot>;
  getSpotifyAuthStatus(): Promise<SpotifyAuthStatus>;
  connectSpotify(clientId: string): Promise<SpotifyAuthStatus>;
  disconnectSpotify(): Promise<SpotifyAuthStatus>;
  playSpotifySource(source: string): Promise<boolean>;
  getSpotifyPlaybackStatus(): Promise<SpotifyPlaybackStatus>;
  getSpotifyDevices(): Promise<SpotifyDevice[]>;
  setSpotifyDevice(deviceId: string): Promise<SpotifyPlaybackStatus>;
  controlSpotify(command: 'previous' | 'toggle' | 'next' | 'volume' | 'seek' | 'shuffle' | 'repeat', value?: number | boolean | string): Promise<SpotifyPlaybackStatus>;
  getSpotifyCatalog(action: 'home' | 'search' | 'library' | 'collection', payload?: { query?: string; uri?: string }): Promise<SpotifyCatalogResult>;
  clearLocalData(): Promise<boolean>;
  getWhatsAppStatus(): Promise<WhatsAppStatus>;
  setWhatsAppEmbedded(visible: boolean, bounds?: EmbeddedViewBounds): Promise<WhatsAppStatus>;
  reloadWhatsApp(): Promise<WhatsAppStatus>;
  navigateWhatsApp(direction: 'back' | 'forward'): Promise<WhatsAppStatus>;
  detachWhatsApp(alwaysOnTop: boolean): Promise<WhatsAppStatus>;
  setWhatsAppAlwaysOnTop(enabled: boolean): Promise<boolean>;
  clearWhatsAppData(): Promise<WhatsAppStatus>;
  onWhatsAppStatus(callback: (status: WhatsAppStatus) => void): () => void;
  getDiscordStatus(): Promise<DiscordStatus>;
  setDiscordEmbedded(visible: boolean, bounds?: EmbeddedViewBounds): Promise<DiscordStatus>;
  reloadDiscord(): Promise<DiscordStatus>;
  navigateDiscord(direction: 'back' | 'forward'): Promise<DiscordStatus>;
  detachDiscord(alwaysOnTop: boolean): Promise<DiscordStatus>;
  setDiscordAlwaysOnTop(enabled: boolean): Promise<boolean>;
  clearDiscordData(): Promise<DiscordStatus>;
  onDiscordStatus(callback: (status: DiscordStatus) => void): () => void;
  onSystemSnapshot(callback: (snapshot: SystemSnapshot) => void): () => void;
}

declare global {
  interface Window {
    xrealHub?: XrealHubBridge;
  }
}
