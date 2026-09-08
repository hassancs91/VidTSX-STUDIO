// Details for one installed agent (agents plan §1.7): what it is, what it can
// do in plain words, how far to trust it, and — after a click — whether the
// publisher has posted a newer version.

import { X } from 'lucide-react';
import type { AgentUpdateInfo, InstalledAgent } from '@shared/types/agents';
import { capabilitiesFor, trustTagFor } from '../services/manifest-summary';
import { TrustBadge } from './TrustBadge';

interface Props {
  agent: InstalledAgent;
  licensee?: { name: string; orderId?: string; issuedAt?: string };
  /** Undefined until "Check for update" has been clicked; string = a failure. */
  updateState?: AgentUpdateInfo | 'up-to-date' | string;
  checking?: boolean;
  onCheckUpdate: () => void;
  onClose: () => void;
}

export function AgentDetailsDialog({
  agent,
  licensee,
  updateState,
  checking,
  onCheckUpdate,
  onClose,
}: Props) {
  const { manifest } = agent;
  const tag = trustTagFor(agent);
  const capabilities = capabilitiesFor(manifest);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] max-h-[80vh] overflow-y-auto rounded-[8px] bg-app-surface"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div
          className="flex items-center justify-between px-3 h-[40px] sticky top-0 bg-app-surface"
          style={{ borderBottom: '0.5px solid var(--color-border)' }}
        >
          <span className="text-[13px] font-medium text-text-secondary">{manifest.name}</span>
          <button onClick={onClose} title="Close" className="text-text-muted hover:text-text-primary">
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <TrustBadge tag={tag} />
            <span className="text-[10px] text-text-dim">
              {manifest.version} · {manifest.author.name}
              {manifest.license ? ` · ${manifest.license}` : ''}
            </span>
          </div>
          <div className="text-[11px] text-text-secondary leading-snug">{manifest.description}</div>
          {tag.notice ? (
            <div className="rounded-[6px] px-2 py-1.5 text-[10px] leading-snug text-accent-amber" style={{ backgroundColor: 'rgba(239,159,39,0.12)' }}>
              {tag.notice}
            </div>
          ) : null}

          <Section title="What it can do">
            {capabilities.length === 0 ? (
              <Row>Chats only — it calls no tools.</Row>
            ) : (
              capabilities.map((c) => <Row key={c.id}>{c.label}</Row>)
            )}
          </Section>

          <Section title="Requires">
            <Row>VidTSX {manifest.minAppVersion} or newer</Row>
            {agent.keyId ? <Row>Signed with key {agent.keyId}</Row> : null}
          </Section>

          {licensee ? (
            <Section title="Licensed to">
              <Row>{licensee.name}</Row>
              {licensee.orderId ? <Row>Order {licensee.orderId}</Row> : null}
            </Section>
          ) : null}

          {manifest.updateUrl ? (
            <Section title="Updates">
              <div className="flex items-center gap-2">
                <button
                  onClick={onCheckUpdate}
                  disabled={checking}
                  className="rounded-[6px] px-2.5 py-1 text-[11px] text-text-secondary hover:bg-app-hover disabled:opacity-50"
                  style={{ border: '0.5px solid var(--color-border-hover)' }}
                >
                  {checking ? 'Checking…' : 'Check for update'}
                </button>
                <UpdateLine state={updateState} />
              </div>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UpdateLine({ state }: { state: Props['updateState'] }) {
  if (state === undefined) return null;
  if (state === 'up-to-date') {
    return <span className="text-[10px] text-text-dim">This is the latest version.</span>;
  }
  if (typeof state === 'string') {
    return <span className="text-[10px] text-accent-red">{state}</span>;
  }
  return state.compatible ? (
    <button
      onClick={() => void window.api.appOpenExternal({ url: state.url })}
      className="text-[10px] text-accent-light underline"
    >
      Version {state.version} is available — open the download page
    </button>
  ) : (
    <span className="text-[10px] text-accent-amber">
      Version {state.version} needs VidTSX {state.minAppVersion}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-text-muted mb-1">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-text-secondary leading-snug">{children}</div>;
}
