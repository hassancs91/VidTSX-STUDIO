import { forwardRef } from 'react';

interface HtmlPreviewProps {
  html: string;
}

export const HtmlPreview = forwardRef<HTMLIFrameElement, HtmlPreviewProps>(
  function HtmlPreview({ html }, ref) {
    return (
      <iframe
        ref={ref}
        srcDoc={html}
        sandbox="allow-scripts allow-same-origin"
        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
        title="Prototype preview"
      />
    );
  }
);
