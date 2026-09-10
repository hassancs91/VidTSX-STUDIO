// `render_composition` — enqueue a render and RETURN AT ONCE (agents plan §1.5,
// "Long jobs never block a tool call", decided 2026-09-06).
//
// Rendering is one flow for the whole app: the render queue owned by the
// renderer, which starts jobs, persists them, shows them on the Queue screen
// and owns cancel. So this tool does not render. It mints a `job` artifact with
// a fresh job id and hands the runner a `job-request`; the workspace hook
// enqueues it, and the finished video comes back as a separate `video` artifact
// whose id is written into the job artifact's `resultArtifactId`.

import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { slugifyName } from './workspace-files';

const schema = {
  artifactId: z.string().describe('Composition artifact to render (e.g. "composition-2").'),
  name: z.string().optional().describe('Output file name, without an extension.'),
};

interface RenderCompositionArgs {
  artifactId: string;
  name?: string;
}

export const renderCompositionTool: AgentToolDef<RenderCompositionArgs> = {
  id: 'render_composition',
  description:
    'Queue a composition for rendering to MP4. Returns immediately with a job id — the render runs in the app\'s render queue and can take minutes. END YOUR TURN after calling this; you will be told when the job finishes and given the video artifact.',
  schema,
  // W8 Stage 1 (flows plan §0.1 item 7): composition in, video out. The tool
  // returns a `job`; the flow runner waits for the queue to settle it and puts
  // the filed `video` artifact on the port (the queue bridge is Stage 3).
  ports: {
    label: 'Render Composition',
    category: 'composition',
    inputs: [
      { id: 'composition', label: 'Composition', dataType: 'composition', required: true, argKey: 'artifactId' },
    ],
    outputs: [{ id: 'video', label: 'Video', dataType: 'video', from: 'artifact' }],
    configSchema: [{ kind: 'text', key: 'name', label: 'Output name (optional)', placeholder: 'render' }],
    defaultConfig: { name: '' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    const composition = ctx.readArtifacts().find((a) => a.id === args.artifactId);
    if (!composition) {
      return toolText(
        `No artifact "${args.artifactId}" in this session — call list_artifacts for the ids.`,
        true,
      );
    }
    if (composition.kind !== 'composition') {
      return toolText(
        `Artifact "${args.artifactId}" is a ${composition.kind}; only compositions can be rendered.`,
        true,
      );
    }

    const jobId = randomUUID();
    const outputName = slugifyName(args.name ?? composition.title, 'render');
    ctx.emitProgress(composition.title);

    return {
      ...toolText(
        `Render queued as job ${jobId} for ${composition.title}. It will be reported when it finishes. End your turn now.`,
      ),
      artifact: {
        kind: 'job',
        title: `Render — ${composition.title}`,
        payload: { jobId, job: 'render', status: 'pending' },
      },
      jobRequest: {
        jobId,
        job: 'render',
        compositionArtifactId: composition.id,
        ...(composition.payload.moduleUrl ? { moduleUrl: composition.payload.moduleUrl } : {}),
        config: composition.payload.config,
        ...(ctx.libraryFolder ? { outputFolder: ctx.libraryFolder } : {}),
        outputName,
      },
    };
  },
};
