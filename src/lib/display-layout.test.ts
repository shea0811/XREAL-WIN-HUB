import { describe, expect, it } from 'vitest';
import {
  fitDisplayLayout,
  layoutsEqual,
  moveDisplay,
  setPrimaryDisplay,
  validateDisplayLayout,
} from './display-layout';
import type { DisplayLayoutItem } from '../types';

const displays: DisplayLayoutItem[] = [
  {
    id: 'one',
    deviceName: '\\\\.\\DISPLAY1',
    label: 'Laptop display',
    primary: true,
    internal: true,
    xreal: false,
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    rotation: 0,
    scaleFactor: 1,
  },
  {
    id: 'two',
    deviceName: '\\\\.\\DISPLAY2',
    label: 'XREAL One Pro',
    primary: false,
    internal: false,
    xreal: true,
    x: 1920,
    y: 0,
    width: 1920,
    height: 1080,
    rotation: 0,
    scaleFactor: 1,
  },
];

describe('display layout engine', () => {
  it('validates a safe topology and rejects ambiguous primaries', () => {
    expect(validateDisplayLayout(displays)).toBeNull();
    expect(validateDisplayLayout(displays.map((display) => ({ ...display, primary: true }))))
      .toContain('Exactly one');
  });

  it('snaps a dragged display to an adjacent display edge', () => {
    const moved = moveDisplay(displays, 'two', 1_875, 34);
    expect(moved[1]).toMatchObject({ x: 1920, y: 0 });
  });

  it('moves the desktop origin when the primary display changes', () => {
    const changed = setPrimaryDisplay(displays, 'two');
    expect(changed[1]).toMatchObject({ primary: true, x: 0, y: 0 });
    expect(changed[0]).toMatchObject({ primary: false, x: -1920, y: 0 });
  });

  it('fits the complete topology inside a stage', () => {
    const frame = fitDisplayLayout(displays, 1_000, 500);
    expect(frame.scale).toBeGreaterThan(0);
    expect(frame.width).toBe(3840);
    expect(frame.height).toBe(1080);
  });

  it('compares only position and primary state for dirty tracking', () => {
    expect(layoutsEqual(displays, structuredClone(displays))).toBe(true);
    expect(layoutsEqual(displays, moveDisplay(displays, 'two', 2500, 0))).toBe(false);
  });
});
