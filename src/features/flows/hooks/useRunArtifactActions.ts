// The action bar's handoffs on a run output (flows plan §1.4, W8 Stage 2) —
// the flows twin of the agents' `useArtifactActions`, over the run-scoped
// `FLOWS_RUN_ARTIFACT_ACTION`. Main does the work and answers with a screen
// to switch to; this hook does the switching in the app's two-step (navigate,
// then the payload event once the target has had a tick to mount).

import { useCallback, useState } from 'react';
import type { AgentArtifactActionKind } from '@shared/ipc/types';
import { useOpenProject } from '@renderer/contexts/OpenProjectContext';

const MOUNT_DELAY_MS = 150;

export interface RunArtifactActionResult {
  ok: boolean;
  message: string;
}

export function useRunArtifactActions(runId: string | null) {
  const { openProjectId } = useOpenProject();
  const [running, setRunning] = useState<AgentArtifactActionKind | null>(null);

  const run = useCallback(
    async (artifactId: string, action: AgentArtifactActionKind): Promise<RunArtifactActionResult> => {
      if (!runId) return { ok: false, message: 'No run is open.' };
      setRunning(action);
      try {
        const result = await window.api.flowsRunArtifactAction({
          runId,
          artifactId,
          action,
          ...(openProjectId ? { projectId: openProjectId } : {}),
        });
        if (!result.success) return { ok: false, message: result.error ?? 'That handoff failed.' };
        if (result.navigateTo) {
          window.dispatchEvent(new CustomEvent('vidtsx:navigate', { detail: { screen: result.navigateTo } }));
          if (result.open) {
            const open = result.open;
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('vidtsx:creator-open', { detail: open }));
            }, MOUNT_DELAY_MS);
          }
        }
        return { ok: true, message: successMessage(action, result.relPath) };
      } finally {
        setRunning(null);
      }
    },
    [runId, openProjectId],
  );

  return { run, running, studioProjectOpen: Boolean(openProjectId) };
}

function successMessage(action: AgentArtifactActionKind, relPath?: string): string {
  switch (action) {
    case 'save-to-library':
      return relPath ? `In the library: ${relPath}` : 'Saved to the library';
    case 'open-in-creator':
      return 'Opened in the TSX Creator';
    case 'open-in-studio':
      return 'Imported into Studio as a shot';
    case 'send-to-queue':
      return 'Added to the render queue';
    case 'open-folder':
      return 'Opened the containing folder';
    case 'copy-path':
      return 'Path copied';
    case 'open-in-browser':
      return 'Opened in your browser';
    case 'export-site':
      return 'Site exported';
  }
}
