// The Notes tab (video-10 import gap 7): Markdown files under the project's
// `notes/` folder. A list on top, the open note below, saved as you type.
// The assistant reads these through `list_notes` / `read_note`; it never
// writes them.

import { useState } from 'react';
import { FilePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useProjectNotes } from '../hooks/useProjectNotes';

interface Props {
  projectId: string;
}

export function NotesPanel({ projectId }: Props) {
  const notes = useProjectNotes(projectId);
  const [newName, setNewName] = useState('');
  const [naming, setNaming] = useState(false);

  const submitNew = async () => {
    const name = newName.trim();
    if (!name) return;
    if (await notes.create(name)) {
      setNewName('');
      setNaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0" data-notes-panel>
      <div
        className="flex items-center gap-2 px-3 h-[32px] shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[10px] uppercase tracking-wider text-text-muted">Notes</span>
        <div className="flex-1" />
        <span className="text-[10px] text-text-ghost">
          {notes.status === 'saving' ? 'Saving…' : notes.status === 'saved' ? 'Saved' : notes.status === 'error' ? 'Error' : ''}
        </span>
        <button
          type="button"
          title="Re-read the notes folder"
          onClick={() => void notes.reload()}
          className="p-1 rounded text-text-muted hover:text-text-primary"
        >
          <RefreshCw size={12} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          title="New note"
          onClick={() => setNaming(true)}
          className="p-1 rounded text-text-muted hover:text-text-primary"
          data-notes-new
        >
          <FilePlus size={12} strokeWidth={1.75} />
        </button>
      </div>

      {naming && (
        <form
          className="flex items-center gap-2 px-3 py-2 shrink-0"
          style={{ borderBottom: '0.5px solid var(--color-border)' }}
          onSubmit={(e) => {
            e.preventDefault();
            void submitNew();
          }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Note name"
            className="flex-1 min-w-0 bg-app-deep text-text-primary text-[11px] px-2 py-1 rounded-[6px] focus:outline-none"
            style={{ border: '0.5px solid var(--color-border)' }}
            data-notes-name
          />
          <button type="submit" className="text-[11px] px-2 py-1 rounded-[6px] bg-accent text-white">
            Create
          </button>
          <button type="button" onClick={() => setNaming(false)} className="text-[11px] text-text-muted hover:text-text-primary">
            Cancel
          </button>
        </form>
      )}

      <div className="shrink-0 max-h-[40%] overflow-auto" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        {notes.notes.length === 0 ? (
          <div className="px-3 py-3 text-[11px] text-text-dim leading-snug">
            No notes yet. Notes are Markdown files in the project&apos;s <code>notes</code> folder —
            plans, import reports, QA passes. The assistant can read them.
          </div>
        ) : (
          notes.notes.map((note) => (
            <div
              key={note.name}
              className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer ${
                note.name === notes.openName ? 'bg-app-active' : 'hover:bg-app-hover'
              }`}
              onClick={() => void notes.open(note.name)}
              data-note-row={note.name}
            >
              <span className="flex-1 min-w-0 truncate text-[11px] text-text-primary">{note.name}</span>
              <span className="text-[10px] text-text-ghost">{(note.size / 1024).toFixed(1)} KB</span>
              <button
                type="button"
                title="Delete note"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete ${note.name}? This removes the file.`)) void notes.remove(note.name);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-accent-red"
              >
                <Trash2 size={11} strokeWidth={1.75} />
              </button>
            </div>
          ))
        )}
      </div>

      {notes.openName ? (
        <textarea
          value={notes.text}
          onChange={(e) => notes.edit(e.target.value)}
          spellCheck={false}
          placeholder="Write in Markdown."
          data-notes-editor
          className="flex-1 min-h-0 w-full resize-none bg-app-deep text-text-primary text-[12px] leading-relaxed px-3 py-2.5 focus:outline-none placeholder:text-text-ghost"
        />
      ) : (
        <div className="flex-1 min-h-0 flex items-center justify-center text-[11px] text-text-ghost px-4 text-center">
          Pick a note above, or create one.
        </div>
      )}

      {notes.error && (
        <div className="px-3 py-2 text-[10px] text-accent-red shrink-0" style={{ borderTop: '0.5px solid var(--color-border)' }}>
          {notes.error}
        </div>
      )}
    </div>
  );
}
