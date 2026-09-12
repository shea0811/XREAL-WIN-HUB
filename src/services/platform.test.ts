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
});
