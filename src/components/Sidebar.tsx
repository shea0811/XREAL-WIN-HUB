import { ChevronsLeft, ChevronsRight, ShieldCheck } from 'lucide-react';
import { MEDIA_NAVIGATION, NAVIGATION } from '../navigation';
import { useMedia } from '../state/MediaContext';
import type { HubSection } from '../types';
import { Brand } from './Brand';

export function Sidebar({
  activeSection,
  collapsed,
  onNavigate,
  onToggle,
}: {
  activeSection: HubSection;
  collapsed: boolean;
  onNavigate(section: HubSection): void;
  onToggle(): void;
}) {
  const { enabledServices } = useMedia();
  const items = NAVIGATION.flatMap((item) => {
    if (item.id !== 'entertainment') return [item];
    const mediaItems = (['spotify', 'youtube'] as const)
      .filter((service) => enabledServices[service])
      .map((service) => MEDIA_NAVIGATION[service]);
    return [item, ...mediaItems];
  });

  return (
    <aside className="sidebar" data-collapsed={collapsed}>
      <div className="sidebar__top">
        <Brand compact={collapsed} />
        <button
          className="icon-button sidebar__collapse"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar__nav" aria-label="Main navigation">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              className="nav-item"
              data-active={active}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {!collapsed ? <span>{item.label}</span> : null}
              {active ? <span className="nav-item__active" aria-hidden /> : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebar__privacy" title="No telemetry. Data stays on this device.">
        <ShieldCheck size={18} aria-hidden />
        {!collapsed ? (
          <span>
            <strong>Local first</strong>
            <small>No telemetry</small>
          </span>
        ) : null}
      </div>
    </aside>
  );
}
