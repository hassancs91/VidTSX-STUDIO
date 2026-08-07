import { Sparkles } from 'lucide-react';

/** Placeholder chat surface — the editing agent (auto-cut proposals, chat
 *  tools) lands here in Phase S3. */
export function AgentPanel() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-center px-4">
        <Sparkles size={26} strokeWidth={1.25} className="text-text-ghost" />
        <div className="text-[12px] font-medium text-text-secondary">Editing assistant</div>
        <div className="text-[11px] text-text-dim leading-snug max-w-[220px]">
          Ask the agent to cut silences, tighten takes, add TSX graphics, or
          place SFX. Its edits appear on the timeline as proposals you review
          before they apply. Arrives in Phase S3.
        </div>
      </div>
      <div className="p-2.5" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        <div
          className="h-[54px] rounded-[8px] bg-app-base px-2.5 py-2 text-[11px] text-text-ghost select-none"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          Describe an edit…
        </div>
      </div>
    </div>
  );
}
