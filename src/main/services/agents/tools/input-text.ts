// `input_text` — a fixed or parameter-bound piece of text that flows into a
// node (flows plan §1.2; the renderer's `input-prompt` node, moved to main in
// W8 Stage 1). No I/O: the value is the node's config, or the run param bound
// to it, and it leaves on the `text` port as a primitive.

import { z } from 'zod';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

// The config key is `prompt` — what the v1 canvas's `input-prompt` node
// stored, so migrated rows and the bundled templates run unchanged.
const schema = {
  prompt: z.string().describe('The text to emit.'),
};

interface InputTextArgs {
  prompt: string;
}

export const inputTextTool: AgentToolDef<InputTextArgs> = {
  id: 'input_text',
  description:
    'Emit a fixed piece of text. A flow input node — the text is the node\'s configuration or a run parameter bound to it.',
  schema,
  ports: {
    label: 'Text',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'text', label: 'Text', dataType: 'text', from: 'field:text' }],
    configSchema: [
      { kind: 'prompt', key: 'prompt', label: 'Text', placeholder: 'Describe what you want…', rows: 6 },
    ],
    defaultConfig: { prompt: '' },
  },
  async handler(args): Promise<AgentToolResult> {
    const text = args.prompt ?? '';
    if (text.trim().length === 0) {
      return toolText('The text is empty — type it in the inspector or bind a run parameter.', true);
    }
    return { ...toolText(text), fields: { text } };
  },
};
