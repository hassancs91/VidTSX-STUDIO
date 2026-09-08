// `document` — the markdown pane (agents plan §1.3 wave 1).
//
// Documents are what an agent shows the user to READ and choose between: a
// script, two hook variants, a shot list. So this is a reading pane at document
// width, not a chat bubble — the same react-markdown the AI chat uses, with the
// element styles UI_SPEC gives body text.

import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ArtifactViewerProps } from './types';
import { ViewerFrame } from './ViewerFrame';

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="text-[15px] font-medium text-text-primary mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[13px] font-medium text-text-primary mt-4 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[12px] font-medium text-text-secondary mt-3 mb-1.5">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2.5 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2.5 space-y-1">{children}</ol>,
  strong: ({ children }) => <strong className="text-text-primary font-medium">{children}</strong>,
  a: ({ children }) => <span className="text-accent-blue">{children}</span>,
  blockquote: ({ children }) => (
    <blockquote className="pl-3 my-2.5 text-text-muted" style={{ borderLeft: '2px solid var(--color-border-hover)' }}>
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="px-1 py-0.5 rounded bg-app-base text-[11px] font-mono">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-app-base rounded-[6px] p-2.5 my-2.5 overflow-x-auto text-[11px]">{children}</pre>
  ),
  hr: () => <hr className="my-4" style={{ borderColor: 'var(--color-border)' }} />,
};

export function DocumentViewer({ resolved, loading, error }: ArtifactViewerProps) {
  const text = resolved?.text ?? '';
  return (
    <ViewerFrame
      {...(loading !== undefined ? { loading } : {})}
      {...(error !== undefined ? { error } : {})}
      ready={text.length > 0}
      emptyLabel="This document is empty."
    >
      <div className="h-full w-full overflow-y-auto px-6 py-5">
        {/* No title line: a document almost always opens with its own H1, and
            the action bar names the artifact — printing it here read as a
            duplicate heading in the real app. */}
        <div className="mx-auto max-w-[720px]">
          <div className="text-[12px] text-text-secondary leading-relaxed">
            <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
              {text}
            </Markdown>
          </div>
        </div>
      </div>
    </ViewerFrame>
  );
}
