// `image-set` — a grid with a lightbox (agents plan §1.3 wave 1).
//
// §1.3 names Image Studio's `ImageCard` and `ImageLightbox` as the things to
// reuse. They live inside `src/features/image-studio/`, and a viewer that Flows
// also consumes must not reach into another feature — so the grid and the
// lightbox are written here instead of moving two components out of a feature
// that is not being worked on. They are small; the rule is worth more.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ArtifactViewerProps } from './types';
import { ViewerFrame } from './ViewerFrame';

export function ImageSetViewer({ artifact, resolved, loading, error }: ArtifactViewerProps) {
  const urls = resolved?.assetUrls ?? [];
  const items = artifact.kind === 'image-set' ? artifact.payload.items : [];
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => setOpen(null), [artifact.id]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? null : Math.min(urls.length - 1, i + 1)));
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? null : Math.max(0, i - 1)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, urls.length]);

  return (
    <ViewerFrame
      {...(loading !== undefined ? { loading } : {})}
      {...(error !== undefined ? { error } : {})}
      ready={urls.length > 0}
      emptyLabel="These image files are no longer on disk."
    >
      <div className="h-full w-full overflow-y-auto p-3">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {urls.map((url, i) => (
            <button
              key={url}
              onClick={() => setOpen(i)}
              className="group relative aspect-square rounded-[8px] overflow-hidden bg-app-hover"
              style={{ border: '0.5px solid var(--color-border)' }}
            >
              <img src={url} alt={artifact.title} className="w-full h-full object-cover" />
              {items[i] ? (
                <span className="absolute bottom-1 right-1 rounded-[4px] bg-black/60 px-1 py-[1px] text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                  {items[i].width}×{items[i].height}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {open !== null && urls[open] ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-8"
          onClick={() => setOpen(null)}
        >
          <img src={urls[open]} alt={artifact.title} className="max-h-full max-w-full object-contain" />
          <button
            onClick={() => setOpen(null)}
            title="Close (Esc)"
            className="absolute top-4 right-4 flex items-center justify-center w-[28px] h-[28px] rounded-[6px] bg-app-surface text-text-muted hover:text-text-primary"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      ) : null}
    </ViewerFrame>
  );
}
