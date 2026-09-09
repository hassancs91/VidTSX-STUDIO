// The Script tab (V1 completion plan §2.4): the intended final read. One
// textarea over `project.script`, persisted through the document's
// single-writer save like the project name — a settings-style edit, not an
// undoable timeline op. Three readers depend on it: the editorial pass
// (which take is the keeper), the transcription feed (its proper nouns
// prime the engine) and the vocabulary proposals the agent makes from it.

import { STUDIO_SCRIPT_MAX_CHARS } from '@shared/types/studio';

interface Props {
  script: string | undefined;
  onChange: (script: string | undefined) => void;
}

export function ScriptPanel({ script, onChange }: Props) {
  const value = script ?? '';
  const length = value.length;
  return (
    <div className="flex flex-col h-full min-h-0" data-script-panel>
      <div
        className="flex items-center gap-2 px-3 h-[32px] shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[10px] uppercase tracking-wider text-text-muted">Script</span>
        <div className="flex-1" />
        <span
          className={`text-[10px] ${length > STUDIO_SCRIPT_MAX_CHARS ? 'text-accent-red' : 'text-text-ghost'}`}
        >
          {length.toLocaleString()} / {STUDIO_SCRIPT_MAX_CHARS.toLocaleString()}
        </span>
      </div>
      <textarea
        value={value}
        maxLength={STUDIO_SCRIPT_MAX_CHARS}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        placeholder={
          'Paste or write the script — the intended final read.\n\n' +
          'The assistant reads it to pick the keeper take on an editorial pass, its names prime the transcription engine, and it proposes vocabulary from it.'
        }
        spellCheck={false}
        data-script-editor
        className="flex-1 min-h-0 w-full resize-none bg-app-deep text-text-primary text-[12px] leading-relaxed px-3 py-2.5 focus:outline-none placeholder:text-text-ghost"
      />
      <div
        className="px-3 py-2 text-[10px] text-text-dim leading-snug shrink-0"
        style={{ borderTop: '0.5px solid var(--color-border)' }}
      >
        Saved with the project. The first 1,500 characters reach the assistant every turn; it reads
        the rest on demand.
      </div>
    </div>
  );
}
