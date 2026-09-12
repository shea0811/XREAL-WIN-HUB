import { describe, expect, it } from 'vitest';
import { createDefaultState, DEFAULT_SETTINGS, normaliseState } from './defaults';

const NOW = new Date('2026-09-12T10:00:00.000Z');

describe('createDefaultState', () => {
  it('creates independent mutable collections', () => {
    const first = createDefaultState(NOW);
    const second = createDefaultState(NOW);
    first.gestures[0].enabled = false;
    first.workspaces[0].targets[0].name = 'Changed';
    first.notebooks[0].name = 'Changed';

    expect(second.gestures[0].enabled).toBe(true);
    expect(second.workspaces[0].targets[0].name).toBe('ChatGPT');
    expect(second.notebooks[0].name).toBe('My notebook');
  });
});

describe('normaliseState', () => {
  it('falls back when the schema is missing or unsupported', () => {
    expect(normaliseState({ schemaVersion: 99 }, NOW).settings).toEqual(DEFAULT_SETTINGS);
    expect(normaliseState(null, NOW).notes[0].id).toBe('welcome-note');
  });

  it('merges new settings and gesture defaults into saved state', () => {
    const state = normaliseState(
      {
        schemaVersion: 1,
        notes: [],
        workspaces: [],
        activity: [],
        settings: { theme: 'light' },
        gestures: [{ id: 'pinch', actionId: 'none', enabled: true }],
      },
      NOW,
    );

    expect(state.settings).toEqual({ ...DEFAULT_SETTINGS, theme: 'light' });
    expect(state.gestures).toHaveLength(6);
    expect(state.gestures[0]).toMatchObject({ id: 'pinch', actionId: 'none', enabled: true });
    expect(state.schemaVersion).toBe(2);
    expect(state.notebooks[0].name).toBe('My notebook');
  });

  it('migrates v1 notes into the default notebook without losing content', () => {
    const state = normaliseState(
      {
        schemaVersion: 1,
        notes: [{ id: 'old-note', title: 'Existing note', body: 'Keep me', tags: ['saved'] }],
        workspaces: [],
        activity: [],
        settings: {},
        gestures: [],
      },
      NOW,
    );

    expect(state.notes[0]).toMatchObject({
      id: 'old-note',
      title: 'Existing note',
      body: 'Keep me',
      notebookId: 'personal-notebook',
      sectionId: 'quick-notes-section',
    });
  });

  it('recovers safely from malformed local collections', () => {
    const state = normaliseState(
      {
        schemaVersion: 1,
        notes: [null, { title: 42 }],
        workspaces: [{ name: 'Unsafe', targets: [{ url: 'javascript:alert(1)' }] }],
        activity: ['bad'],
        settings: { interfaceScale: 99, localOnly: false },
        gestures: [null, { id: 'pinch', actionId: 'unknown', enabled: 'yes' }],
      },
      NOW,
    );

    expect(state.notes).toHaveLength(1);
    expect(state.workspaces[0].targets).toEqual([]);
    expect(state.gestures[0].actionId).toBe('activate-focused');
    expect(state.settings.interfaceScale).toBe(1.2);
    expect(state.settings.localOnly).toBe(true);
  });
});
