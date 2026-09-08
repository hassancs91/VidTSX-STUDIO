// The installed-agent list, and the four things the card menu does to it
// (agents plan §1.6, §1.7).

import { useCallback, useEffect, useState } from 'react';
import type { InstalledAgent } from '@shared/types/agents';

export interface InstallOutcome {
  agent?: InstalledAgent;
  /** Install stopped: the package is OLDER than what is installed (§1.6). */
  needsConfirm?: 'downgrade';
  installedVersion?: string;
  error?: string;
}

export function useInstalledAgents() {
  const [agents, setAgents] = useState<InstalledAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await window.api.agentsList();
    setAgents(result.success && result.agents ? result.agents : []);
    setError(result.success ? undefined : (result.error ?? 'Failed to list agents'));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const install = useCallback(
    async (filePath: string, confirmDowngrade = false): Promise<InstallOutcome> => {
      const result = await window.api.agentsInstall({
        filePath,
        ...(confirmDowngrade ? { confirmDowngrade: true } : {}),
      });
      if (result.needsConfirm) {
        return {
          needsConfirm: result.needsConfirm,
          ...(result.installedVersion ? { installedVersion: result.installedVersion } : {}),
        };
      }
      if (!result.success) return { error: result.error ?? 'The agent could not be installed.' };
      await refresh();
      return { ...(result.agent ? { agent: result.agent } : {}) };
    },
    [refresh],
  );

  /** Removing a USER copy can bring a shadowed built-in back (§1.6). */
  const remove = useCallback(
    async (agentId: string): Promise<string | undefined> => {
      const result = await window.api.agentsRemove({ agentId });
      await refresh();
      return result.success ? undefined : (result.error ?? 'The agent could not be removed.');
    },
    [refresh],
  );

  /** One fetch, on this click. The app never checks on its own (§1.6). */
  const checkUpdate = useCallback(async (agentId: string): Promise<InstalledAgent | string> => {
    const result = await window.api.agentsCheckUpdate({ agentId });
    if (!result.success || !result.agent) {
      return result.error ?? 'Could not reach the update server.';
    }
    setAgents((prev) =>
      prev.map((a) => (a.manifest.id === agentId ? (result.agent as InstalledAgent) : a)),
    );
    return result.agent;
  }, []);

  return { agents, loading, error, refresh, install, remove, checkUpdate };
}
