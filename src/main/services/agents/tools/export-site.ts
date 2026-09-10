// `export_site` — a web page artifact written out as a site folder plus a zip
// (W9): `index.html` with its media copied to `assets/`, in the session's
// library output folder. Returns the paths; the user opens the folder or the
// page in a browser from the stage's action bar.

import { z } from 'zod';
import { exportWebSite } from '../web-page-export';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const schema = {
  artifactId: z.string().describe('Web page artifact to export (e.g. "web-page-2" — the newest version).'),
};

interface ExportSiteArgs {
  artifactId: string;
}

export const exportSiteTool: AgentToolDef<ExportSiteArgs> = {
  id: 'export_site',
  description:
    'Export a web page as a ready-to-host site: a folder with index.html and an assets/ folder holding every referenced media file, plus the same as a zip, written beside this session\'s other output in the asset library. Returns the paths. Call it when the user is happy with the page.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    const artifacts = ctx.readArtifacts();
    const artifact = artifacts.find((a) => a.id === args.artifactId);
    if (!artifact) {
      return toolText(`No artifact "${args.artifactId}" in this session — call list_artifacts for the ids.`, true);
    }
    if (artifact.kind !== 'web-page') {
      return toolText(`Artifact "${args.artifactId}" is a ${artifact.kind}, not a web page.`, true);
    }
    ctx.emitProgress(artifact.title);
    try {
      const result = await exportWebSite({
        agentId: ctx.agentId,
        sessionId: ctx.sessionId,
        artifacts,
        artifact,
        ...(ctx.libraryFolder ? { libraryFolder: ctx.libraryFolder } : {}),
      });
      const problems = result.problems.length ? ` Unresolved references were left as written: ${result.problems.join(' ')}` : '';
      return toolText(
        `Site exported: ${result.dir} (${result.files.length} file(s): ${result.files.join(', ')}). Zip: ${result.zipPath}. The user can open the folder or the page in a browser from the action bar under the page.${problems}`,
      );
    } catch (err) {
      return toolText(`Export failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  },
};
