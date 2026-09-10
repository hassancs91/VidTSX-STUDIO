// `list_artifacts` — the model's way back to results it can no longer see.
//
// The system prompt is STATIC for a whole session (plan §1.2, decided
// 2026-09-06): the artifact list is never in it, so the cached prefix survives
// every turn. What the model knows about artifacts therefore comes from the
// tool results it already saw and, once those fall out of the replay window,
// from this tool. Read-only by construction — it goes through
// `ctx.readArtifacts()` and returns no draft.

import { z } from 'zod';
import type { AgentArtifact, ArtifactKind } from '../../../../shared/types/agents';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const KINDS = ['document', 'composition', 'video', 'image-set', 'job', 'audio', 'web-page'] as const;

const schema = {
  kind: z
    .enum(KINDS)
    .optional()
    .describe('Only artifacts of this kind. Omit for everything in the session.'),
};

interface ListArtifactsArgs {
  kind?: ArtifactKind;
}

function describe(artifact: AgentArtifact): string {
  const version = artifact.version && artifact.version > 1 ? ` v${artifact.version}` : '';
  const head = `${artifact.id}${version} — ${artifact.title}`;
  switch (artifact.kind) {
    case 'document':
      return `${head} (${artifact.payload.relPath})`;
    case 'composition': {
      const { config, relPath } = artifact.payload;
      const seconds = (config.durationInFrames / config.fps).toFixed(1);
      return `${head} (${relPath}, ${config.width}x${config.height}, ${seconds}s at ${config.fps}fps)`;
    }
    case 'video':
      return `${head} (${artifact.payload.relPath}, ${artifact.payload.durationSeconds.toFixed(1)}s)`;
    case 'image-set':
      return `${head} (${artifact.payload.items.length} image(s): ${artifact.payload.items
        .map((i) => i.relPath)
        .join(', ')})`;
    case 'job': {
      const { job, status, resultArtifactId } = artifact.payload;
      const result = resultArtifactId ? `, result ${resultArtifactId}` : '';
      return `${head} (${job} job, ${status}${result})`;
    }
    case 'audio':
      return `${head} (${artifact.payload.relPath}, ${artifact.payload.sound}, ${artifact.payload.durationSeconds.toFixed(1)}s)`;
    case 'web-page':
      return `${head} (${artifact.payload.relPath}, ${artifact.payload.refs.length} media reference(s))`;
  }
}

export const listArtifactsTool: AgentToolDef<ListArtifactsArgs> = {
  id: 'list_artifacts',
  description:
    'List everything made in this session so far — documents, compositions, images, videos, audio, web pages and jobs — with the ids you pass to other tools. Call it when you need an artifact id you no longer have in view, or to check whether a job has finished.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    const all = ctx.readArtifacts();
    const artifacts = args.kind ? all.filter((a) => a.kind === args.kind) : all;
    if (artifacts.length === 0) {
      return toolText(
        args.kind
          ? `No "${args.kind}" artifacts in this session yet.`
          : 'Nothing has been made in this session yet.',
      );
    }
    return toolText(artifacts.map(describe).join('\n'));
  },
};
