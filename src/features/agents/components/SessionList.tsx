// Saved sessions for one agent (agents plan §1.5): title, last opened,
// artifact count, thumbnail. Open, rename, delete.
//
// Delete removes the SESSION FOLDER only. Media already filed in the library
// stays, because the user may have used it elsewhere — the copy says so, so
// nobody has to guess.

import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { AgentSessionSummary } from '@shared/types/agents';

interface Props {
  sessions: AgentSessionSummary[];
  activeId: string | null;
  /** Module-server url per thumbnail relPath; absent while it resolves. */
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onRename: (sessionId: string, title: string) => void;
  onDelete: (sessionId: string) => void;
}

function relativeDay(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function SessionList({ sessions, activeId, onSelect, onCreate, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setConfirmDelete(null);
  }, [sessions.length]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-2.5 h-[32px] shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] font-medium text-text-muted">Sessions</span>
        <button
          onClick={onCreate}
          title="New session"
          className="flex items-center justify-center w-[20px] h-[20px] rounded-[5px] text-text-muted hover:bg-app-hover hover:text-text-secondary"
        >
          <Plus size={12} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {sessions.length === 0 ? (
          <div className="px-2.5 py-2 text-[11px] text-text-dim leading-snug">
            No saved sessions yet.
          </div>
        ) : (
          sessions.map((session) => {
            const active = session.id === activeId;
            return (
              <div
                key={session.id}
                className={`group mx-1 rounded-[6px] px-2 py-1.5 cursor-pointer ${
                  active ? 'bg-app-active' : 'hover:bg-app-hover'
                }`}
                onClick={() => onSelect(session.id)}
              >
                {editing === session.id ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={draft}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRename(session.id, draft);
                          setEditing(null);
                        }
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      className="flex-1 min-w-0 h-[22px] rounded-[5px] bg-app-base px-1.5 text-[11px] text-text-secondary outline-none"
                      style={{ border: '0.5px solid var(--color-border-input)' }}
                    />
                    <IconButton title="Save" onClick={() => { onRename(session.id, draft); setEditing(null); }}>
                      <Check size={11} />
                    </IconButton>
                    <IconButton title="Cancel" onClick={() => setEditing(null)}>
                      <X size={11} />
                    </IconButton>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1">
                      <span
                        className={`flex-1 min-w-0 truncate text-[11px] ${
                          active ? 'text-accent-light' : 'text-text-secondary'
                        }`}
                      >
                        {session.title}
                      </span>
                      <span className="hidden group-hover:flex items-center gap-0.5">
                        <IconButton
                          title="Rename"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDraft(session.title);
                            setEditing(session.id);
                          }}
                        >
                          <Pencil size={11} />
                        </IconButton>
                        <IconButton
                          title="Delete this session"
                          danger
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(session.id);
                          }}
                        >
                          <Trash2 size={11} />
                        </IconButton>
                      </span>
                    </div>
                    <div className="text-[9px] text-text-dim mt-[1px]">
                      {relativeDay(session.lastOpenedAt)}
                      {session.artifactCount > 0
                        ? ` · ${session.artifactCount} result${session.artifactCount === 1 ? '' : 's'}`
                        : ''}
                      {session.pendingInteraction ? ' · waiting for you' : ''}
                    </div>
                    {confirmDelete === session.id ? (
                      <div
                        className="mt-1.5 rounded-[6px] bg-app-base p-1.5"
                        onClick={(e) => e.stopPropagation()}
                        style={{ border: '0.5px solid var(--color-border)' }}
                      >
                        <div className="text-[10px] text-text-muted leading-snug mb-1.5">
                          Delete this session? Files already saved to the library are kept.
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              onDelete(session.id);
                              setConfirmDelete(null);
                            }}
                            className="rounded-[5px] px-2 py-[2px] text-[10px] text-accent-red hover:bg-app-hover"
                            style={{ border: '0.5px solid var(--color-border-hover)' }}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-[5px] px-2 py-[2px] text-[10px] text-text-muted hover:bg-app-hover"
                          >
                            Keep
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function IconButton({
  title,
  onClick,
  children,
  danger,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex items-center justify-center w-[18px] h-[18px] rounded-[4px] hover:bg-app-hover ${
        danger ? 'text-accent-red' : 'text-text-muted'
      }`}
    >
      {children}
    </button>
  );
}
