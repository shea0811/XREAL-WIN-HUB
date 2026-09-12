import { type CSSProperties, type FormEvent, useState } from 'react';
import {
  ArrowUpRight,
  BookOpenCheck,
  BriefcaseBusiness,
  FlaskConical,
  LayoutDashboard,
  Maximize2,
  PanelsTopLeft,
  Plus,
  SplitSquareHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { Button, SectionHeading, StatusPill } from '../components/ui';
import { validWebUrl } from '../lib/format';
import { platform } from '../services/platform';
import { useHub } from '../state/HubContext';
import type { SystemSnapshot, WorkspaceLayout, WorkspaceProfile } from '../types';

const workspaceIcons = {
  'study-session': BookOpenCheck,
  'cyber-lab': FlaskConical,
  entertainment: Maximize2,
  'service-desk': BriefcaseBusiness,
};

const layoutLabels: Record<WorkspaceLayout, string> = {
  focus: 'Focus',
  split: 'Split',
  theatre: 'Theatre',
};

export function Workspaces({
  snapshot,
  onToast,
}: {
  snapshot: SystemSnapshot | null;
  onToast(message: string, detail?: string): void;
}) {
  const { state, addWorkspace, removeWorkspace, recordActivity } = useHub();
  const [creating, setCreating] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [layout, setLayout] = useState<WorkspaceLayout>('focus');
  const selectedDisplay = snapshot?.displays.find(
    (display) => display.id === state.settings.preferredDisplayId,
  );

  async function launch(profile: WorkspaceProfile) {
    setLaunchingId(profile.id);
    try {
      const result = await platform.launchWorkspace(
        profile,
        state.settings.preferredDisplayId,
      );
      recordActivity({
        kind: 'workspace',
        title: `${profile.name} launched`,
        detail: `${result.opened} target${result.opened === 1 ? '' : 's'} opened${selectedDisplay ? ` for ${selectedDisplay.label}` : ''}.`,
      });
      onToast(`${profile.name} launched`, `${result.opened} browser target${result.opened === 1 ? '' : 's'} opened.`);
    } catch {
      onToast('Workspace launch failed', 'Check that your default browser is available.');
    } finally {
      setLaunchingId(null);
    }
  }

  function submitWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !validWebUrl(url)) return;
    const id = `workspace-${Date.now()}`;
    addWorkspace({
      id,
      name: name.trim(),
      description: 'Custom one-click workspace.',
      layout,
      accent: '#5ee5d5',
      targets: [{ id: `${id}-target`, name: new URL(url).hostname, url }],
    });
    setName('');
    setUrl('');
    setLayout('focus');
    setCreating(false);
    onToast('Workspace created', 'It is stored locally and ready to launch.');
  }

  return (
    <div className="module-page">
      <SectionHeading
        eyebrow="One-click setups"
        title="Workspaces"
        description="Group the places you need, move the hub to the right display, and get started."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={17} /> New workspace
          </Button>
        }
      />

      <div className="workspace-status-bar">
        <span>
          <PanelsTopLeft size={17} />
          <strong>{state.workspaces.length} workspaces</strong>
        </span>
        <span>
          Target display: <strong>{selectedDisplay?.label ?? 'Current display'}</strong>
        </span>
        <StatusPill tone={snapshot?.isElectron ? 'positive' : 'info'}>
          {snapshot?.isElectron ? 'Desktop controls ready' : 'Browser preview'}
        </StatusPill>
      </div>

      <section className="workspace-grid">
        {state.workspaces.map((workspace) => {
          const Icon =
            workspaceIcons[workspace.id as keyof typeof workspaceIcons] ?? LayoutDashboard;
          return (
            <article
              className="workspace-card"
              key={workspace.id}
              style={{ '--workspace-accent': workspace.accent } as CSSProperties}
            >
              <div className="workspace-card__top">
                <span className="workspace-card__icon"><Icon size={22} /></span>
                <span className="workspace-card__layout">
                  {workspace.layout === 'split' ? (
                    <SplitSquareHorizontal size={14} />
                  ) : workspace.layout === 'theatre' ? (
                    <Maximize2 size={14} />
                  ) : (
                    <LayoutDashboard size={14} />
                  )}
                  {layoutLabels[workspace.layout]}
                </span>
              </div>
              <h2>{workspace.name}</h2>
              <p>{workspace.description}</p>
              <div className="workspace-card__targets">
                {workspace.targets.map((target) => (
                  <span key={target.id}>{target.name}</span>
                ))}
              </div>
              <div className="workspace-card__footer">
                <Button
                  variant="primary"
                  onClick={() => void launch(workspace)}
                  busy={launchingId === workspace.id}
                >
                  Launch <ArrowUpRight size={16} />
                </Button>
                {!workspace.builtIn ? (
                  <button
                    className="icon-button icon-button--danger"
                    aria-label={`Delete ${workspace.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete “${workspace.name}”?`)) {
                        removeWorkspace(workspace.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      {creating ? (
        <div className="modal-layer" role="presentation" onMouseDown={() => setCreating(false)}>
          <form className="dialog-card" onSubmit={submitWorkspace} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="eyebrow">Custom launcher</span>
                <h2>New workspace</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setCreating(false)} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <label className="form-field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Research sprint" autoFocus />
            </label>
            <label className="form-field">
              <span>First website</span>
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" type="url" />
              {url && !validWebUrl(url) ? <small>Enter a complete http or https URL.</small> : null}
            </label>
            <fieldset className="segmented-field">
              <legend>Layout intention</legend>
              <div>
                {(['focus', 'split', 'theatre'] as WorkspaceLayout[]).map((value) => (
                  <button type="button" key={value} data-active={layout === value} onClick={() => setLayout(value)}>
                    {layoutLabels[value]}
                  </button>
                ))}
              </div>
            </fieldset>
            <footer>
              <Button type="button" onClick={() => setCreating(false)}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={!name.trim() || !validWebUrl(url)}>Create workspace</Button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
