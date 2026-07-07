import type { WhatsNewEntry, WhatsNewEntryType } from '../../../shared/ipc/types';

interface WhatsNewProps {
  entries: WhatsNewEntry[];
  appVersion?: string;
}

const typeColors: Record<WhatsNewEntryType, string> = {
  feature: '#5DCAA5',
  improvement: '#7F77DD',
  fix: '#EF9F27',
};

export function WhatsNew({ entries, appVersion }: WhatsNewProps) {
  return (
    <div
      className="bg-app-surface rounded-[8px] overflow-hidden"
      style={{ border: '0.5px solid var(--color-border)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] font-medium text-text-muted">
          What's New
        </span>
        {appVersion && (
          <span className="text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-[4px]">
            {appVersion}
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2.5">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2.5">
            <span
              className="w-[6px] h-[6px] rounded-full mt-[4px] shrink-0"
              style={{ backgroundColor: typeColors[entry.type] ?? '#7F77DD' }}
            />
            <span className="text-[11px] text-text-secondary leading-snug">
              {entry.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
