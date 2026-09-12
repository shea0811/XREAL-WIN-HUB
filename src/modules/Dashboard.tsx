import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CirclePause,
  CirclePlay,
  Clock3,
  Glasses,
  Hand,
  NotebookPen,
  PanelsTopLeft,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useHub } from '../state/HubContext';
import type { HubSection, SystemSnapshot } from '../types';
import { formatDuration } from '../lib/format';
import { Button, SectionHeading, StatusPill } from '../components/ui';

const FOCUS_SECONDS = 25 * 60;

export function Dashboard({
  snapshot,
  onNavigate,
  onOpenPalette,
  onMoveToDisplay,
}: {
  snapshot: SystemSnapshot | null;
  onNavigate(section: HubSection): void;
  onOpenPalette(): void;
  onMoveToDisplay(): void;
}) {
  const { state } = useHub();
  const [remaining, setRemaining] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const selectedDisplay = snapshot?.displays.find(
    (display) => display.id === state.settings.preferredDisplayId,
  );
  const detectedDisplay = snapshot?.displays.find(
    (display) => display.id === snapshot.xreal.displayId,
  );
  const activeDisplay = detectedDisplay ?? selectedDisplay;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    const toggle = () => setRunning((value) => !value);
    window.addEventListener('hub:focus-toggle', toggle);
    return () => window.removeEventListener('hub:focus-toggle', toggle);
  }, []);

  const progress = useMemo(
    () => ((FOCUS_SECONDS - remaining) / FOCUS_SECONDS) * 100,
    [remaining],
  );

  const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening';

  return (
    <div className="module-page dashboard-page">
      <SectionHeading
        eyebrow="Command centre"
        title={`Good ${timeOfDay}.`}
        description="Everything you need for the glasses, your workspaces, and the task in front of you."
        actions={
          <Button variant="primary" onClick={onOpenPalette}>
            <Sparkles size={17} /> Quick command
          </Button>
        }
      />

      <section className="hero-grid">
        <article className="hero-card device-hero">
          <div className="hero-card__glow" aria-hidden />
          <div className="hero-card__topline">
            <span className="icon-chip icon-chip--teal">
              <Glasses size={22} />
            </span>
            <StatusPill tone={activeDisplay ? 'positive' : 'warning'}>
              <span className="status-dot" />
              {activeDisplay ? 'Display ready' : 'Awaiting display'}
            </StatusPill>
          </div>
          <div className="hero-card__body">
            <span className="card-kicker">XREAL connection</span>
            <h2>{activeDisplay?.label ?? 'Connect your One Pro'}</h2>
            <p>
              {activeDisplay
                ? `${activeDisplay.size.width} × ${activeDisplay.size.height} at ${activeDisplay.scaleFactor}× scaling.`
                : 'Plug the glasses into a DisplayPort-capable USB-C port, then choose the display in Settings.'}
            </p>
          </div>
          <div className="hero-card__footer">
            <Button onClick={() => onNavigate('device')}>
              Device centre <ArrowRight size={16} />
            </Button>
            {activeDisplay ? (
              <Button variant="ghost" onClick={onMoveToDisplay}>
                Move hub here
              </Button>
            ) : null}
          </div>
        </article>

        <article className="hero-card focus-card">
          <div className="focus-card__header">
            <div>
              <span className="card-kicker">Focus session</span>
              <h2>Protect the next 25 minutes.</h2>
            </div>
            <Clock3 size={22} />
          </div>
          <div className="focus-timer">
            <div
              className="focus-timer__ring"
              style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}
            >
              <div>
                <strong>{formatDuration(remaining)}</strong>
                <span>{running ? 'In focus' : remaining === 0 ? 'Complete' : 'Ready'}</span>
              </div>
            </div>
            <div className="focus-timer__controls">
              <Button
                variant="primary"
                onClick={() => {
                  if (remaining === 0) setRemaining(FOCUS_SECONDS);
                  setRunning((value) => !value);
                }}
              >
                {running ? <CirclePause size={18} /> : <CirclePlay size={18} />}
                {running ? 'Pause' : remaining === 0 ? 'Restart' : 'Start focus'}
              </Button>
              <button
                className="icon-button"
                aria-label="Reset focus timer"
                title="Reset timer"
                onClick={() => {
                  setRemaining(FOCUS_SECONDS);
                  setRunning(false);
                }}
              >
                <RotateCcw size={17} />
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-row-heading">
          <div>
            <span className="eyebrow">Jump back in</span>
            <h2>Quick launch</h2>
          </div>
        </div>
        <div className="quick-grid">
          {[
            {
              section: 'notes' as const,
              icon: NotebookPen,
              title: 'Capture a note',
              text: `${state.notes.length} local note${state.notes.length === 1 ? '' : 's'}`,
              tone: 'teal',
            },
            {
              section: 'workspaces' as const,
              icon: PanelsTopLeft,
              title: 'Launch a workspace',
              text: `${state.workspaces.length} layouts ready`,
              tone: 'purple',
            },
            {
              section: 'gestures' as const,
              icon: Hand,
              title: 'Test gestures',
              text: `${state.gestures.filter((gesture) => gesture.enabled).length} mappings active`,
              tone: 'orange',
            },
            {
              section: 'agents' as const,
              icon: Bot,
              title: 'Open agent desk',
              text: 'Study, build, and research',
              tone: 'blue',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.section}
                className="quick-card"
                onClick={() => onNavigate(item.section)}
              >
                <span className={`icon-chip icon-chip--${item.tone}`}>
                  <Icon size={20} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.text}</small>
                </span>
                <ArrowRight size={17} className="quick-card__arrow" />
              </button>
            );
          })}
        </div>
      </section>

    </div>
  );
}
