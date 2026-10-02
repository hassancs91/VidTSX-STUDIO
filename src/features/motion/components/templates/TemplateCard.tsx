import { useState } from 'react';
import type { TemplateIpc } from '@shared/ipc/types';
import { categoryLabel } from './template-labels';

interface TemplateCardProps {
  template: TemplateIpc;
  onOpen: (template: TemplateIpc) => void;
  /** Offered on user-installed templates only; built-ins are read-only. */
  onRemove?: (template: TemplateIpc) => void;
}

/** One gallery card (UI_SPEC "Template store screen"): thumbnail, name, category. */
export function TemplateCard({ template, onOpen, onRemove }: TemplateCardProps) {
  const { manifest, thumbnailUrl } = template;
  const [thumbFailed, setThumbFailed] = useState(false);
  const installed = template.origin === 'user';

  return (
    <div className="group relative flex">
      <button
        onClick={() => onOpen(template)}
        title={manifest.description || manifest.name}
        data-template-id={manifest.id}
        data-template-origin={template.origin}
        className="flex-1 min-w-0 flex flex-col text-left bg-app-surface rounded-[8px] overflow-hidden cursor-pointer transition-colors duration-150 hover:border-[#444]"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div className="w-full aspect-video bg-app-player flex items-center justify-center overflow-hidden">
          {thumbnailUrl && !thumbFailed ? (
            <img
              src={thumbnailUrl}
              alt=""
              loading="lazy"
              onError={() => setThumbFailed(true)}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="px-2 text-[11px] text-text-dim text-center">{manifest.name}</span>
          )}
        </div>
        <div className="w-full px-2 py-1.5 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="flex-1 min-w-0 truncate text-[11px] font-medium text-text-primary">{manifest.name}</span>
            {manifest.overlay && (
              <span
                className="shrink-0 text-[9px] px-[5px] py-[1px] rounded-[4px] bg-app-hover text-text-muted"
                title="Transparent background — sits over your footage"
              >
                Overlay
              </span>
            )}
          </div>
          <span className="text-[10px] text-text-dim truncate">
            {categoryLabel(manifest.category)}
            {installed && <span title={`Installed by you — version ${manifest.version}`}> · Installed</span>}
          </span>
        </div>
      </button>
      {installed && onRemove && (
        <button
          onClick={() => onRemove(template)}
          title="Remove this installed template"
          aria-label={`Remove ${manifest.name}`}
          data-template-remove={manifest.id}
          className="absolute top-1 right-1 w-[18px] h-[18px] rounded-[4px] bg-black/55 text-text-muted hover:text-accent-red flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
        >
          <svg width={9} height={9} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
            <path d="M2 2l6 6M8 2l-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
