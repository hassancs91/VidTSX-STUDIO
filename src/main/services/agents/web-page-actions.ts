// The stage's two web-page handoffs (W9): "Export site" and "Open in browser".
//
// Both write a site folder through `web-page-export.ts` and hand the result to
// the shell — the exported folder is revealed in Explorer, the preview's
// `index.html` is opened with the user's default browser. The renderer never
// sees a path it has to know how to use; it gets the folder back for a toast.

import { shell } from 'electron';
import type { AgentArtifactActionResponse } from '../../../shared/ipc/types';
import type { ArtifactActionInput } from './artifact-actions';
import { exportWebSite, writeWebSitePreview } from './web-page-export';

export async function runWebPageAction(input: ArtifactActionInput): Promise<AgentArtifactActionResponse> {
  if (input.artifact.kind !== 'web-page') {
    return { success: false, error: 'Only a web page can be exported as a site.' };
  }
  const base = {
    agentId: input.agentId,
    sessionId: input.sessionId,
    artifacts: input.artifacts ?? [input.artifact],
    artifact: input.artifact,
    ...(input.libraryFolder ? { libraryFolder: input.libraryFolder } : {}),
  };
  if (input.action === 'export-site') {
    const result = await exportWebSite(base);
    shell.showItemInFolder(result.indexPath);
    return { success: true, path: result.dir };
  }
  const preview = await writeWebSitePreview(base);
  const failure = await shell.openPath(preview.indexPath);
  if (failure) return { success: false, error: `Could not open the page: ${failure}` };
  return { success: true, path: preview.dir };
}
