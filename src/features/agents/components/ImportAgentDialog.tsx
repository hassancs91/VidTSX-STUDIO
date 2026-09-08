// Importing a `.vidtsxagent` (agents plan §1.6, §1.7).
//
// The package is READ before it is installed — `AGENTS_INSPECT` with a file
// path — so the user sees the same manifest, capability list and trust tag the
// details dialog shows, and decides on that. A tampered package never reaches
// this screen: it is refused while being read.
//
// Install is one click either way. The two things that stop it are a package
// that will not open (an error) and a DOWNGRADE, which asks first (§1.6).

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { InstalledAgent } from '@shared/types/agents';
import { capabilitiesFor, trustTagFor } from '../services/manifest-summary';
import { TrustBadge } from './TrustBadge';

interface Props {
  filePath: string;
  /** Resolves to the installed agent, or reports what stopped it. */
  onInstall: (
    filePath: string,
    confirmDowngrade: boolean,
  ) => Promise<{ agent?: InstalledAgent; needsConfirm?: 'downgrade'; installedVersion?: string; error?: string }>;
  onClose: () => void;
  onInstalled: (agent: InstalledAgent) => void;
}

export function ImportAgentDialog({ filePath, onInstall, onClose, onInstalled }: Props) {
  const [agent, setAgent] = useState<InstalledAgent | null>(null);
  const [licensee, setLicensee] = useState<{ name: string; orderId?: string } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [downgradeFrom, setDowngradeFrom] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    void window.api.agentsInspect({ filePath }).then((result) => {
      if (disposed) return;
      if (result.success && result.agent) {
        setAgent(result.agent);
        setLicensee(result.licensee ?? null);
      } else {
        setReadError(result.error ?? 'That file is not an agent package this app can read.');
      }
    });
    return () => {
      disposed = true;
    };
  }, [filePath]);

  const install = async (confirmDowngrade: boolean): Promise<void> => {
    setInstalling(true);
    const result = await onInstall(filePath, confirmDowngrade);
    setInstalling(false);
    if (result.needsConfirm === 'downgrade') {
      setDowngradeFrom(result.installedVersion ?? 'a newer version');
      return;
    }
    if (result.error) {
      setReadError(result.error);
      return;
    }
    if (result.agent) onInstalled(result.agent);
  };

  const tag = agent ? trustTagFor(agent) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-[8px] bg-app-surface"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div
          className="flex items-center justify-between px-3 h-[40px]"
          style={{ borderBottom: '0.5px solid var(--color-border)' }}
        >
          <span className="text-[13px] font-medium text-text-secondary">Import an agent</span>
          <button onClick={onClose} title="Close" className="text-text-muted hover:text-text-primary">
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {readError ? (
            <div className="flex items-start gap-2 text-[11px] text-accent-red leading-snug whitespace-pre-wrap">
              <AlertTriangle size={12} strokeWidth={1.75} className="shrink-0 mt-[2px]" />
              <span>{readError}</span>
            </div>
          ) : !agent || !tag ? (
            <div className="text-[11px] text-text-dim">Reading the package…</div>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-text-primary">{agent.manifest.name}</span>
                <span className="text-[10px] text-text-dim">{agent.manifest.version}</span>
              </div>
              <div className="text-[11px] text-text-secondary leading-snug">
                {agent.manifest.description}
              </div>
              <div className="flex items-center gap-2">
                <TrustBadge tag={tag} />
                <span className="text-[10px] text-text-dim">by {agent.manifest.author.name}</span>
              </div>
              {tag.notice ? (
                <div
                  className="rounded-[6px] px-2 py-1.5 text-[10px] leading-snug text-accent-amber"
                  style={{ backgroundColor: 'rgba(239,159,39,0.12)' }}
                >
                  {tag.notice}
                </div>
              ) : null}
              {licensee ? (
                <div className="text-[10px] text-text-dim">Licensed to {licensee.name}</div>
              ) : null}

              <div>
                <div className="text-[11px] font-medium text-text-muted mb-1">What it can do</div>
                {capabilitiesFor(agent.manifest).map((c) => (
                  <div key={c.id} className="text-[11px] text-text-secondary leading-snug">
                    {c.label}
                  </div>
                ))}
              </div>

              {downgradeFrom ? (
                <div
                  className="rounded-[6px] px-2 py-1.5 text-[10px] leading-snug text-accent-amber"
                  style={{ backgroundColor: 'rgba(239,159,39,0.12)' }}
                >
                  Version {downgradeFrom} is already installed. Installing {agent.manifest.version}{' '}
                  replaces it with an older one.
                </div>
              ) : null}
            </>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-3 py-2"
          style={{ borderTop: '0.5px solid var(--color-border)' }}
        >
          <button
            onClick={onClose}
            className="rounded-[6px] px-2.5 py-1 text-[11px] text-text-secondary hover:bg-app-hover"
            style={{ border: '0.5px solid var(--color-border-hover)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => void install(downgradeFrom !== null)}
            disabled={!agent || installing || Boolean(readError)}
            className="rounded-[6px] bg-accent px-2.5 py-1 text-[11px] text-white disabled:opacity-40"
          >
            {installing ? 'Installing…' : downgradeFrom ? 'Install the older version' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  );
}
