// `write_document` — markdown into the session workspace, returned as a
// `document` artifact (agents plan §1.3 wave 1).
//
// This is how an agent shows work the user is meant to read and choose between:
// a script, two hook variants, a shot list. It is deliberately not "save to the
// library" — documents only leave the session when the user picks "Save to
// Library" from the action bar (§1.11).

import { z } from 'zod';
import fs from 'fs/promises';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { reserveWorkspaceFile } from './workspace-files';

const MAX_MARKDOWN_CHARS = 200_000;

const schema = {
  title: z
    .string()
    .min(1)
    .describe('Short title, shown on the stage and used to name the file.'),
  markdown: z.string().min(1).describe('The document body, in markdown.'),
};

interface WriteDocumentArgs {
  title: string;
  markdown: string;
}

export const writeDocumentTool: AgentToolDef<WriteDocumentArgs> = {
  id: 'write_document',
  description:
    'Write a markdown document into this session and show it to the user. Use it for scripts, outlines, variants to choose between, and any prose the user should read. Returns a "document" artifact; the user saves it to the library themselves if they want it kept.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    if (args.markdown.length > MAX_MARKDOWN_CHARS) {
      return toolText(
        `The document is ${args.markdown.length} characters (max ${MAX_MARKDOWN_CHARS}). Split it or write less.`,
        true,
      );
    }
    ctx.emitProgress(args.title);
    const { relPath, absPath } = await reserveWorkspaceFile(
      ctx.workspaceDir,
      'documents',
      args.title,
      '.md',
      'document',
    );
    await fs.writeFile(absPath, args.markdown, 'utf-8');
    return {
      ...toolText(`Document written: ${relPath}.`),
      artifact: { kind: 'document', title: args.title, payload: { relPath } },
    };
  },
};
