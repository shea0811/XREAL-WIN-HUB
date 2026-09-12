/**
 * @vitest-environment jsdom
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from './Toast';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('Toast', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  it('enters the dissolve phase and dismisses after five seconds', () => {
    const onDismiss = vi.fn();
    act(() => root.render(<Toast toast={{ id: 1, title: 'Ready' }} onDismiss={onDismiss} />));

    act(() => vi.advanceTimersByTime(4_150));
    expect(container.querySelector('.toast')?.getAttribute('data-exiting')).toBe('true');
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(850));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('pauses automatic dismissal while hovered', () => {
    const onDismiss = vi.fn();
    act(() => root.render(<Toast toast={{ id: 1, title: 'Ready' }} onDismiss={onDismiss} />));
    const toast = container.querySelector('.toast');

    act(() => {
      vi.advanceTimersByTime(2_000);
      toast?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      vi.advanceTimersByTime(5_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      toast?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      vi.advanceTimersByTime(3_000);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
