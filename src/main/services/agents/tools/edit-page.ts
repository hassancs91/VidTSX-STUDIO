// `edit_page` — one instruction applied to an existing web page, producing a
// NEW version (W9; the `edit_composition` pattern).
//
// The page is handed to the model with the instruction and comes back whole;
// it then passes the SAME store gate a fresh write does, so an edit can no
// more reach the network than a write can. The prior version stays on disk
// and in the filmstrip.

import { z } from 'zod';
import { runLlmGenerate } from '../../../ipc/llm-handlers';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { readWorkspaceFile } from './workspace-files';
import { describeStoredPage, storeWebPage, MAX_PAGE_CHARS } from './web-page-store';

const schema = {
  artifactId: z.string().describe('Web page artifact to edit (e.g. "web-page-1").'),
  instruction: z
    .string()
    .min(1)
    .describe('One concrete change. Separate unrelated changes into separate calls.'),
};

interface EditPageArgs {
  artifactId: string;
  instruction: string;
}

const EDIT_SYSTEM_PROMPT = `You edit one self-contained HTML web page.
Return the COMPLETE updated document and nothing else: no code fences, no commentary, no explanation before or after it.
Rules that must hold in the result:
- Keep it ONE document, <!doctype html> through </html>, with every style in <style> and every script in <script>.
- Never add external scripts, stylesheets, fonts, images, iframes or fetches; the page must not reach the network.
- Keep every artifact:<id> media reference exactly as written unless the instruction is about it.
- Change only what the instruction asks; leave the rest byte-for-byte where you can.`;

/** Models sometimes wrap code in fences despite the instruction. */
export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n```\s*$/);
  return match ? match[1] : trimmed;
}

export const editPageTool: AgentToolDef<EditPageArgs> = {
  id: 'edit_page',
  description:
    'Apply one change to an existing web page and show the result. Returns a new version of the "web-page" artifact; the previous version stays available. For a rewrite from scratch use write_page instead.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    const prior = ctx.readArtifacts().find((a) => a.id === args.artifactId);
    if (!prior) {
      return toolText(`No artifact "${args.artifactId}" in this session — call list_artifacts for the ids.`, true);
    }
    if (prior.kind !== 'web-page') {
      return toolText(`Artifact "${args.artifactId}" is a ${prior.kind}, not a web page.`, true);
    }

    ctx.emitProgress(args.instruction);
    let current: string;
    try {
      current = await readWorkspaceFile(ctx.workspaceDir, prior.payload.relPath);
    } catch (err) {
      return toolText(
        `The page file ${prior.payload.relPath} could not be read: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }

    const result = await runLlmGenerate(
      {
        prompt: `Instruction: ${args.instruction}\n\nThe page:\n\n${current}`,
        systemPrompt: EDIT_SYSTEM_PROMPT,
        maxTokens: Math.min(64_000, Math.max(8_192, Math.ceil(current.length / 2))),
        featureSource: 'agent',
        ...(ctx.providerId ? { providerId: ctx.providerId } : {}),
        ...(ctx.model ? { model: ctx.model } : {}),
      },
      ctx.signal,
      undefined,
      { agentId: ctx.agentId },
    );
    if (!result.success || !result.text) {
      return toolText(`Edit failed: ${result.error ?? 'the model returned nothing'}. The page is unchanged.`, true);
    }
    const next = stripCodeFence(result.text);
    if (next.length > MAX_PAGE_CHARS) {
      return toolText('Edit failed: the result is too long. The page is unchanged.', true);
    }
    const stored = await storeWebPage(ctx, prior.title, next);
    if (!stored.ok) return toolText(`${stored.error}\nThe page is unchanged.`, true);
    return {
      ...toolText(`Edited ${prior.title}: ${describeStoredPage(stored.relPath, stored.refs, stored.inlineBytes)}.`),
      artifact: stored.draft,
      supersedes: prior.id,
    };
  },
};
