import { useMemo, useState } from 'react';
import {
  FilePlus2,
  LockKeyhole,
  NotebookPen,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import { Button, EmptyState, SectionHeading } from '../components/ui';
import { relativeTime } from '../lib/format';
import { useHub } from '../state/HubContext';

export function Notes({ onToast }: { onToast(message: string, detail?: string): void }) {
  const {
    state,
    selectedNoteId,
    setSelectedNoteId,
    createNote,
    updateNote,
    deleteNote,
    recordActivity,
  } = useHub();
  const [query, setQuery] = useState('');
  const selected =
    state.notes.find((note) => note.id === selectedNoteId) ?? state.notes[0] ?? null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.notes;
    return state.notes.filter((note) =>
      `${note.title} ${note.body} ${note.tags.join(' ')}`.toLowerCase().includes(needle),
    );
  }, [query, state.notes]);

  function addNote() {
    createNote();
    recordActivity({
      kind: 'note',
      title: 'New note created',
      detail: 'Saved locally and ready to edit.',
    });
  }

  function removeSelected() {
    if (!selected) return;
    const confirmed = window.confirm(`Delete “${selected.title}”? This cannot be undone.`);
    if (!confirmed) return;
    deleteNote(selected.id);
    recordActivity({
      kind: 'note',
      title: 'Note deleted',
      detail: selected.title,
    });
    onToast('Note deleted');
  }

  function updateTags(value: string) {
    if (!selected) return;
    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);
    updateNote(selected.id, { tags });
  }

  return (
    <div className="module-page module-page--fixed">
      <SectionHeading
        eyebrow="Local notebook"
        title="Notes & study"
        description="Fast capture for coursework, troubleshooting, and ideas—stored on this device."
        actions={
          <Button variant="primary" onClick={addNote}>
            <FilePlus2 size={17} /> New note
          </Button>
        }
      />

      <section className="notes-workspace card-surface">
        <aside className="notes-list-pane">
          <label className="search-field">
            <Search size={16} aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
            />
          </label>
          <div className="notes-list" role="listbox" aria-label="Notes">
            {filtered.map((note) => (
              <button
                key={note.id}
                className="note-list-item"
                data-active={selected?.id === note.id}
                onClick={() => setSelectedNoteId(note.id)}
                role="option"
                aria-selected={selected?.id === note.id}
              >
                <strong>{note.title || 'Untitled note'}</strong>
                <span>{note.body.replace(/\s+/g, ' ').slice(0, 80) || 'Empty note'}</span>
                <small>
                  {relativeTime(note.updatedAt)}
                  {note.tags[0] ? <i>#{note.tags[0]}</i> : null}
                </small>
              </button>
            ))}
            {!filtered.length ? (
              <div className="list-empty">No notes match “{query}”.</div>
            ) : null}
          </div>
          <div className="notes-list-pane__footer">
            <LockKeyhole size={14} />
            <span>{state.notes.length} notes · stored locally</span>
          </div>
        </aside>

        <div className="note-editor-pane">
          {selected ? (
            <>
              <div className="note-editor__toolbar">
                <div className="save-state">
                  <span className="status-dot" /> Autosaved locally
                </div>
                <button
                  className="icon-button icon-button--danger"
                  onClick={removeSelected}
                  aria-label="Delete note"
                  title="Delete note"
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <input
                className="note-title-input"
                value={selected.title}
                onChange={(event) => updateNote(selected.id, { title: event.target.value })}
                placeholder="Note title"
                aria-label="Note title"
              />
              <div className="tag-editor">
                <Tag size={15} />
                <input
                  value={selected.tags.join(', ')}
                  onChange={(event) => updateTags(event.target.value)}
                  placeholder="Add comma-separated tags"
                  aria-label="Note tags"
                />
              </div>
              <textarea
                className="note-body-input"
                value={selected.body}
                onChange={(event) => updateNote(selected.id, { body: event.target.value })}
                placeholder="Start writing…"
                aria-label="Note body"
              />
              <footer className="note-editor__footer">
                <span>{selected.body.trim() ? selected.body.trim().split(/\s+/).length : 0} words</span>
                <span>Updated {relativeTime(selected.updatedAt)}</span>
              </footer>
            </>
          ) : (
            <EmptyState
              icon={<NotebookPen size={28} />}
              title="No note selected"
              description="Create a note to start capturing ideas and study material."
              action={<Button onClick={addNote}>Create note</Button>}
            />
          )}
        </div>
      </section>
    </div>
  );
}
