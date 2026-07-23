import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useJobStream } from '../contexts/TsxJobsContext';

interface JobStreamViewProps {
  jobId: string;
  label?: string;
  /** Rendered until the first stream chunk arrives. */
  fallback?: ReactNode;
}

/** Auto-scrolling live view of a job's streamed LLM output. */
export function JobStreamView({ jobId, label, fallback }: JobStreamViewProps) {
  const text = useJobStream(jobId);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = preRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  if (!text) return <>{fallback ?? null}</>;

  return (
    <div
      className="flex-1 min-h-0 flex flex-col m-2 rounded-lg overflow-hidden"
      style={{ border: '0.5px solid var(--color-border)', background: 'var(--color-app-bg)' }}
    >
      {label && (
        <div
          className="px-3 py-1.5 text-[10px] text-text-dim shrink-0"
          style={{ borderBottom: '0.5px solid var(--color-border)' }}
        >
          {label}
        </div>
      )}
      <pre
        ref={preRef}
        className="flex-1 min-h-0 overflow-auto px-3 py-2 text-[10px] leading-[1.5] text-text-secondary font-mono whitespace-pre-wrap"
      >
        {text}
      </pre>
    </div>
  );
}
