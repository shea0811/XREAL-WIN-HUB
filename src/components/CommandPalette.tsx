import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Glasses,
  MoonStar,
  NotebookPen,
  Search,
  TimerReset,
  X,
  type LucideIcon,
} from 'lucide-react';
import { NAVIGATION } from '../navigation';
import type { HubSection } from '../types';

interface Command {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  keywords: string;
  run(): void;
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onQuickNote,
  onTheatre,
  onMoveToDisplay,
  onFocus,
}: {
  open: boolean;
  onClose(): void;
  onNavigate(section: HubSection): void;
  onQuickNote(): void;
  onTheatre(): void;
  onMoveToDisplay(): void;
  onFocus(): void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(
    () => [
      ...NAVIGATION.map((item) => ({
        id: `navigate-${item.id}`,
        label: `Go to ${item.label}`,
        detail: item.description,
        icon: item.icon,
        keywords: `${item.label} ${item.shortLabel} ${item.description}`,
        run: () => onNavigate(item.id),
      })),
      {
        id: 'quick-note',
        label: 'Create a quick note',
        detail: 'Capture an idea without breaking focus',
        icon: NotebookPen,
        keywords: 'new note write capture study',
        run: onQuickNote,
      },
      {
        id: 'theatre',
        label: 'Enter theatre mode',
        detail: 'Move to the selected display and go full screen',
        icon: MoonStar,
        keywords: 'cinema media full screen xreal',
        run: onTheatre,
      },
      {
        id: 'move-display',
        label: 'Move hub to XREAL display',
        detail: 'Place this window on the preferred display',
        icon: Glasses,
        keywords: 'device glasses screen move monitor',
        run: onMoveToDisplay,
      },
      {
        id: 'focus',
        label: 'Start or pause focus',
        detail: 'Control the 25 minute focus timer',
        icon: TimerReset,
        keywords: 'timer pomodoro concentrate pause',
        run: onFocus,
      },
    ],
    [onFocus, onMoveToDisplay, onNavigate, onQuickNote, onTheatre],
  );

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return commands;
    return commands.filter((command) => {
      const haystack = `${command.label} ${command.detail} ${command.keywords}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter' && filtered[0]) {
        event.preventDefault();
        filtered[0].run();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [filtered, onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-palette__search">
          <Search size={20} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command or section…"
            aria-label="Search commands"
          />
          <button onClick={onClose} aria-label="Close command palette">
            <X size={18} />
          </button>
        </div>
        <div className="command-palette__meta">
          <span>{filtered.length} commands</span>
          <span>
            <kbd>Enter</kbd> to run · <kbd>Esc</kbd> to close
          </span>
        </div>
        <div className="command-list">
          {filtered.length ? (
            filtered.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  className="command-item"
                  data-first={index === 0}
                  onClick={() => {
                    command.run();
                    onClose();
                  }}
                >
                  <span className="command-item__icon">
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong>{command.label}</strong>
                    <small>{command.detail}</small>
                  </span>
                  <ArrowRight size={16} className="command-item__arrow" />
                </button>
              );
            })
          ) : (
            <div className="command-empty">
              <Search size={24} />
              <span>No commands match “{query}”</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
