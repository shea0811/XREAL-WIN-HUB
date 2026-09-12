import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  BookPlus,
  FilePlus2,
  FolderPlus,
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
    createNotebook,
    createNoteSection,
    updateNote,
    deleteNote,
    recordActivity,
  } = useHub();
  const initialNote = state.notes.find((note) => note.id === selectedNoteId) ?? state.notes[0];
  const [query, setQuery] = useState('');
  const [activeNotebookId, setActiveNotebookId] = useState(
    initialNote?.notebookId ?? state.notebooks[0]?.id ?? '',
  );
  const [activeSectionId, setActiveSectionId] = useState(
    initialNote?.sectionId ?? state.noteSections[0]?.id ?? '',
  );

  useEffect(() => {
    if (state.noteSections.some((section) => section.id === activeSectionId)) return;
    const firstSection = state.noteSections.find((section) => section.notebookId === activeNotebookId)
      ?? state.noteSections[0];
    setActiveSectionId(firstSection?.id ?? '');
  }, [activeNotebookId, activeSectionId, state.noteSections]);

  const selected = state.notes.find((note) => note.id === selectedNoteId) ?? null;
  const sections = state.noteSections.filter((section) => section.notebookId === activeNotebookId);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle) {
      return state.notes.filter((note) =>
        `${note.title} ${note.body} ${note.tags.join(' ')}`.toLowerCase().includes(needle),
      );
    }
    return state.notes.filter((note) => note.sectionId === activeSectionId);
  }, [activeSectionId, query, state.notes]);

  function selectNotebook(notebookId: string) {
    const section = state.noteSections.find((item) => item.notebookId === notebookId);
    setActiveNotebookId(notebookId);
    setActiveSectionId(section?.id ?? '');
    setSelectedNoteId(state.notes.find((note) => note.sectionId === section?.id)?.id ?? null);
    setQuery('');
  }

  function selectSection(sectionId: string) {
    setActiveSectionId(sectionId);
    setSelectedNoteId(state.notes.find((note) => note.sectionId === sectionId)?.id ?? null);
    setQuery('');
  }

  function selectNote(noteId: string) {
    const note = state.notes.find((item) => item.id === noteId);
    if (note) {
      setActiveNotebookId(note.notebookId);
      setActiveSectionId(note.sectionId);
    }
    setSelectedNoteId(noteId);
  }

  function addNotebook() {
    const name = window.prompt('Name this notebook:', 'New notebook');
    if (!name?.trim()) return;
    const notebook = createNotebook(name);
    setActiveNotebookId(notebook.id);
    setActiveSectionId('');
    setSelectedNoteId(null);
    recordActivity({ kind: 'note', title: 'Notebook created', detail: notebook.name });
    onToast('Notebook created', notebook.name);
  }

  function addSection() {
    if (!activeNotebookId) return;
    const name = window.prompt('Name this section:', 'New section');
    if (!name?.trim()) return;
    const section = createNoteSection(activeNotebookId, name);
    setActiveSectionId(section.id);
    setSelectedNoteId(null);
    recordActivity({ kind: 'note', title: 'Section created', detail: section.name });
    onToast('Section created', section.name);
  }

  function addNote() {
    const note = createNote(activeSectionId);
    setActiveNotebookId(note.notebookId);
    setActiveSectionId(note.sectionId);
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
    recordActivity({ kind: 'note', title: 'Note deleted', detail: selected.title });
    onToast('Note deleted');
  }

  function updateTags(value: string) {
    if (!selected) return;
    updateNote(selected.id, {
      tags: value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8),
    });
  }

  function moveNote(sectionId: string) {
    if (!selected) return;
    const section = state.noteSections.find((item) => item.id === sectionId);
    if (!section) return;
    updateNote(selected.id, { sectionId, notebookId: section.notebookId });
    setActiveNotebookId(section.notebookId);
    setActiveSectionId(section.id);
    onToast('Note moved', section.name);
  }

  return (
    <div className="module-page module-page--fixed">
      <SectionHeading
        eyebrow="Local notebook"
        title="Notes & study"
        description="Organise coursework, troubleshooting and ideas into notebooks, sections and pages."
        actions={<Button variant="primary" onClick={addNote}><FilePlus2 size={17} /> New page</Button>}
      />

      <section className="notes-workspace card-surface">
        <aside className="notebook-pane">
          <div className="notes-pane-heading">
            <span>Notebooks</span>
            <button onClick={addNotebook} aria-label="New notebook" title="New notebook"><BookPlus size={16} /></button>
          </div>
          <div className="notebook-list">
            {state.notebooks.map((notebook) => (
              <button
                key={notebook.id}
                data-active={notebook.id === activeNotebookId}
                onClick={() => selectNotebook(notebook.id)}
              >
                <span style={{ background: notebook.color }} />
                <BookOpen size={16} />
                <strong>{notebook.name}</strong>
              </button>
            ))}
          </div>
          <div className="notes-pane-heading notes-pane-heading--sections">
            <span>Sections</span>
            <button onClick={addSection} aria-label="New section" title="New section"><FolderPlus size={16} /></button>
          </div>
          <div className="section-list">
            {sections.map((section) => (
              <button
                key={section.id}
                data-active={section.id === activeSectionId}
                onClick={() => selectSection(section.id)}
              >
                <span style={{ background: section.color }} />
                <strong>{section.name}</strong>
                <small>{state.notes.filter((note) => note.sectionId === section.id).length}</small>
              </button>
            ))}
          </div>
          <div className="notebook-pane__footer"><LockKeyhole size={14} /> Local only</div>
        </aside>

        <aside className="notes-list-pane">
          <label className="search-field">
            <Search size={16} aria-hidden />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all notes" aria-label="Search notes" />
          </label>
          <div className="notes-list" role="listbox" aria-label="Pages">
            {filtered.map((note) => (
              <button
                key={note.id}
                className="note-list-item"
                data-active={selected?.id === note.id}
                onClick={() => selectNote(note.id)}
                role="option"
                aria-selected={selected?.id === note.id}
              >
                <strong>{note.title || 'Untitled note'}</strong>
                <span>{note.body.replace(/\s+/g, ' ').slice(0, 80) || 'Empty note'}</span>
                <small>{relativeTime(note.updatedAt)}{note.tags[0] ? <i>#{note.tags[0]}</i> : null}</small>
              </button>
            ))}
            {!filtered.length ? <div className="list-empty">{query ? `No notes match “${query}”.` : 'No pages in this section.'}</div> : null}
          </div>
          <div className="notes-list-pane__footer"><span>{filtered.length} page{filtered.length === 1 ? '' : 's'}</span></div>
        </aside>

        <div className="note-editor-pane">
          {selected ? (
            <>
              <div className="note-editor__toolbar">
                <div className="save-state"><span className="status-dot" /> Autosaved locally</div>
                <select value={selected.sectionId} onChange={(event) => moveNote(event.target.value)} aria-label="Move note to section">
                  {state.noteSections.map((section) => {
                    const notebook = state.notebooks.find((item) => item.id === section.notebookId);
                    return <option key={section.id} value={section.id}>{notebook?.name} / {section.name}</option>;
                  })}
                </select>
                <button className="icon-button icon-button--danger" onClick={removeSelected} aria-label="Delete note" title="Delete note"><Trash2 size={17} /></button>
              </div>
              <input className="note-title-input" value={selected.title} onChange={(event) => updateNote(selected.id, { title: event.target.value })} placeholder="Page title" aria-label="Note title" />
              <div className="tag-editor"><Tag size={15} /><input value={selected.tags.join(', ')} onChange={(event) => updateTags(event.target.value)} placeholder="Add comma-separated tags" aria-label="Note tags" /></div>
              <textarea className="note-body-input" value={selected.body} onChange={(event) => updateNote(selected.id, { body: event.target.value })} placeholder="Start writing…" aria-label="Note body" />
              <footer className="note-editor__footer"><span>{selected.body.trim() ? selected.body.trim().split(/\s+/).length : 0} words</span><span>Updated {relativeTime(selected.updatedAt)}</span></footer>
            </>
          ) : (
            <EmptyState icon={<NotebookPen size={28} />} title="No page selected" description="Create a page in this section to start writing." action={<Button onClick={addNote}>Create page</Button>} />
          )}
        </div>
      </section>
    </div>
  );
}
