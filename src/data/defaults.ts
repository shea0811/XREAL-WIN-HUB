import type {
  ActivityItem,
  GestureMapping,
  HubActionId,
  HubSettings,
  HubState,
  Note,
  ThemeMode,
  WorkspaceLayout,
  WorkspaceProfile,
} from '../types';
import { validWebUrl } from '../lib/format';

export const DEFAULT_SETTINGS: HubSettings = {
  theme: 'dark',
  interfaceScale: 1,
  reduceMotion: false,
  highContrast: false,
  preferredDisplayId: null,
  alwaysOnTop: false,
  launchAtLogin: false,
  localOnly: true,
};

export const DEFAULT_GESTURES: GestureMapping[] = [
  {
    id: 'pinch',
    name: 'Pinch',
    description: 'Activate the currently focused control.',
    actionId: 'activate-focused',
    shortcut: 'Ctrl+Shift+1',
    enabled: true,
  },
  {
    id: 'open-palm',
    name: 'Open palm',
    description: 'Open the hub command palette.',
    actionId: 'open-command-palette',
    shortcut: 'Ctrl+Shift+2',
    enabled: true,
  },
  {
    id: 'swipe-left',
    name: 'Swipe left',
    description: 'Move to the previous hub section.',
    actionId: 'previous-section',
    shortcut: 'Ctrl+Shift+3',
    enabled: true,
  },
  {
    id: 'swipe-right',
    name: 'Swipe right',
    description: 'Move to the next hub section.',
    actionId: 'next-section',
    shortcut: 'Ctrl+Shift+4',
    enabled: true,
  },
  {
    id: 'double-pinch',
    name: 'Double pinch',
    description: 'Create a new quick note.',
    actionId: 'quick-note',
    shortcut: 'Ctrl+Shift+5',
    enabled: true,
  },
  {
    id: 'fist',
    name: 'Closed fist',
    description: 'Start or pause the focus timer.',
    actionId: 'toggle-focus',
    shortcut: 'Ctrl+Shift+6',
    enabled: true,
  },
];

export const DEFAULT_WORKSPACES: WorkspaceProfile[] = [
  {
    id: 'study-session',
    name: 'Study session',
    description: 'Research, notes, and focused cybersecurity learning.',
    layout: 'split',
    accent: '#5ee5d5',
    builtIn: true,
    targets: [
      { id: 'study-chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com' },
      {
        id: 'study-mslearn',
        name: 'Microsoft Learn',
        url: 'https://learn.microsoft.com/training/',
      },
    ],
  },
  {
    id: 'cyber-lab',
    name: 'Cyber lab',
    description: 'Open your practical learning tools with minimal distraction.',
    layout: 'focus',
    accent: '#9d8cff',
    builtIn: true,
    targets: [
      { id: 'cyber-tryhackme', name: 'TryHackMe', url: 'https://tryhackme.com' },
      {
        id: 'cyber-mitre',
        name: 'MITRE ATT&CK',
        url: 'https://attack.mitre.org',
      },
    ],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    description: 'Move the hub to the glasses and open your media services.',
    layout: 'theatre',
    accent: '#ffb86b',
    builtIn: true,
    targets: [
      { id: 'media-youtube', name: 'YouTube', url: 'https://www.youtube.com' },
      { id: 'media-netflix', name: 'Netflix', url: 'https://www.netflix.com' },
    ],
  },
  {
    id: 'service-desk',
    name: 'Service desk',
    description: 'A clean launch point for Microsoft 365 support work.',
    layout: 'split',
    accent: '#65a9ff',
    builtIn: true,
    targets: [
      { id: 'desk-m365', name: 'Microsoft 365', url: 'https://www.office.com' },
      {
        id: 'desk-admin',
        name: 'Microsoft 365 Admin',
        url: 'https://admin.microsoft.com',
      },
    ],
  },
];

function welcomeNote(now: string): Note {
  return {
    id: 'welcome-note',
    title: 'Welcome to XREAL WIN HUB',
    body: [
      'This is your local command centre for XREAL-assisted work and entertainment.',
      '',
      'Start here:',
      '• Choose your XREAL display in Settings.',
      '• Launch a workspace for study, support work, or entertainment.',
      '• Configure and simulate gestures before a native hand-tracking bridge is connected.',
      '• Keep quick notes here without sending them to a cloud service.',
    ].join('\n'),
    tags: ['welcome', 'setup'],
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultState(date = new Date()): HubState {
  const now = date.toISOString();
  return {
    schemaVersion: 1,
    notes: [welcomeNote(now)],
    workspaces: structuredClone(DEFAULT_WORKSPACES),
    gestures: structuredClone(DEFAULT_GESTURES),
    settings: { ...DEFAULT_SETTINGS },
    activity: [
      {
        id: 'hub-ready',
        title: 'Hub ready',
        detail: 'Your local workspace has been initialised.',
        kind: 'system',
        createdAt: now,
      },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const THEMES: ThemeMode[] = ['system', 'dark', 'light'];
const LAYOUTS: WorkspaceLayout[] = ['focus', 'split', 'theatre'];
const ACTIONS: HubActionId[] = [
  'activate-focused',
  'open-command-palette',
  'previous-section',
  'next-section',
  'quick-note',
  'toggle-focus',
  'open-entertainment',
  'none',
];

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asDate(value: unknown, fallback: string) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : fallback;
}

function normaliseNotes(value: unknown, fallback: Note[], now: string): Note[] {
  if (!Array.isArray(value)) return fallback;
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const createdAt = asDate(item.createdAt, now);
    return [{
      id: asText(item.id, `recovered-note-${index}`),
      title: asText(item.title, 'Untitled note'),
      body: asText(item.body),
      tags: Array.isArray(item.tags)
        ? item.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 20)
        : [],
      createdAt,
      updatedAt: asDate(item.updatedAt, createdAt),
    }];
  });
}

function normaliseWorkspaces(
  value: unknown,
  fallback: WorkspaceProfile[],
): WorkspaceProfile[] {
  if (!Array.isArray(value)) return fallback;
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const targets = Array.isArray(item.targets)
      ? item.targets.flatMap((target, targetIndex) => {
          if (!isRecord(target) || !validWebUrl(asText(target.url))) return [];
          return [{
            id: asText(target.id, `target-${index}-${targetIndex}`),
            name: asText(target.name, 'Website'),
            url: asText(target.url),
          }];
        }).slice(0, 8)
      : [];
    const layout = LAYOUTS.includes(item.layout as WorkspaceLayout)
      ? item.layout as WorkspaceLayout
      : 'focus';
    const accent = typeof item.accent === 'string' && /^#[0-9a-f]{6}$/i.test(item.accent)
      ? item.accent
      : '#5ee5d5';
    return [{
      id: asText(item.id, `recovered-workspace-${index}`),
      name: asText(item.name, 'Recovered workspace'),
      description: asText(item.description, 'Recovered local workspace.'),
      layout,
      accent,
      targets,
      builtIn: item.builtIn === true,
    }];
  });
}

function normaliseGestures(value: unknown, fallback: GestureMapping[]) {
  if (!Array.isArray(value)) return fallback;
  return DEFAULT_GESTURES.map((defaultGesture) => {
    const saved = value.find(
      (gesture) => isRecord(gesture) && gesture.id === defaultGesture.id,
    );
    if (!isRecord(saved)) return { ...defaultGesture };
    return {
      ...defaultGesture,
      actionId: ACTIONS.includes(saved.actionId as HubActionId)
        ? saved.actionId as HubActionId
        : defaultGesture.actionId,
      enabled: typeof saved.enabled === 'boolean'
        ? saved.enabled
        : defaultGesture.enabled,
    };
  });
}

function normaliseSettings(value: unknown): HubSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };
  const scale = typeof value.interfaceScale === 'number' && Number.isFinite(value.interfaceScale)
    ? Math.min(1.2, Math.max(0.9, value.interfaceScale))
    : DEFAULT_SETTINGS.interfaceScale;
  return {
    theme: THEMES.includes(value.theme as ThemeMode)
      ? value.theme as ThemeMode
      : DEFAULT_SETTINGS.theme,
    interfaceScale: scale,
    reduceMotion: typeof value.reduceMotion === 'boolean' ? value.reduceMotion : false,
    highContrast: typeof value.highContrast === 'boolean' ? value.highContrast : false,
    preferredDisplayId: typeof value.preferredDisplayId === 'string'
      ? value.preferredDisplayId
      : null,
    alwaysOnTop: typeof value.alwaysOnTop === 'boolean' ? value.alwaysOnTop : false,
    launchAtLogin: typeof value.launchAtLogin === 'boolean' ? value.launchAtLogin : false,
    localOnly: true,
  };
}

function normaliseActivity(value: unknown, fallback: ActivityItem[], now: string) {
  if (!Array.isArray(value)) return fallback;
  return value.flatMap((item, index): ActivityItem[] => {
    if (!isRecord(item)) return [];
    const kinds: ActivityItem['kind'][] = ['device', 'workspace', 'note', 'gesture', 'system'];
    return [{
      id: asText(item.id, `recovered-activity-${index}`),
      title: asText(item.title, 'Activity'),
      detail: asText(item.detail),
      kind: kinds.includes(item.kind as ActivityItem['kind'])
        ? item.kind as ActivityItem['kind']
        : 'system',
      createdAt: asDate(item.createdAt, now),
    }];
  }).slice(0, 30);
}

export function normaliseState(value: unknown, date = new Date()): HubState {
  const fallback = createDefaultState(date);
  if (!isRecord(value) || value.schemaVersion !== 1) return fallback;

  const now = date.toISOString();
  return {
    schemaVersion: 1,
    notes: normaliseNotes(value.notes, fallback.notes, now),
    workspaces: normaliseWorkspaces(value.workspaces, fallback.workspaces),
    gestures: normaliseGestures(value.gestures, fallback.gestures),
    settings: normaliseSettings(value.settings),
    activity: normaliseActivity(value.activity, fallback.activity, now),
  };
}
