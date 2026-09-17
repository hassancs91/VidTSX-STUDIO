import type { ReactNode } from 'react';
import { LocalSectionPanel } from './LocalSectionPanel';

interface LocalDefaultsRowProps {
  label: string;
  hint?: string;
  /** The control — a Select, usually. */
  children: ReactNode;
}

/** The "Defaults" row of the local-model template, where a section owns an app default (Audio: the transcription model). */
export function LocalDefaultsRow({ label, hint, children }: LocalDefaultsRowProps) {
  return (
    <LocalSectionPanel id="defaults" title="Defaults">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[12px] text-text-secondary">{label}</div>
          {hint && <div className="text-[10px] text-text-dim">{hint}</div>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    </LocalSectionPanel>
  );
}
