import { useState } from 'react';
import {
  Activity,
  CirclePlay,
  Hand,
  Keyboard,
  RadioTower,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Button, SectionHeading, StatusPill, Toggle } from '../components/ui';
import { ACTION_LABELS } from '../lib/gesture-engine';
import { useHub } from '../state/HubContext';
import type { GestureId, HubActionId, SystemSnapshot } from '../types';

const actionOptions = Object.entries(ACTION_LABELS) as [HubActionId, string][];

export function Gestures({
  snapshot,
  onSimulate,
}: {
  snapshot: SystemSnapshot | null;
  onSimulate(id: GestureId): void;
}) {
  const { state, updateGesture, toggleGesture } = useHub();
  const [lastGesture, setLastGesture] = useState<GestureId | null>(null);

  function simulate(id: GestureId) {
    setLastGesture(id);
    onSimulate(id);
    window.setTimeout(() => setLastGesture((current) => (current === id ? null : current)), 800);
  }

  return (
    <div className="module-page">
      <SectionHeading
        eyebrow="Interaction lab"
        title="Gesture studio"
        description="Design the controls now, test them safely, and keep hardware input behind a strict adapter."
        actions={
          <StatusPill tone={snapshot?.xreal.capabilities.handTracking ? 'positive' : 'info'}>
            <RadioTower size={13} />
            {snapshot?.xreal.capabilities.handTracking ? 'Native bridge' : 'Simulation mode'}
          </StatusPill>
        }
      />

      <section className="gesture-hero card-surface">
        <div className="gesture-hero__visual" aria-hidden>
          <span className="gesture-hand">
            <i className="finger finger--one" />
            <i className="finger finger--two" />
            <i className="finger finger--three" />
            <i className="finger finger--four" />
            <i className="finger finger--thumb" />
            <i className="palm" />
          </span>
          <span className="gesture-orbit gesture-orbit--one" />
          <span className="gesture-orbit gesture-orbit--two" />
        </div>
        <div>
          <span className="card-kicker">Input source</span>
          <h2>Keyboard-backed simulation</h2>
          <p>
            Every mapping below is functional inside the hub. A future native provider can emit
            the same gesture IDs, so the UI and your preferences will not need to be rebuilt.
          </p>
          <div className="gesture-hero__facts">
            <span><Keyboard size={17} /> Six test shortcuts</span>
            <span><ShieldAlert size={17} /> No camera access</span>
            <span><Activity size={17} /> Live action feedback</span>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-row-heading">
          <div>
            <span className="eyebrow">Mappings</span>
            <h2>Your gesture controls</h2>
          </div>
          <span className="subtle-copy">Shortcuts only work while the hub is focused</span>
        </div>
        <div className="gesture-list">
          {state.gestures.map((gesture, index) => (
            <article className="gesture-row" key={gesture.id} data-fired={lastGesture === gesture.id}>
              <span className="gesture-row__number">{String(index + 1).padStart(2, '0')}</span>
              <span className="gesture-row__icon"><Hand size={20} /></span>
              <div className="gesture-row__copy">
                <strong>{gesture.name}</strong>
                <small>{gesture.description}</small>
              </div>
              <label className="mapping-select">
                <span className="sr-only">Action for {gesture.name}</span>
                <select
                  value={gesture.actionId}
                  onChange={(event) => updateGesture(gesture.id, event.target.value as HubActionId)}
                  disabled={!gesture.enabled}
                >
                  {actionOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              <kbd>{gesture.shortcut}</kbd>
              <Button variant="ghost" onClick={() => simulate(gesture.id)} disabled={!gesture.enabled}>
                {lastGesture === gesture.id ? <Sparkles size={16} /> : <CirclePlay size={16} />}
                Test
              </Button>
              <Toggle checked={gesture.enabled} onChange={() => toggleGesture(gesture.id)} label={`Enable ${gesture.name}`} />
            </article>
          ))}
        </div>
      </section>

      <section className="gesture-footer card-surface">
        <span className="icon-chip icon-chip--purple"><RotateCcw size={19} /></span>
        <div>
          <strong>Adapter-ready by design</strong>
          <p>Native input will enter through one bridge and reuse these mappings, permissions, and action rules.</p>
        </div>
      </section>
    </div>
  );
}
