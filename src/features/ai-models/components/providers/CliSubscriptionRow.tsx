import { useState, type ReactNode } from 'react';
import { Button, StatusBadge } from '@shared/components';
import type { ImageCliProviderStatus } from '@shared/ipc/types';
import { CapabilityBadge } from './CapabilityBadge';
import { ProviderGridRow } from './ProviderGridRow';

export interface CliSubscriptionCopy {
  /** One line when installed + signed in. */
  ready: ReactNode;
  /** One line when installed but the sign-in probe failed (detail appended). */
  signIn: ReactNode;
  /** One line when the CLI is missing. */
  install: ReactNode;
  /** Numbered setup steps for the expander. */
  steps: ReactNode[];
  /** The install command (shown in a code block with the steps). */
  installCommand: string;
}

interface CliSubscriptionRowProps {
  rowId: string;
  name: string;
  /** Capability badges — "Images" today; "LLMs" can join without moving the row. */
  capabilities: string[];
  status: ImageCliProviderStatus | null;
  loading: boolean;
  onRefresh: () => void;
  copy: CliSubscriptionCopy;
}

/**
 * A subscription provider driven through a CLI the user installs and signs
 * into themselves (Google Antigravity, OpenAI Codex): the app detects and
 * explains, never automates a sign-in. Status is the probe; the setup steps
 * live behind "How to set up" so a ready row is one quiet line.
 */
export function CliSubscriptionRow({ rowId, name, capabilities, status, loading, onRefresh, copy }: CliSubscriptionRowProps) {
  const [showSteps, setShowSteps] = useState(false);
  const installed = status?.installed ?? false;
  const authenticated = status?.authenticated ?? false;
  const ready = installed && authenticated;
  const probing = loading && status === null;

  const badge = probing ? (
    <StatusBadge tone="neutral">Checking…</StatusBadge>
  ) : ready ? (
    <StatusBadge tone="success">Ready</StatusBadge>
  ) : installed ? (
    <StatusBadge tone="warn">Sign in required</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Not installed</StatusBadge>
  );

  const line = probing ? (
    'Looking for the command-line tool…'
  ) : ready ? (
    copy.ready
  ) : installed ? (
    <>
      {copy.signIn}
      {status?.detail ? <span className="text-text-dim"> ({status.detail})</span> : null}
    </>
  ) : (
    copy.install
  );

  return (
    <ProviderGridRow
      rowId={rowId}
      name={<span className="truncate text-[12px] font-medium text-text-secondary">{name}</span>}
      powers={capabilities.map((cap) => (
        <CapabilityBadge key={cap} label={cap} />
      ))}
      status={badge}
      detail={<div className="text-[11px] leading-snug text-text-muted">{line}</div>}
      actions={
        <>
          <button
            type="button"
            onClick={() => setShowSteps((v) => !v)}
            className="cursor-pointer text-[10px] text-text-dim transition-colors hover:text-text-secondary"
          >
            {showSteps ? 'Hide steps' : 'How to set up'}
          </button>
          {!ready && (
            <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
              {loading ? 'Checking…' : 'Check again'}
            </Button>
          )}
        </>
      }
      below={
        showSteps ? (
          <div className="rounded-[6px] bg-app-base px-3 py-2" style={{ border: '0.5px solid var(--color-border)' }}>
            <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-snug text-text-muted">
              {copy.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded bg-app-deep px-2 py-1 text-[11px] text-text-primary select-all">
              {copy.installCommand}
            </code>
          </div>
        ) : undefined
      }
    />
  );
}
