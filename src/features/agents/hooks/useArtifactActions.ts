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
/** W8 Stage 5: the Flows screen listens for this (and reads the stash on mount). */
const FREEZE_EVENT = 'vidtsx:flows-open-proposal';
const FREEZE_STASH_KEY = 'vidtsx:flows-pending-freeze';

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
        // W8 Stage 5: freezing is a flows channel, not a file action. Main
        // queues the proposal under this session; the Flows screen picks it
        // up from the event (or the stash, when it mounts after the event).
        if (action === 'freeze-to-flow') {
          const frozen = await window.api.flowsFreeze({ agentId, sessionId, artifactId });
          if (!frozen.success) return { ok: false, message: frozen.error ?? 'This session could not be frozen.' };
          const detail = { agentId, sessionId };
          try {
            sessionStorage.setItem(FREEZE_STASH_KEY, JSON.stringify(detail));
          } catch {
            // A blocked sessionStorage only loses the fallback; the event still fires.
          }
          window.dispatchEvent(new CustomEvent('vidtsx:navigate', { detail: { screen: 'flows' } }));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent(FREEZE_EVENT, { detail }));
          }, MOUNT_DELAY_MS);
          return { ok: true, message: successMessage(action) };
        }
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
        return { ok: true, message: successMessage(action, result.relPath, result.path) };
      } finally {
        setRunning(null);
      }
    },
    [agentId, sessionId, openProjectId],
  );

  return { run, running, studioProjectOpen: Boolean(openProjectId) };
}

function successMessage(action: AgentArtifactActionKind, relPath?: string, path?: string): string {
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
    case 'open-in-browser':
      return 'Opened in your browser';
    case 'export-site':
      return path ? `Site exported to ${path}` : 'Site exported';
    case 'freeze-to-flow':
      return 'Frozen — review the flow on the canvas';
  }
}
