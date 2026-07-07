import { ArrowRight } from 'lucide-react';
import type { GettingStartedGuide } from '../../../shared/ipc/types';

interface GettingStartedProps {
  guides: GettingStartedGuide[];
}

function openExternal(url: string) {
  window.api.appOpenExternal({ url });
}

export function GettingStarted({ guides }: GettingStartedProps) {
  return (
    <div
      className="bg-app-surface rounded-[8px] overflow-hidden"
      style={{ border: '0.5px solid var(--color-border)' }}
    >
      <div
        className="px-3 py-2"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] font-medium text-text-muted">
          Getting Started
        </span>
      </div>

      <div className="p-2 flex flex-col gap-0.5">
        {guides.map((guide) => (
          <button
            key={guide.id}
            onClick={() => openExternal(guide.url)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-[4px] hover:bg-app-hover transition-colors duration-150 cursor-pointer text-left w-full group"
          >
            <ArrowRight
              size={14}
              strokeWidth={1.5}
              className="text-text-dim group-hover:text-accent shrink-0 transition-colors duration-150"
            />
            <span className="text-[11px] text-text-secondary">
              {guide.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
