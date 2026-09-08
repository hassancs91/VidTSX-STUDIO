// The action bar's handoffs (agents plan §1.4).
//
// Main does the work and answers with a screen to switch to; this hook does the
// switching, in the app's established two-step: navigate, then dispatch the
// payload event once the target screen has had a tick to mount. Every visited
// screen stays mounted (docs/ui-automation-cdp.md), so the second event only
// has to wait for the FIRST visit.

import { useCallback, useState } from 'react';
import type { AgentArtifactActionKind } from '@shared/ipc/types';
import { useOpenProject } from '@renderer/contexts/OpenProjectContext';

/** Long enough for a first-visit mount; the same delay the Tools handoff uses. */
const MOUNT_DELAY_MS = 150;

export interface ArtifactActionResult {
  ok: boolean;
  message: string;
}

export function useArtifactActions(agentId: string, sessionId: string | null) {
  const { openProjectId } = useOpenProject();
  const [running, setRunning] = useState<AgentArtifactActionKind | null>(null);

  const run = useCallback(
    async (
      artifactId: string,
      action: AgentArtifactActionKind,
    ): Promise<ArtifactActionResult> => {
      if (!sessionId) return { ok: false, message: 'No session is open.' };
      setRunning(action);
      try {
        const result = await window.api.agentArtifactAction({
          agentId,
          sessionId,
          artifactId,
          action,
          ...(openProjectId ? { projectId: openProjectId } : {}),
        });
        if (!result.success) {
          return { ok: false, message: result.error ?? 'That handoff failed.' };
        }

        if (result.navigateTo) {
          window.dispatchEvent(
            new CustomEvent('vidtsx:navigate', { detail: { screen: result.navigateTo } }),
          );
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
    [agentId, sessionId, openProjectId],
  );

  return { run, running, studioProjectOpen: Boolean(openProjectId) };
}

function successMessage(action: AgentArtifactActionKind, relPath?: string): string {
  switch (action) {
    case 'save-to-library':
      return relPath ? `Saved to the library: ${relPath}` : 'Saved to the library';
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
  }
}
