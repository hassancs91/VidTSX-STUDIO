// list_notes / read_note (video-10 import gap 7): the project's notes folder
// — plans, import reports, QA passes, anything the user or another tool
// left as Markdown under `<project>/notes/`. Read-only for the agent: it
// may cite a note, never write one (the user writes in the Notes tab).

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { listNotes, readNote } from '../project-notes';
import { SCRIPT_SLICE_CHARS, scriptSlice } from '../project-script';
import { emitTool, errorText, text, type StudioTool, type StudioToolContext } from './types';

export function buildNotesTools(ctx: StudioToolContext): StudioTool[] {
  const { req } = ctx;

  const listTool = tool(
    'list_notes',
    'List the Markdown notes saved with this project (the Notes tab, or files another tool dropped into the project\'s notes folder: an import report, a plan, a QA pass). Read one with read_note. Check here before an editorial pass when the user mentions a plan or earlier notes.',
    {},
    async () => {
      emitTool(ctx, 'list_notes');
      try {
        const notes = await listNotes(req.projectId);
        if (notes.length === 0) return text('This project has no notes yet. The user can write one in the Notes tab.');
        const lines = notes.map((n) => `- ${n.name} (${n.size.toLocaleString()} bytes, updated ${new Date(n.updatedAt).toISOString().slice(0, 16).replace('T', ' ')})`);
        return text(`${notes.length} note(s):\n${lines.join('\n')}`);
      } catch (err) {
        return text(`Could not list notes: ${errorText(err)}`, true);
      }
    },
  );

  const readTool = tool(
    'read_note',
    'Read one project note by name (from list_notes), as a character window like get_script.',
    {
      name: z.string().min(1).describe('The note file name, e.g. "IMPORT-REPORT.md"'),
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
      emitTool(ctx, 'read_note', args.name);
      let body: string;
      try {
        body = await readNote(req.projectId, args.name);
      } catch (err) {
        return text(`Could not read note "${args.name}": ${errorText(err)}`, true);
      }
      const slice = scriptSlice(body, args.startChar ?? 0, args.maxChars ?? SCRIPT_SLICE_CHARS);
      if (slice.text === '') {
        return text(`"${args.name}" is ${slice.total} characters long — startChar ${slice.start} is past its end.`, true);
      }
      const more = slice.end < slice.total ? ` Call again with startChar ${slice.end} for the rest.` : ' That is the end of the note.';
      return text(`${args.name}, chars ${slice.start}–${slice.end} of ${slice.total}:${more}\n\n${slice.text}`);
    },
  );

  return [listTool, readTool];
}
