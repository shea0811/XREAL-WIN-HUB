import {
  Cable,
  CheckCircle2,
  CircleDashed,
  Glasses,
  Hand,
  Maximize2,
  MonitorUp,
  MousePointer2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  TestTube2,
} from 'lucide-react';
import { Button, SectionHeading, StatusPill } from '../components/ui';
import { useHub } from '../state/HubContext';
import type { SystemSnapshot } from '../types';

export function DeviceCenter({
  snapshot,
  refreshing,
  onRefresh,
  onMoveToDisplay,
  onTheatre,
  onToggleSimulation,
}: {
  snapshot: SystemSnapshot | null;
  refreshing: boolean;
  onRefresh(): void;
  onMoveToDisplay(): void;
  onTheatre(): void;
  onToggleSimulation(enabled: boolean): void;
}) {
  const { state } = useHub();
  const preferred = snapshot?.displays.find(
    (display) => display.id === state.settings.preferredDisplayId,
  );
  const detected = snapshot?.displays.find(
    (display) => display.id === snapshot.xreal.displayId,
  );
  const target = detected ?? preferred;

  const capabilities = [
    {
      icon: MonitorUp,
      title: 'Display placement',
      description: 'Move the hub onto a chosen Windows display.',
      ready: Boolean(snapshot?.xreal.capabilities.displayPlacement),
    },
    {
      icon: Maximize2,
      title: 'Theatre mode',
      description: 'Full-screen, reduced-distraction media launcher.',
      ready: Boolean(snapshot?.xreal.capabilities.theatreMode),
    },
    {
      icon: Hand,
      title: 'Eye hand tracking',
      description: 'Requires a future supported native XREAL bridge.',
      ready: Boolean(snapshot?.xreal.capabilities.handTracking),
    },
    {
      icon: ScanLine,
      title: '6DoF spatial data',
      description: 'Not exposed by the documented Windows display path.',
      ready: Boolean(snapshot?.xreal.capabilities.spatialTracking),
    },
    {
      icon: MousePointer2,
      title: 'Gesture simulation',
      description: 'Keyboard-backed mappings are ready to test now.',
      ready: true,
    },
    {
      icon: ShieldCheck,
      title: 'Local operation',
      description: 'No telemetry and no XREAL account required.',
      ready: true,
    },
  ];

  return (
    <div className="module-page">
      <SectionHeading
        eyebrow="Hardware"
        title="XREAL device centre"
        description="A truthful view of what Windows can see and what the hub can control."
        actions={<div className="button-row">
          <Button
            variant={snapshot?.xreal.simulated ? 'primary' : 'ghost'}
            onClick={() => onToggleSimulation(!snapshot?.xreal.simulated)}
            disabled={snapshot?.xreal.connection === 'display-detected' && !snapshot.xreal.simulated}
          >
            <TestTube2 size={16} />
            {snapshot?.xreal.simulated ? 'Disconnect simulator' : 'Simulate One Pro'}
          </Button>
          <Button onClick={onRefresh} busy={refreshing}>
            <RefreshCw size={16} /> Refresh devices
          </Button>
        </div>}
      />

      <section className="device-overview card-surface">
        <div className="device-illustration" aria-hidden>
          <span className="device-illustration__left" />
          <span className="device-illustration__right" />
          <span className="device-illustration__bridge" />
          <span className="device-illustration__eye" />
          <span className="device-illustration__beam" />
        </div>
        <div className="device-overview__copy">
          <StatusPill tone={target ? 'positive' : 'warning'}>
            <span className="status-dot" />
            {snapshot?.xreal.simulated ? 'Simulation connected' : target ? 'Ready as a display' : 'Not detected'}
          </StatusPill>
          <span className="card-kicker">Active target</span>
          <h2>{target?.label ?? 'XREAL One Pro + Eye'}</h2>
          <p>
            {target
              ? `Windows reports ${target.size.width} × ${target.size.height}, ${target.rotation}° rotation, and ${target.scaleFactor}× scale.`
              : 'Connect the glasses by USB-C, extend the Windows desktop, then manually select the display if its name is generic.'}
          </p>
          <div className="button-row">
            <Button variant="primary" onClick={onMoveToDisplay} disabled={!target}>
              <MonitorUp size={17} /> Move hub to display
            </Button>
            <Button onClick={onTheatre} disabled={!target}>
              <Maximize2 size={17} /> Enter theatre
            </Button>
          </div>
        </div>
        <div className="connection-route" aria-label="Connection route">
          <span>
            <Cable size={18} /> Windows PC
          </span>
          <i />
          <span>
            <Glasses size={18} /> XREAL display
          </span>
        </div>
      </section>

      <section className="content-section">
        <div className="section-row-heading">
          <div>
            <span className="eyebrow">Capability map</span>
            <h2>Available in this build</h2>
          </div>
          <span className="build-label">MVP · v{snapshot?.appVersion ?? '0.1.0'}</span>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability) => {
            const Icon = capability.icon;
            return (
              <article className="capability-card" key={capability.title}>
                <span className="capability-card__icon">
                  <Icon size={20} />
                </span>
                <div>
                  <h3>{capability.title}</h3>
                  <p>{capability.description}</p>
                </div>
                <span className="capability-card__state" data-ready={capability.ready}>
                  {capability.ready ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}
                  {capability.ready ? 'Ready' : 'Bridge needed'}
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="info-banner">
        <ShieldCheck size={20} />
        <div>
          <strong>{snapshot?.xreal.simulated ? 'Safe simulation is active' : 'No pretend hardware access'}</strong>
          <p>
            {snapshot?.xreal.simulated
              ? 'The virtual One Pro exercises display selection, placement, theatre mode, workspaces, and gestures without claiming access to physical sensors.'
              : 'The hub only marks hand tracking or spatial data as connected after a real native provider reports those capabilities. Until then, the gesture studio stays in safe simulation mode.'}
          </p>
        </div>
      </section>
    </div>
  );
}
