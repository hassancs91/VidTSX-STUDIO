import { useState } from 'react';
import type { CSSProperties } from 'react';
import { THREAD_COLLAPSED_TURNS, visibleTurns, type ThreadTurn } from '../services/project-thread';

const CLAMP_2: CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };

interface Props {
  turns: ThreadTurn[];
  /** The open version's number, to mark its reply. */
  currentVersion: number | null;
  onOpenVersion: (version: number) => void;
}

/**
 * The open project's conversation above the Edit box (P3 part 3): what was
 * asked and what each version became, the latest exchange shown and the rest
 * folded. A reply's version opens it; a builder reply's summary says what the
 * builder did. Nothing shows for a project without a chat.json.
 */
export function ProjectThread({ turns, currentVersion, onOpenVersion }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [openSummaries, setOpenSummaries] = useState<ReadonlySet<number>>(new Set());
  if (turns.length === 0) return null;
  const { shown, hidden } = visibleTurns(turns, expanded);
  const offset = turns.length - shown.length;

  const toggleSummary = (index: number) => setOpenSummaries((prev) => {
    const next = new Set(prev);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  });

  return (
    <div className="shrink-0 px-3 pt-2 flex flex-col gap-1" style={{ borderTop: '0.5px solid var(--color-border)' }} data-project-thread>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-muted font-medium">Thread</span>
        {turns.length > THREAD_COLLAPSED_TURNS && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-[10px] text-text-dim hover:text-text-primary cursor-pointer"
            data-thread-toggle
          >
            {expanded ? 'Latest only' : `${hidden} earlier`}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5 overflow-y-auto" style={expanded ? { maxHeight: 220 } : undefined}>
        {shown.map((turn, i) => {
          const index = offset + i;
          const summaryOpen = openSummaries.has(index);
          return (
            <div key={index} className="flex gap-2 min-w-0" data-thread-turn={turn.role}>
              <div className="w-[30px] shrink-0 leading-[16px]">
                {turn.role === 'user' ? (
                  <span className="text-[10px] text-text-dim">You</span>
                ) : turn.version !== null ? (
                  <button
                    onClick={() => onOpenVersion(turn.version!)}
                    title={`Open v${turn.version}`}
                    className={`px-1 rounded text-[10px] leading-[16px] cursor-pointer ${turn.version === currentVersion ? 'text-accent-light bg-app-active' : 'text-text-secondary hover:bg-app-hover'}`}
                    data-thread-version={turn.version}
                  >
                    v{turn.version}
                  </button>
                ) : (
                  <span className="text-[10px] text-text-dim">AI</span>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div
                  className={`text-[11px] leading-[16px] whitespace-pre-wrap break-words ${turn.role === 'user' ? 'text-text-primary' : 'text-text-secondary'}`}
                  style={CLAMP_2}
                  title={turn.content}
                >
                  {turn.content}
                </div>
                {turn.summary && (
                  <div className="text-[10px] leading-[14px] text-text-dim whitespace-pre-wrap break-words">
                    <span style={summaryOpen ? undefined : CLAMP_2}>{turn.summary}</span>
                    <button onClick={() => toggleSummary(index)} className="text-[10px] text-accent hover:underline cursor-pointer">
                      {summaryOpen ? 'less' : 'more'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
