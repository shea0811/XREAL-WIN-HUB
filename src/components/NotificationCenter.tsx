import { Bell, CheckCheck, Inbox, Trash2, X } from 'lucide-react';
import { relativeTime } from '../lib/format';
import type { HubNotification } from '../types';

export function NotificationCenter({
  open,
  notifications,
  onClose,
  onMarkRead,
  onClear,
}: {
  open: boolean;
  notifications: HubNotification[];
  onClose(): void;
  onMarkRead(): void;
  onClear(): void;
}) {
  if (!open) return null;

  return (
    <div className="notification-layer" role="presentation" onMouseDown={onClose}>
      <aside
        className="notification-center"
        role="dialog"
        aria-modal="true"
        aria-label="Notification centre"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="notification-center__header">
          <span className="settings-group__icon"><Bell size={20} /></span>
          <div>
            <span className="eyebrow">On this device</span>
            <h2>Notifications</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close notifications">
            <X size={18} />
          </button>
        </header>

        <div className="notification-center__actions">
          <button onClick={onMarkRead} disabled={!notifications.some((item) => !item.read)}>
            <CheckCheck size={15} /> Mark all read
          </button>
          <button onClick={onClear} disabled={!notifications.length}>
            <Trash2 size={15} /> Clear all
          </button>
        </div>

        <div className="notification-center__list">
          {notifications.map((item) => (
            <article key={item.id} className="notification-item" data-read={item.read}>
              <span className="notification-item__dot" data-tone={item.tone} />
              <div>
                <strong>{item.title}</strong>
                {item.detail ? <p>{item.detail}</p> : null}
                <time>{relativeTime(item.createdAt)}</time>
              </div>
            </article>
          ))}
          {!notifications.length ? (
            <div className="notification-empty">
              <Inbox size={30} />
              <strong>You’re all caught up</strong>
              <span>New Hub and media alerts will appear here.</span>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
