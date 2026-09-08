// The Agents page (agents plan §1.7): a grid of installed agents, an Import
// button, and drag-and-drop of a `.vidtsxagent` anywhere on the page.
//
// A double-clicked `.vidtsxagent` lands here too (Stage 5): main parks the path
// in the kind-scoped pending slot and pushes an event; this claims it on mount
// AND on the event, because the app can be launched straight into any screen.
// All three routes — button, drop, double-click — end at the same dialog.

import { useCallback, useEffect, useState } from 'react';
import { Bot, Plus, Upload } from 'lucide-react';
import type { AgentUpdateInfo, InstalledAgent } from '@shared/types/agents';
import { AGENT_PACKAGE_EXT } from '@shared/agents/manifest';
import { useToast } from '@renderer/contexts/ToastContext';
import { useInstalledAgents } from '../hooks/useInstalledAgents';
import { AgentCard } from './AgentCard';
import { AgentDetailsDialog } from './AgentDetailsDialog';
import { ImportAgentDialog } from './ImportAgentDialog';

interface Props {
  onOpenAgent: (agentId: string) => void;
}

export function AgentGallery({ onOpenAgent }: Props) {
  const { agents, loading, refresh, install, remove, checkUpdate } = useInstalledAgents();
  const { showToast } = useToast();
  const [importPath, setImportPath] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [updateState, setUpdateState] = useState<AgentUpdateInfo | 'up-to-date' | string>();
  const [checking, setChecking] = useState(false);

  const details = agents.find((a) => a.manifest.id === detailsId) ?? null;

  // Main owns the picker (it is an OS dialog), so Import is one round trip
  // that comes back with the path the details dialog then reads.
  const pickFile = useCallback(async () => {
    const result = await window.api.agentsInspect({});
    if (result.filePath) setImportPath(result.filePath);
    else if (!result.success && !result.canceled) {
      showToast(result.error ?? 'That file is not an agent package.', 'error');
    }
  }, [showToast]);

  // The path parks in main until this page is on screen; the push event only
  // navigates here, so the claim runs on mount as well.
  useEffect(() => {
    const claim = async (): Promise<void> => {
      const result = await window.api.agentsPendingPackage();
      if (result.filePath) setImportPath(result.filePath);
    };
    void claim();
    return window.api.onAgentsPackageOpenFile(() => void claim());
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.name.toLowerCase().endsWith(AGENT_PACKAGE_EXT),
    );
    // Electron puts the real path on the dropped File — the same read the
    // workspace and transcription drop zones do. Without it there is nothing
    // main can open, so say so rather than failing silently.
    const filePath = file ? (file as unknown as { path?: string }).path : undefined;
    if (filePath) setImportPath(filePath);
    else if (file) showToast('Could not read that file’s location — use Import instead.', 'error');
  }, [showToast]);

  const runCheckUpdate = useCallback(
    async (agentId: string) => {
      setChecking(true);
      setUpdateState(undefined);
      const result = await checkUpdate(agentId);
      setChecking(false);
      setDetailsId(agentId);
      if (typeof result === 'string') setUpdateState(result);
      else setUpdateState(result.update ?? 'up-to-date');
    },
    [checkUpdate],
  );

  const runRemove = useCallback(
    async (agent: InstalledAgent) => {
      const error = await remove(agent.manifest.id);
      showToast(
        error ?? `Removed ${agent.manifest.name}`,
        error ? 'error' : 'success',
      );
    },
    [remove, showToast],
  );

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div
        className="flex items-center justify-between px-3 h-[40px] shrink-0 bg-app-surface"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">Agents</span>
        <button
          onClick={() => void pickFile()}
          className="flex items-center gap-1 rounded-[6px] bg-accent px-2.5 py-1 text-[11px] text-white"
        >
          <Plus size={11} strokeWidth={2} />
          Import
        </button>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto p-3"
        style={
          dragging
            ? { outline: '1px dashed var(--color-accent)', outlineOffset: '-8px', backgroundColor: '#1e1030' }
            : undefined
        }
      >
        {loading ? (
          <div className="text-[11px] text-text-dim">Loading agents…</div>
        ) : agents.length === 0 ? (
          <EmptyGallery onImport={() => void pickFile()} />
        ) : (
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
          >
            {agents.map((agent) => (
              <AgentCard
                key={agent.manifest.id}
                agent={agent}
                onOpen={() => onOpenAgent(agent.manifest.id)}
                onDetails={() => {
                  setUpdateState(undefined);
                  setDetailsId(agent.manifest.id);
                }}
                onCheckUpdate={() => void runCheckUpdate(agent.manifest.id)}
                onRemove={() => void runRemove(agent)}
              />
            ))}
          </div>
        )}
      </div>

      {importPath ? (
        <ImportAgentDialog
          filePath={importPath}
          onInstall={install}
          onClose={() => setImportPath(null)}
          onInstalled={(agent) => {
            setImportPath(null);
            void refresh();
            showToast(`Installed ${agent.manifest.name} ${agent.manifest.version}`, 'success');
          }}
        />
      ) : null}

      {details ? (
        <AgentDetailsDialog
          agent={details}
          {...(updateState !== undefined ? { updateState } : {})}
          checking={checking}
          onCheckUpdate={() => void runCheckUpdate(details.manifest.id)}
          onClose={() => setDetailsId(null)}
        />
      ) : null}
    </div>
  );
}

function EmptyGallery({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2.5 text-center">
      <Bot size={48} strokeWidth={1} className="text-text-ghost" />
      <div className="text-[14px] text-text-muted">No agents installed</div>
      <div className="text-[12px] text-text-dim max-w-[320px] leading-snug">
        An agent is a package of prompts and skills that drives the app&rsquo;s own tools. Import a{' '}
        {AGENT_PACKAGE_EXT} file, or drop one anywhere on this page.
      </div>
      <button
        onClick={onImport}
        className="mt-1 flex items-center gap-1 rounded-[6px] bg-accent px-2.5 py-1 text-[11px] text-white"
      >
        <Upload size={11} strokeWidth={2} />
        Import an agent
      </button>
    </div>
  );
}
