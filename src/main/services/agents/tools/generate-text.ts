// `generate_text` — one prompt through an LLM provider, the response as text
// (flows plan §1.2, migrated from the renderer's `generate-text` node in W8
// Stage 1). A fine agent tool too: a sub-call on a different model for a
// rewrite or a draft.
//
// The model binding follows decision 12 (`llm-model-binding.ts`); `useBrand`
// prepends the session's brand summary — the same text `get_brand` returns —
// so a brief written here spells names the brand's way (§0.1 item 9).

import { z } from 'zod';
import { runLlmGenerate } from '../../../ipc/llm-handlers';
import { readBrand } from '../../library/brand-store';
import { formatBrandSummary } from '../../library/brand-summary';
import { getLibraryRoot } from '../../library/library-paths';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { resolveLlmModelBinding } from './llm-model-binding';

const MODEL_MODES = ['required', 'preferred', 'default'] as const;

const schema = {
  prompt: z.string().min(1).describe('The user message.'),
  systemPrompt: z.string().optional().describe('Role, tone and constraints for the model.'),
  providerId: z.string().optional().describe('LLM provider id; absent = the app default.'),
  model: z.string().optional().describe('Model id on that provider; absent = its default.'),
  modelMode: z
    .enum(MODEL_MODES)
    .optional()
    .describe('required = refuse when the model is unavailable; preferred = fall back; default = app default.'),
  useBrand: z
    .union([z.boolean(), z.enum(['on', 'off'])])
    .optional()
    .describe('Prepend the brand summary to the system prompt.'),
};

interface GenerateTextArgs {
  prompt: string;
  systemPrompt?: string;
  providerId?: string;
  model?: string;
  modelMode?: (typeof MODEL_MODES)[number];
  useBrand?: boolean | 'on' | 'off';
}

async function brandBlock(brandId: string | undefined): Promise<string | undefined> {
  if (!brandId) return undefined;
  const brand = await readBrand(getLibraryRoot(), brandId);
  return brand ? formatBrandSummary(brand) : undefined;
}

export const generateTextTool: AgentToolDef<GenerateTextArgs> = {
  id: 'generate_text',
  description:
    'Send one prompt to an LLM provider and return its reply as text. Use it for a rewrite, a draft or a summary that should run on a specific model; the reply is returned verbatim.',
  schema,
  ports: {
    label: 'Generate Text',
    category: 'text',
    inputs: [{ id: 'prompt', label: 'Prompt', dataType: 'text', required: true, argKey: 'prompt' }],
    outputs: [{ id: 'text', label: 'Text', dataType: 'text', from: 'field:text' }],
    configSchema: [
      { kind: 'llm-model-picker', key: 'model', label: 'Model', providerKeyKey: 'providerId' },
      {
        kind: 'select',
        key: 'modelMode',
        label: 'Model mode',
        options: [
          { value: 'default', label: 'Default — the app default model' },
          { value: 'preferred', label: 'Preferred — fall back when unavailable' },
          { value: 'required', label: 'Required — refuse when unavailable' },
        ],
      },
      {
        kind: 'prompt',
        key: 'systemPrompt',
        label: 'System prompt (optional)',
        placeholder: 'Set the assistant’s role, tone, constraints…',
        rows: 4,
      },
      {
        kind: 'select',
        key: 'useBrand',
        label: 'Brand',
        options: [
          { value: 'off', label: 'Ignore the brand' },
          { value: 'on', label: 'Prepend the brand summary' },
        ],
      },
    ],
    defaultConfig: { providerId: '', model: '', modelMode: 'default', systemPrompt: '', useBrand: 'off' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    const resolved = await resolveLlmModelBinding({
      ...(args.providerId ? { providerId: args.providerId } : {}),
      ...(args.model ? { model: args.model } : {}),
      ...(args.modelMode ? { modelMode: args.modelMode } : {}),
    });
    if (!resolved.ok) return toolText(resolved.error, true);
    if (resolved.note) ctx.emitProgress(resolved.note);

    const wantsBrand = args.useBrand === true || args.useBrand === 'on';
    let brand: string | undefined;
    if (wantsBrand) {
      try {
        brand = await brandBlock(ctx.brandId);
      } catch (err) {
        ctx.emitProgress(`Brand summary unavailable: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const systemPrompt = [brand, args.systemPrompt?.trim()].filter(Boolean).join('\n\n') || undefined;

    ctx.emitProgress(args.prompt.slice(0, 60));
    const featureSource = ctx.featureSource ?? 'agent';
    // Absent providerId/model = the app default provider and its model.
    const providerId = resolved.providerId ?? (resolved.note ? undefined : ctx.providerId);
    const res = await runLlmGenerate(
      {
        prompt: args.prompt,
        ...(systemPrompt ? { systemPrompt } : {}),
        ...(providerId ? { providerId } : {}),
        ...(resolved.model ? { model: resolved.model } : {}),
        featureSource,
      },
      ctx.signal,
      undefined,
      featureSource === 'agent' ? { agentId: ctx.agentId } : undefined,
    );
    if (!res.success || !res.text) {
      return toolText(`Text generation failed: ${res.error ?? 'the model returned nothing'}`, true);
    }
    return { ...toolText(res.text), fields: { text: res.text } };
  },
};
