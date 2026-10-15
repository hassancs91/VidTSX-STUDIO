import { useEffect, useState } from 'react';
import { Button } from '@shared/components';
import type { TsxJobIpc } from '@shared/ipc/types';
import { isJobActive } from '../services/creator-jobs';
import {
  checksText,
  formatElapsed,
  formatLine,
  jobElapsedMs,
  latestLook,
  outcomeText,
  panelTitle,
  tokensText,
  verdictChips,
} from '../services/build-panel-view';
import { BuildStills } from './BuildStills';
import { JobStreamView } from './JobStreamView';

const WAITING_TEXT = {
  creator: 'Waiting for the build in progress (one build runs at a time)',
  other: 'Waiting for another build (an agent, Studio or a flow) to finish',
} as const;

const ENDED_TEXT: Partial<Record<TsxJobIpc['status'], string>> = { done: 'Done', error: 'Failed', cancelled: 'Cancelled' };

interface Props {
  job: TsxJobIpc;
  /** A queued build: whose build it waits for. */
  waiting: 'creator' | 'other' | null;
  onCancel: () => void;
  /** Leave the build view (a build that ended). */
  onClose: () => void;
}

/**
 * The centre panel while the Creator watches a build (P3 part 2) or a builder
 * edit (part 3): round, phase, checks, tokens and time from the job snapshot,
 * the frames the builder last looked at, and its notes as it writes them.
 */
export function BuildProgressPanel({ job, waiting, onCancel, onClose }: Props) {
  const active = isJobActive(job);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const build = job.build;
  if (!build) return null;
  const checks = checksText(build);
  const tokens = tokensText(build);
  const outcome = outcomeText(job);
  const title = panelTitle(job);
  const status = job.status === 'queued'
    ? (waiting ? WAITING_TEXT[waiting] : 'Queued')
    : active ? job.progress.label : ENDED_TEXT[job.status] ?? job.status;

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0" data-build-panel={job.id}>
      <div
        className="flex items-center h-[36px] px-3 gap-2 shrink-0 bg-app-surface"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] font-medium text-text-secondary shrink-0">{title.kind}</span>
        <span className="text-[11px] text-text-dim truncate" title={job.prompt}>{title.name}</span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {active ? (
            <button
              onClick={onCancel}
              disabled={Boolean(build.stopping)}
              className="px-3 py-1 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer text-red-400 hover:text-white hover:bg-red-500/80 disabled:opacity-50 disabled:cursor-default"
              style={{ border: '1px solid rgba(239,68,68,0.4)' }}
              data-build-cancel
            >
              {build.stopping ? 'Stopping…' : 'Cancel'}
            </button>
          ) : (
            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1" data-build-status>
          <div className="text-[12px] text-text-primary">{status}</div>
          <div className="text-[10px] text-text-dim">{formatLine(build)}</div>
          <div className="text-[10px] text-text-muted flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>{formatElapsed(jobElapsedMs(job, now))}</span>
            <span className="text-text-dim">·</span>
            <span>{checks.short}</span>
            <span className="text-text-dim">·</span>
            <span title={tokens.detail} className="cursor-help">{tokens.short}</span>
            {verdictChips(build).map((chip) => (
              <span
                key={chip.text}
                className={`px-1.5 rounded text-[9px] ${chip.bad ? 'text-accent-red' : 'text-text-secondary'}`}
                style={{ border: '0.5px solid var(--color-border)' }}
              >
                {chip.text}
              </span>
            ))}
          </div>
          {checks.error && (
            <div className="text-[10px] text-accent-red truncate" title={checks.error}>{checks.error}</div>
          )}
          {active && job.status !== 'queued' && (
            <div className="h-[3px] rounded-full bg-app-base overflow-hidden mt-1">
              <div className="h-full bg-accent rounded-full transition-[width] duration-500" style={{ width: `${job.progress.percent}%` }} />
            </div>
          )}
          {outcome && (
            <div className={`text-[11px] mt-1 ${outcome.bad ? 'text-accent-red' : 'text-text-secondary'}`}>{outcome.text}</div>
          )}
        </div>

        {(active || build.stills.length > 0) && <BuildStills stills={latestLook(build.stills)} />}

        {/* The builder's own words between tools; gone once the job ends. */}
        <div className="flex flex-col max-h-[200px] -mx-2">
          <JobStreamView jobId={job.id} label="Builder notes" />
        </div>
      </div>
    </div>
  );
}
