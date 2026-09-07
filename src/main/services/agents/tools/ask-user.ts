// `ask_user` — a mid-run question, rendered by the interaction registry.
//
// NON-BLOCKING FORM (agents plan §1.5, Stage 1). The handler posts the request,
// which is persisted as the session's `pendingInteraction`, and returns at once
// telling the model to end its turn. The answer arrives as the NEXT user
// message, so a user who walks away for an hour — or closes the app — still
// finds the question waiting when they come back. The blocking form would hold
// the SDK tool call open and lose the question on restart; see §4 for the
// experiment that is still owed before that trade can be re-opened.

import { z } from 'zod';
import type { InteractionPayload } from '../../../../shared/types/agents';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const MAX_ITEMS = 12;

const candidate = z.object({
  id: z.string().describe('Short id you will recognise in the answer.'),
  label: z.string(),
  detail: z.string().optional(),
  artifactId: z
    .string()
    .optional()
    .describe('Artifact this choice stands for, so the user sees it full size.'),
});

const schema = {
  question: z.string().min(1).describe('The question, in one line.'),
  kind: z
    .enum(['pick', 'approve', 'form'])
    .optional()
    .describe(
      'pick = choose from options (default); approve = accept or reject each item; form = typed answers.',
    ),
  options: z
    .array(candidate)
    .optional()
    .describe('Choices for "pick", or the items for "approve".'),
  select: z
    .enum(['one', 'many'])
    .optional()
    .describe('For "pick": how many the user may choose. Default one.'),
  fields: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        kind: z.enum(['text', 'multiline', 'select']).optional(),
        options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
        required: z.boolean().optional(),
        placeholder: z.string().optional(),
      }),
    )
    .optional()
    .describe('For "form": the fields to fill in.'),
};

interface AskUserArgs {
  question: string;
  kind?: 'pick' | 'approve' | 'form';
  options?: Array<{ id: string; label: string; detail?: string; artifactId?: string }>;
  select?: 'one' | 'many';
  fields?: Array<{
    id: string;
    label: string;
    kind?: 'text' | 'multiline' | 'select';
    options?: Array<{ id: string; label: string }>;
    required?: boolean;
    placeholder?: string;
  }>;
}

function buildPayload(args: AskUserArgs): InteractionPayload | string {
  const kind = args.kind ?? 'pick';
  if (kind === 'form') {
    const fields = args.fields ?? [];
    if (fields.length === 0) return 'A "form" question needs at least one field.';
    if (fields.length > MAX_ITEMS) return `A form may have at most ${MAX_ITEMS} fields.`;
    return {
      kind: 'form',
      title: args.question,
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        kind: f.kind ?? 'text',
        ...(f.options ? { options: f.options } : {}),
        ...(f.required !== undefined ? { required: f.required } : {}),
        ...(f.placeholder ? { placeholder: f.placeholder } : {}),
      })),
    };
  }
  const items = args.options ?? [];
  if (items.length === 0) return `A "${kind}" question needs at least one option.`;
  if (items.length > MAX_ITEMS) return `A question may offer at most ${MAX_ITEMS} options.`;
  return kind === 'approve'
    ? { kind: 'approve', title: args.question, items }
    : { kind: 'pick', title: args.question, candidates: items, select: args.select ?? 'one' };
}

export const askUserTool: AgentToolDef<AskUserArgs> = {
  id: 'ask_user',
  description:
    'Ask the user a question and STOP. The question is shown to them; their answer comes back as their next message, which may be minutes or hours later. Call this at most once per turn, and end your turn immediately after — do not call other tools and do not guess the answer.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    const payload = buildPayload(args);
    if (typeof payload === 'string') return toolText(payload, true);

    ctx.emitProgress(args.question);
    const posted = await ctx.ask(payload);

    if (posted.status === 'rejected') {
      return toolText(`The question could not be shown: ${posted.reason}`, true);
    }
    // The blocking form (not shipped) would land here with the answer already
    // in hand; tools are written to accept either outcome.
    if (posted.status === 'answered') {
      return toolText(
        `The user answered: ${Object.entries(posted.values)
          .map(([field, values]) => `${field}=${values.join(', ')}`)
          .join('; ')}`,
      );
    }
    return toolText(
      `Question ${posted.requestId} is now in front of the user. End your turn now and wait — their reply arrives as their next message. Do not call any other tool and do not answer on their behalf.`,
    );
  },
};
