import { Bell, CircleHelp, Command, Search } from 'lucide-react';
import { getNavigationItem } from '../navigation';
import type { HubSection, SystemSnapshot } from '../types';

export function TopBar({
  section,
  snapshot,
  preferredDisplayId,
  onOpenPalette,
  unreadNotifications,
  notificationCenterOpen,
  onToggleNotifications,
  onHelp,
}: {
  section: HubSection;
  snapshot: SystemSnapshot | null;
  preferredDisplayId: string | null;
  onOpenPalette(): void;
  unreadNotifications: number;
  notificationCenterOpen: boolean;
  onToggleNotifications(): void;
  onHelp(): void;
}) {
  const item = getNavigationItem(section);
  const detected = snapshot?.xreal.connection === 'display-detected';
  const manuallySelected = Boolean(
    preferredDisplayId && snapshot?.displays.some((display) => display.id === preferredDisplayId),
  );
  const connected = detected || manuallySelected;

  return (
    <header className="topbar">
      <div className="topbar__title">
        <span>{item.label}</span>
        <small>{item.description}</small>
      </div>

      <button className="command-trigger" onClick={onOpenPalette}>
        <Search size={17} aria-hidden />
        <span>Search or run a command</span>
        <kbd>
          <Command size={12} aria-hidden />K
        </kbd>
      </button>

      <div className="topbar__actions">
        <span className="device-indicator" data-connected={connected}>
          <span aria-hidden />
          {snapshot?.xreal.simulated ? 'One Pro simulated' : connected ? 'Display ready' : 'No XREAL display'}
        </span>
        <button
          className="icon-button notification-button"
          data-active={notificationCenterOpen}
          onClick={onToggleNotifications}
          aria-label={`Open notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
        >
          <Bell size={18} />
          {unreadNotifications ? <span>{Math.min(unreadNotifications, 9)}</span> : null}
        </button>
        <button className="icon-button" onClick={onHelp} aria-label="Open setup help">
          <CircleHelp size={19} />
        </button>
      </div>
    </header>
  );
}
