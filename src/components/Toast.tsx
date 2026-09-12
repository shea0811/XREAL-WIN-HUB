import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  title: string;
  detail?: string;
  tone?: 'success' | 'info';
}

export function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss(): void }) {
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(5_000);
  const startedAt = useRef(Date.now());
  const exitTimer = useRef<number | null>(null);
  const dismissTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
  }, []);

  const schedule = useCallback(() => {
    clearTimers();
    startedAt.current = Date.now();
    exitTimer.current = window.setTimeout(
      () => setExiting(true),
      Math.max(0, remaining.current - 850),
    );
    dismissTimer.current = window.setTimeout(onDismiss, remaining.current);
  }, [clearTimers, onDismiss]);

  useEffect(() => {
    schedule();
    return clearTimers;
  }, [clearTimers, schedule]);

  function pause() {
    if (paused || exiting) return;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    clearTimers();
    setPaused(true);
  }

  function resume() {
    if (!paused || exiting) return;
    setPaused(false);
    schedule();
  }

  return (
    <div
      className="toast"
      role="status"
      data-exiting={exiting}
      data-paused={paused}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <span className="toast__icon" data-tone={toast.tone ?? 'success'}>
        {toast.tone === 'info' ? <Info size={18} /> : <CheckCircle2 size={18} />}
      </span>
      <span>
        <strong>{toast.title}</strong>
        {toast.detail ? <small>{toast.detail}</small> : null}
      </span>
      <button onClick={onDismiss} aria-label="Dismiss notification">
        <X size={16} />
      </button>
      <span className="toast__lifetime" aria-hidden />
      <span className="toast__dust" aria-hidden>
        {Array.from({ length: 20 }, (_, index) => <i key={index} style={{ '--dust-index': index } as CSSProperties} />)}
      </span>
    </div>
  );
}
