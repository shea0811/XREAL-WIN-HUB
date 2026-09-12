import {
  AppWindow,
  Contrast,
  Database,
  Eye,
  Gauge,
  HardDrive,
  Laptop,
  Monitor,
  Moon,
  Play,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { SectionHeading, StatusPill, Toggle } from '../components/ui';
import { platform } from '../services/platform';
import { useHub } from '../state/HubContext';
import type { SystemSnapshot, ThemeMode } from '../types';

export function Settings({
  snapshot,
  onToast,
}: {
  snapshot: SystemSnapshot | null;
  onToast(message: string, detail?: string): void;
}) {
  const { state, updateSettings, recordActivity } = useHub();
  const settings = state.settings;

  async function toggleAlwaysOnTop(enabled: boolean) {
    try {
      const applied = await platform.setAlwaysOnTop(enabled);
      if (!snapshot?.isElectron) {
        onToast('Desktop feature', 'Always-on-top is available in the packaged Windows app.');
        return;
      }
      updateSettings({ alwaysOnTop: applied });
    } catch {
      onToast('Always-on-top was unavailable', 'Restart the app and try again.');
    }
  }

  async function toggleLaunchAtLogin(enabled: boolean) {
    try {
      const applied = await platform.setLaunchAtLogin(enabled);
      if (!snapshot?.isElectron) {
        onToast('Desktop feature', 'Launch at login is available in the packaged Windows app.');
        return;
      }
      updateSettings({ launchAtLogin: applied });
    } catch {
      onToast('Launch-at-login was unavailable', 'Windows did not accept the change.');
    }
  }

  function selectDisplay(displayId: string) {
    updateSettings({ preferredDisplayId: displayId || null });
    const display = snapshot?.displays.find((candidate) => candidate.id === displayId);
    if (display) {
      recordActivity({
        kind: 'device',
        title: 'Preferred display changed',
        detail: display.label,
      });
    }
  }

  return (
    <div className="module-page settings-page">
      <SectionHeading
        eyebrow="Preferences"
        title="Settings"
        description="Tune the hub for your display, comfort, and Windows workflow."
      />

      <div className="settings-layout">
        <section className="settings-group card-surface">
          <header>
            <span className="settings-group__icon"><Monitor size={20} /></span>
            <div><h2>Display</h2><p>Choose where XREAL-first actions should appear.</p></div>
          </header>
          <div className="setting-row setting-row--stacked">
            <div>
              <strong>Preferred XREAL display</strong>
              <small>Manual selection handles displays with generic Windows names.</small>
            </div>
            <select
              className="wide-select"
              value={settings.preferredDisplayId ?? ''}
              onChange={(event) => selectDisplay(event.target.value)}
            >
              <option value="">Use current display</option>
              {snapshot?.displays.map((display) => (
                <option value={display.id} key={display.id}>
                  {display.label} — {display.size.width}×{display.size.height}{display.primary ? ' (Primary)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="display-list">
            {snapshot?.displays.map((display) => (
              <div key={display.id} data-selected={settings.preferredDisplayId === display.id}>
                <span><Laptop size={18} /></span>
                <p><strong>{display.label}</strong><small>{display.size.width} × {display.size.height} · {display.scaleFactor}×</small></p>
                {display.primary ? <StatusPill tone="neutral">Primary</StatusPill> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="settings-group card-surface">
          <header>
            <span className="settings-group__icon"><Eye size={20} /></span>
            <div><h2>Appearance</h2><p>Keep the interface comfortable through the glasses.</p></div>
          </header>
          <div className="setting-row setting-row--stacked">
            <div><strong>Theme</strong><small>System follows your Windows colour mode.</small></div>
            <div className="theme-picker">
              {([
                ['system', Laptop, 'System'],
                ['dark', Moon, 'Dark'],
                ['light', Sun, 'Light'],
              ] as [ThemeMode, typeof Laptop, string][]).map(([value, Icon, label]) => (
                <button key={value} data-active={settings.theme === value} onClick={() => updateSettings({ theme: value })}>
                  <Icon size={17} /> {label}
                </button>
              ))}
            </div>
          </div>
          <label className="setting-row setting-row--stacked">
            <div><strong>Interface scale</strong><small>{Math.round(settings.interfaceScale * 100)}% · useful for perceived XREAL screen distance.</small></div>
            <div className="range-row"><Gauge size={17} /><input type="range" min="0.9" max="1.2" step="0.05" value={settings.interfaceScale} onChange={(event) => updateSettings({ interfaceScale: Number(event.target.value) })} /></div>
          </label>
          <div className="setting-row">
            <span className="setting-row__icon"><Contrast size={18} /></span>
            <div><strong>High contrast</strong><small>Strengthen borders and secondary text.</small></div>
            <Toggle checked={settings.highContrast} onChange={(value) => updateSettings({ highContrast: value })} label="High contrast" />
          </div>
          <div className="setting-row">
            <span className="setting-row__icon"><Play size={18} /></span>
            <div><strong>Reduce motion</strong><small>Disable decorative movement and transitions.</small></div>
            <Toggle checked={settings.reduceMotion} onChange={(value) => updateSettings({ reduceMotion: value })} label="Reduce motion" />
          </div>
        </section>

        <section className="settings-group card-surface">
          <header>
            <span className="settings-group__icon"><AppWindow size={20} /></span>
            <div><h2>Windows behaviour</h2><p>Control how the desktop app starts and stays visible.</p></div>
          </header>
          <div className="setting-row">
            <span className="setting-row__icon"><AppWindow size={18} /></span>
            <div><strong>Always on top</strong><small>Keep the hub above other windows.</small></div>
            <Toggle checked={settings.alwaysOnTop} onChange={(value) => void toggleAlwaysOnTop(value)} label="Always on top" />
          </div>
          <div className="setting-row">
            <span className="setting-row__icon"><Play size={18} /></span>
            <div><strong>Launch at login</strong><small>Start the hub when you sign into Windows.</small></div>
            <Toggle checked={settings.launchAtLogin} onChange={(value) => void toggleLaunchAtLogin(value)} label="Launch at login" />
          </div>
        </section>

        <section className="settings-group card-surface">
          <header>
            <span className="settings-group__icon"><ShieldCheck size={20} /></span>
            <div><h2>Privacy & data</h2><p>A deliberately small, local data footprint.</p></div>
          </header>
          <div className="privacy-grid">
            <div><Database size={19} /><span><strong>App data</strong><small>Local JSON file</small></span></div>
            <div><HardDrive size={19} /><span><strong>Notes</strong><small>On this device</small></span></div>
            <div><ShieldCheck size={19} /><span><strong>Telemetry</strong><small>Off</small></span></div>
            <div><Eye size={19} /><span><strong>Camera</strong><small>Not requested</small></span></div>
          </div>
          <div className="diagnostics-block">
            <div><strong>Build diagnostics</strong><StatusPill tone="neutral">v{snapshot?.appVersion ?? '0.1.0'}</StatusPill></div>
            <code>{snapshot?.isElectron ? 'Electron desktop' : 'Browser preview'} · {snapshot?.platform ?? 'Loading'} · {snapshot?.displays.length ?? 0} display(s)</code>
          </div>
        </section>
      </div>
    </div>
  );
}
