import { describe, expect, it } from 'vitest';
import { DEFAULT_GESTURES } from '../data/defaults';
import { NAVIGATION } from '../navigation';
import { cycleSection, matchesShortcut, resolveGestureAction } from './gesture-engine';

describe('resolveGestureAction', () => {
  it('returns the configured action for an enabled gesture', () => {
    expect(resolveGestureAction(DEFAULT_GESTURES, 'double-pinch')).toBe('quick-note');
  });

  it('does not resolve disabled gestures', () => {
    const mappings = DEFAULT_GESTURES.map((gesture) =>
      gesture.id === 'pinch' ? { ...gesture, enabled: false } : gesture,
    );
    expect(resolveGestureAction(mappings, 'pinch')).toBeNull();
  });
});

describe('cycleSection', () => {
  it('wraps forwards and backwards through every navigation section', () => {
    expect(cycleSection(NAVIGATION.at(-1)!.id, 'next')).toBe(NAVIGATION[0].id);
    expect(cycleSection(NAVIGATION[0].id, 'previous')).toBe(NAVIGATION.at(-1)!.id);
  });
});

describe('matchesShortcut', () => {
  it('matches the exact modifier set and key', () => {
    const event = {
      key: '1',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent;
    expect(matchesShortcut(event, 'Ctrl+Shift+1')).toBe(true);
    expect(matchesShortcut(event, 'Ctrl+1')).toBe(false);
  });
});
