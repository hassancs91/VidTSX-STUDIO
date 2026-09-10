// `web-page` — a self-contained HTML page in a sandboxed iframe (W9).
//
// THE SANDBOX IS THE FEATURE. The page is model-written content: it renders
// with `sandbox="allow-scripts"` and NOTHING else — no `allow-same-origin`,
// so it has an opaque origin and cannot touch this window, its storage or
// its IPC bridge — and its srcdoc carries the no-network CSP
// (`buildWebPageSrcdoc`), so every image, video and font is a data: URI main
// already inlined and a `fetch` or an external `<img>` is refused by the
// browser itself. The three widths are the same ones `capture_page` renders at.
//
// "Open in browser" and "Export site" are handoffs, so they live on the stage
// action bar under this pane (viewers stay IPC-free, the registry contract).

import { useMemo, useState } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import {
  WEB_PAGE_VIEWPORTS,
  buildWebPageSrcdoc,
  type WebPageViewport,
} from '@shared/agents/web-page';
import type { ArtifactViewerProps } from './types';
import { ViewerFrame } from './ViewerFrame';

const WIDTHS: Array<{ id: WebPageViewport; label: string; icon: typeof Monitor }> = [
  { id: 'desktop', label: 'Desktop', icon: Monitor },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'phone', label: 'Phone', icon: Smartphone },
];

export function WebPageViewer({ artifact, resolved, loading, error }: ArtifactViewerProps) {
  const html = resolved?.text ?? '';
  const [viewport, setViewport] = useState<WebPageViewport>('desktop');
  const srcdoc = useMemo(() => (html ? buildWebPageSrcdoc(html) : ''), [html]);
  const inlineKb =
    artifact.kind === 'web-page' ? Math.max(1, Math.round(artifact.payload.inlineBytes / 1024)) : 0;
  const width = WEB_PAGE_VIEWPORTS[viewport].width;

  return (
    <ViewerFrame
      {...(loading !== undefined ? { loading } : {})}
      {...(error !== undefined ? { error } : {})}
      ready={html.length > 0}
      emptyLabel="This page is empty."
    >
      <div className="flex flex-col h-full w-full bg-app-player" data-web-page-viewer={viewport}>
        <div
          className="flex items-center gap-1 px-2.5 h-[32px] shrink-0 bg-app-surface"
          style={{ borderBottom: '0.5px solid var(--color-border)' }}
        >
          {WIDTHS.map(({ id, label, icon: Icon }) => {
            const active = id === viewport;
            return (
              <button
                key={id}
                onClick={() => setViewport(id)}
                title={`${label} (${WEB_PAGE_VIEWPORTS[id].width} px)`}
                aria-pressed={active}
                data-web-page-width={id}
                className={`flex items-center gap-1 rounded-[5px] px-2 py-[3px] text-[11px] ${
                  active ? 'bg-app-active text-text-primary' : 'text-text-muted hover:bg-app-hover'
                }`}
              >
                <Icon size={11} strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
          <span className="ml-auto text-[10px] text-text-dim truncate">
            Sandboxed · no network · {inlineKb} KB inlined
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-auto flex justify-center p-3">
          <iframe
            // Keyed so a new version starts from a fresh document, never a
            // navigated-away one.
            key={`${artifact.id}:${artifact.version ?? 1}`}
            title={artifact.title}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={srcdoc}
            className="shrink-0 bg-white rounded-[6px]"
            style={{
              width: viewport === 'desktop' ? '100%' : width,
              maxWidth: '100%',
              height: '100%',
              border: '0.5px solid var(--color-border)',
            }}
          />
        </div>
      </div>
    </ViewerFrame>
  );
}
