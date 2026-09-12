import {
  Check,
  Eye,
  Glasses,
  Monitor,
  MousePointer2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fitDisplayLayout,
  layoutsEqual,
  moveDisplay,
  setPrimaryDisplay,
  validateDisplayLayout,
} from '../lib/display-layout';
import { platform } from '../services/platform';
import type { DisplayLayoutItem, DisplayLayoutSnapshot, SystemSnapshot } from '../types';
import { Button, SectionHeading, StatusPill } from '../components/ui';

interface DisplayStudioProps {
  snapshot: SystemSnapshot | null;
  onToast(message: string, detail?: string): void;
}

interface StageSize {
  width: number;
  height: number;
}

const CONFIRM_SECONDS = 15;

export function DisplayStudio({ snapshot, onToast }: DisplayStudioProps) {
  const [layout, setLayout] = useState<DisplayLayoutSnapshot | null>(null);
  const [draft, setDraft] = useState<DisplayLayoutItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [confirmSeconds, setConfirmSeconds] = useState<number | null>(null);
  const [stageSize, setStageSize] = useState<StageSize>({ width: 860, height: 470 });
  const stageRef = useRef<HTMLDivElement>(null);

  const loadLayout = useCallback(async () => {
    setLoading(true);
    try {
      const next = await platform.getDisplayLayout();
      setLayout(next);
      setDraft(next.displays);
      setSelectedId((current) => current && next.displays.some((item) => item.id === current)
        ? current
        : next.displays.find((item) => item.xreal)?.id ?? next.displays[0]?.id ?? null);
      setConfirmSeconds(null);
    } catch (error) {
      onToast('Could not read display layout', error instanceof Error ? error.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    void loadLayout();
  }, [loadLayout, snapshot?.displays.length, snapshot?.xreal.displayId]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return undefined;
    const update = () => setStageSize({
      width: element.clientWidth || 860,
      height: element.clientHeight || 470,
    });
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const revert = useCallback(async (announce = true) => {
    setApplying(true);
    try {
      const restored = await platform.revertDisplayLayout();
      setLayout(restored);
      setDraft(restored.displays);
      setConfirmSeconds(null);
      if (announce) onToast('Previous display layout restored');
    } catch (error) {
      onToast('Could not restore the layout', error instanceof Error ? error.message : undefined);
    } finally {
      setApplying(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (confirmSeconds === null) return undefined;
    if (confirmSeconds <= 0) {
      void revert(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setConfirmSeconds((value) => value === null ? null : value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [confirmSeconds, revert]);

  const frame = useMemo(
    () => fitDisplayLayout(draft, stageSize.width, stageSize.height),
    [draft, stageSize],
  );
  const selected = draft.find((display) => display.id === selectedId) ?? null;
  const validationError = validateDisplayLayout(draft);
  const dirty = Boolean(layout && !layoutsEqual(draft, layout.displays));

  function beginDrag(event: React.PointerEvent<HTMLButtonElement>, display: DisplayLayoutItem) {
    if (confirmSeconds !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(display.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = display.x;
    const originY = display.y;
    const target = event.currentTarget;
    const move = (moveEvent: PointerEvent) => {
      const nextX = originX + (moveEvent.clientX - startX) / frame.scale;
      const nextY = originY + (moveEvent.clientY - startY) / frame.scale;
      setDraft((items) => {
        const moved = moveDisplay(items, display.id, nextX, nextY);
        return display.primary ? setPrimaryDisplay(moved, display.id) : moved;
      });
    };
    const stop = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', stop);
      target.removeEventListener('pointercancel', stop);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', stop);
    target.addEventListener('pointercancel', stop);
  }

  async function identify() {
    try {
      const shown = await platform.identifyDisplays();
      onToast(shown ? 'Display numbers shown' : 'No displays available', 'Markers close automatically after 3 seconds.');
    } catch {
      onToast('Could not identify displays');
    }
  }

  async function applyPreview() {
    if (validationError || !layout?.canApply) return;
    setApplying(true);
    try {
      const result = await platform.previewDisplayLayout(draft);
      setLayout(result.layout);
      setDraft(result.layout.displays);
      if (result.requiresConfirmation) setConfirmSeconds(CONFIRM_SECONDS);
      onToast('Layout preview applied', 'Keep the changes within 15 seconds or they will revert.');
    } catch (error) {
      onToast('Windows rejected the display layout', error instanceof Error ? error.message : undefined);
      await loadLayout();
    } finally {
      setApplying(false);
    }
  }

  async function keepChanges() {
    setApplying(true);
    try {
      const kept = await platform.confirmDisplayLayout();
      if (!kept) throw new Error('The confirmation window had already ended.');
      setConfirmSeconds(null);
      onToast('Display layout saved');
    } catch (error) {
      onToast('Could not confirm the layout', error instanceof Error ? error.message : undefined);
      await loadLayout();
    } finally {
      setApplying(false);
    }
  }

  function updateCoordinate(axis: 'x' | 'y', value: string) {
    if (!selected) return;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;
    setDraft((items) => items.map((item) => item.id === selected.id ? { ...item, [axis]: parsed } : item));
  }

  return (
    <section className="module-page display-studio-page">
      <SectionHeading
        eyebrow="Spatial workspace"
        title="Display Layout Studio"
        description="Arrange your physical monitors and XREAL screen in one safe workspace. Drag a display to match where it sits around you, then preview the layout before keeping it."
        actions={(
          <>
            <Button onClick={() => void identify()}><Eye size={15} /> Identify</Button>
            <Button onClick={() => void loadLayout()} busy={loading}><RefreshCw size={15} /> Refresh</Button>
          </>
        )}
      />

      {confirmSeconds !== null ? (
        <div className="layout-confirm" role="alert">
          <div className="layout-confirm__timer">{confirmSeconds}</div>
          <div>
            <strong>Can you see every display?</strong>
            <span>This arrangement will restore automatically unless you keep it.</span>
          </div>
          <Button variant="ghost" onClick={() => void revert()} disabled={applying}>Revert now</Button>
          <Button variant="primary" onClick={() => void keepChanges()} busy={applying}><Check size={16} /> Keep changes</Button>
        </div>
      ) : null}

      <div className="display-studio-grid">
        <div className="display-canvas-card card-surface">
          <div className="display-canvas-toolbar">
            <div>
              <span className="card-kicker">Desktop coordinate space</span>
              <strong>{draft.length} active {draft.length === 1 ? 'display' : 'displays'}</strong>
            </div>
            <div className="display-legend">
              <span><i className="legend-swatch legend-swatch--physical" /> Physical</span>
              <span><i className="legend-swatch legend-swatch--xreal" /> XREAL FOV</span>
            </div>
          </div>

          <div className="display-stage" ref={stageRef} aria-label="Display arrangement canvas">
            <div className="display-stage__grid" />
            {draft.map((display, index) => (
              <button
                key={display.id}
                type="button"
                className="display-tile"
                data-selected={display.id === selectedId}
                data-xreal={display.xreal}
                onPointerDown={(event) => beginDrag(event, display)}
                onClick={() => setSelectedId(display.id)}
                style={{
                  left: frame.offsetX + display.x * frame.scale,
                  top: frame.offsetY + display.y * frame.scale,
                  width: Math.max(115, display.width * frame.scale),
                  height: Math.max(70, display.height * frame.scale),
                }}
                aria-label={`Display ${index + 1}: ${display.label}`}
              >
                {display.xreal ? <div className="xreal-fov-lines" aria-hidden /> : null}
                <span className="display-tile__number">{index + 1}</span>
                <span className="display-tile__icon">{display.xreal ? <Glasses size={22} /> : <Monitor size={22} />}</span>
                <strong>{display.label}</strong>
                <small>{display.width} × {display.height}</small>
                <span className="display-tile__badges">
                  {display.primary ? <em>Primary</em> : null}
                  {display.xreal ? <em>XREAL FOV</em> : null}
                </span>
              </button>
            ))}
            {!draft.length && !loading ? <span className="display-stage__empty">No active displays were found.</span> : null}
          </div>

          <div className="display-canvas-footer">
            <span><MousePointer2 size={14} /> Drag displays so their touching edges match your real setup.</span>
            <span>{layout?.source === 'windows-native' ? 'Live Windows layout' : 'Safe preview mode'}</span>
          </div>
        </div>

        <aside className="display-inspector card-surface">
          {selected ? (
            <>
              <div className="display-inspector__header">
                <span className={`icon-chip ${selected.xreal ? 'icon-chip--teal' : 'icon-chip--blue'}`}>
                  {selected.xreal ? <Glasses size={20} /> : <Monitor size={20} />}
                </span>
                <div>
                  <span className="card-kicker">Selected display</span>
                  <h2>{selected.label}</h2>
                </div>
              </div>
              <div className="inspector-badges">
                <StatusPill tone={selected.primary ? 'positive' : 'neutral'}>{selected.primary ? 'Primary' : 'Extended'}</StatusPill>
                {selected.xreal ? <StatusPill tone="info">XREAL field of view</StatusPill> : null}
                {selected.internal ? <StatusPill tone="neutral">Built-in</StatusPill> : null}
              </div>
              <div className="coordinate-fields">
                <label>X position<input aria-label="X position" type="number" value={selected.x} disabled={selected.primary || confirmSeconds !== null} onChange={(event) => updateCoordinate('x', event.target.value)} /></label>
                <label>Y position<input aria-label="Y position" type="number" value={selected.y} disabled={selected.primary || confirmSeconds !== null} onChange={(event) => updateCoordinate('y', event.target.value)} /></label>
              </div>
              <dl className="display-facts">
                <div><dt>Resolution</dt><dd>{selected.width} × {selected.height}</dd></div>
                <div><dt>Orientation</dt><dd>{selected.rotation === 0 ? 'Landscape' : `${selected.rotation}°`}</dd></div>
                <div><dt>Scale</dt><dd>{Math.round(selected.scaleFactor * 100)}%</dd></div>
                <div><dt>Device</dt><dd title={selected.deviceName}>{selected.deviceName}</dd></div>
              </dl>
              {!selected.primary ? (
                <Button className="inspector-primary-button" onClick={() => setDraft((items) => setPrimaryDisplay(items, selected.id))} disabled={confirmSeconds !== null}>
                  Make this my main display
                </Button>
              ) : null}
              {selected.xreal ? (
                <div className="fov-note"><Glasses size={17} /><span><strong>Your anchored XREAL screen</strong>Place it beside or above a monitor to match the direction you turn your head.</span></div>
              ) : null}
            </>
          ) : <div className="display-inspector__empty"><Monitor size={28} /><span>Select a display to inspect it.</span></div>}
        </aside>
      </div>

      <footer className="layout-actionbar card-surface">
        <div className="layout-safety-copy">
          <ShieldCheck size={20} />
          <span><strong>Protected by automatic rollback</strong>{layout?.warning ?? 'Windows restores the last working layout unless you confirm the preview.'}</span>
        </div>
        <div className="layout-actionbar__buttons">
          <Button variant="ghost" disabled={!dirty || confirmSeconds !== null} onClick={() => setDraft(layout?.displays ?? [])}><RotateCcw size={15} /> Reset</Button>
          <Button variant="primary" busy={applying} disabled={!dirty || Boolean(validationError) || !layout?.canApply || confirmSeconds !== null} onClick={() => void applyPreview()}>
            Preview layout
          </Button>
        </div>
      </footer>
      {validationError ? <p className="layout-error">{validationError}</p> : null}
    </section>
  );
}
