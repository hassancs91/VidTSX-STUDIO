// get_script (W4): the project's script — the INTENDED FINAL READ — on
// demand. The first ~1 500 chars ride the system prompt; this tool reads
// the rest, by character window, through the same project-script service
// the Inspector's Script tab persists into. The turn's request carries the
// renderer's live copy as a fallback for the save debounce.

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { SCRIPT_SLICE_CHARS, readProjectScript, scriptSlice } from '../project-script';
import { emitTool, text, type StudioTool, type StudioToolContext } from './types';

export function buildScriptTools(ctx: StudioToolContext): StudioTool[] {
  const { req } = ctx;

  const getScript = tool(
    'get_script',
    'Read the project script — the intended final read the user wrote in the Script tab. Use it for the editorial pass (when takes differ, the keeper is the take that matches the script; wording the script dropped is fluff) and for names to spell right. Reads a character window; the system prompt already carries the opening.',
    {
      startChar: z.number().int().min(0).optional().describe('Character offset to start from (default 0)'),
      maxChars: z
        .number()
        .int()
        .min(200)
        .max(20000)
        .optional()
        .describe(`Window length (default ${SCRIPT_SLICE_CHARS})`),
    },
    async (args) => {
      emitTool(ctx, 'get_script', args.startChar ? `from ${args.startChar}` : undefined);
      const script = (await readProjectScript(req.projectId)) ?? req.script;
      if (!script || script.trim() === '') {
        return text('This project has no script. The user can write one in the Script tab; without it, judge takes from the transcript alone.');
      }
      const slice = scriptSlice(script, args.startChar ?? 0, args.maxChars ?? SCRIPT_SLICE_CHARS);
      if (slice.text === '') {
        return text(`The script is ${slice.total} characters long — startChar ${slice.start} is past its end.`, true);
      }
      const more = slice.end < slice.total ? ` Call again with startChar ${slice.end} for the rest.` : ' That is the end of the script.';
      return text(`Script chars ${slice.start}–${slice.end} of ${slice.total}:${more}\n\n${slice.text}`);
    },
  );

  return [getScript];
}
