import { NAVIGATION } from '../navigation';
import type {
  GestureId,
  GestureMapping,
  HubActionId,
  HubSection,
} from '../types';

export const ACTION_LABELS: Record<HubActionId, string> = {
  'activate-focused': 'Activate focused item',
  'open-command-palette': 'Open command palette',
  'previous-section': 'Previous section',
  'next-section': 'Next section',
  'quick-note': 'Create quick note',
  'toggle-focus': 'Start / pause focus',
  'open-entertainment': 'Open entertainment',
  none: 'No action',
};

export function resolveGestureAction(
  mappings: GestureMapping[],
  gestureId: GestureId,
): HubActionId | null {
  const mapping = mappings.find((candidate) => candidate.id === gestureId);
  return mapping?.enabled ? mapping.actionId : null;
}

export function cycleSection(
  current: HubSection,
  direction: 'next' | 'previous',
): HubSection {
  const currentIndex = NAVIGATION.findIndex((item) => item.id === current);
  const offset = direction === 'next' ? 1 : -1;
  const nextIndex = (currentIndex + offset + NAVIGATION.length) % NAVIGATION.length;
  return NAVIGATION[nextIndex].id;
}

function normaliseShortcut(shortcut: string) {
  return shortcut
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string) {
  const parts = normaliseShortcut(shortcut);
  const key = parts.at(-1);
  if (!key) return false;

  return (
    event.key.toLowerCase() === key.toLowerCase() &&
    event.ctrlKey === parts.includes('ctrl') &&
    event.shiftKey === parts.includes('shift') &&
    event.altKey === parts.includes('alt') &&
    event.metaKey === parts.includes('meta')
  );
}
