/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platform } from './platform';

describe('browser platform bridge', () => {
  beforeEach(async () => {
    await platform.setSimulationMode(false);
    localStorage.clear();
  });

  it('emits a complete simulated One Pro snapshot', async () => {
    const listener = vi.fn();
    const unsubscribe = platform.onSystemSnapshot(listener);

    const snapshot = await platform.setSimulationMode(true);

    expect(snapshot.xreal).toMatchObject({
      connection: 'display-detected',
      deviceName: 'XREAL One Pro (simulated)',
      inputSource: 'simulation',
      simulated: true,
    });
    expect(snapshot.displays).toHaveLength(2);
    expect(snapshot.displays.at(-1)?.size).toEqual({ width: 1920, height: 1080 });
    expect(listener).toHaveBeenCalledWith(snapshot);
    await expect(platform.moveToDisplay(snapshot.xreal.displayId!)).resolves.toBe(true);

    unsubscribe();
    await platform.setSimulationMode(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('persists state locally and rejects unsafe external URLs', async () => {
    const snapshot = await platform.getSystemSnapshot();
    expect(snapshot.xreal.simulated).toBe(false);

    await expect(platform.openExternal('javascript:alert(1)')).resolves.toBe(false);
    await expect(platform.moveToDisplay('missing-display')).resolves.toBe(false);
  });

  it('previews, confirms, and restores simulated display layouts', async () => {
    await platform.setSimulationMode(true);
    const original = await platform.getDisplayLayout();
    expect(original.source).toBe('simulation');
    expect(original.canApply).toBe(true);

    const proposed = original.displays.map((display) =>
      display.xreal ? { ...display, x: -1920, y: 120 } : display,
    );
    const preview = await platform.previewDisplayLayout(proposed);
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.layout.displays.find((display) => display.xreal)).toMatchObject({ x: -1920, y: 120 });

    const restored = await platform.revertDisplayLayout();
    expect(restored.displays.find((display) => display.xreal)?.x).toBeGreaterThanOrEqual(1280);

    await platform.previewDisplayLayout(proposed);
    await expect(platform.confirmDisplayLayout()).resolves.toBe(true);
    expect((await platform.getDisplayLayout()).displays.find((display) => display.xreal)?.x).toBe(-1920);
  });
});
