import { useState } from 'react';
import { SpellCheck } from 'lucide-react';
import type { StudioVocabularyProposal, StudioVocabularySource } from '@shared/types/studio-memory';

const SOURCE_LABEL: Record<StudioVocabularySource, string> = {
  transcript: 'heard',
  script: 'script',
  memory: 'memory',
  chat: 'chat',
};

interface Props {
  proposal: StudioVocabularyProposal;
  error: string | null;
  resolving: boolean;
  onAccept: (terms: string[]) => void;
  onReject: () => void;
}

/** The pending vocabulary card (W4): the agent found names the brand should
 *  spell right. Multi-select — every term starts ticked; accept writes the
 *  ticked ones to the brand and retires matching memories in one click. */
export function VocabularyProposalCard({ proposal, error, resolving, onAccept, onReject }: Props) {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(proposal.terms.map((t) => t.term)));
  const count = ticked.size;

  const toggle = (term: string) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });
  };

  return (
    <div
      className="rounded-[8px] bg-app-base p-2.5 space-y-1.5"
      style={{ border: '0.5px solid var(--color-accent-green, #22c55e)' }}
      data-vocabulary-proposal={proposal.id}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-accent-green">
        <SpellCheck size={11} strokeWidth={1.75} className="shrink-0" />
        <span className="font-medium">Add to the brand vocabulary?</span>
        <span className="text-text-ghost truncate">· {proposal.brandName}</span>
      </div>

      {proposal.note && <div className="text-[10px] text-text-dim leading-snug">{proposal.note}</div>}

      <div className="space-y-1">
        {proposal.terms.map((t) => (
          <label key={t.term} className="flex items-start gap-1.5 cursor-pointer" data-vocabulary-term={t.term}>
            <input
              type="checkbox"
              checked={ticked.has(t.term)}
              onChange={() => toggle(t.term)}
              disabled={resolving}
              className="mt-[2px] accent-[var(--color-accent-green,#22c55e)]"
            />
            <span className="min-w-0 leading-snug">
              <span className="text-[11px] text-text-primary">{t.term}</span>
              {t.aliases && t.aliases.length > 0 && (
                <span className="text-[10px] text-text-dim"> · not {t.aliases.map((a) => `“${a}”`).join(', ')}</span>
              )}
              <span className="text-[10px] text-text-ghost"> · {SOURCE_LABEL[t.source]}</span>
              {t.note && <div className="text-[10px] text-text-dim">{t.note}</div>}
            </span>
          </label>
        ))}
      </div>

      <div className="text-[10px] text-text-ghost">
        The transcriber is primed with these; their manglings are corrected in every later transcript.
      </div>

      {error && (
        <div className="text-[10px] text-accent-red leading-snug" data-vocabulary-proposal-error>
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-1 pt-0.5">
        <button
          type="button"
          onClick={onReject}
          disabled={resolving}
          data-vocabulary-proposal-reject
          className="px-2 py-1 rounded-[5px] text-[10px] transition-colors disabled:opacity-40 text-text-muted hover:bg-app-hover hover:text-text-secondary"
        >
          No thanks
        </button>
        <button
          type="button"
          onClick={() => onAccept([...ticked])}
          disabled={resolving || count === 0}
          data-vocabulary-proposal-accept
          className="px-2 py-1 rounded-[5px] text-[10px] font-medium transition-colors disabled:opacity-40 bg-accent-green/15 text-accent-green hover:bg-accent-green/25"
        >
          Add {count} to brand
        </button>
      </div>
    </div>
  );
}
