// The ONE path a tool handler is called through (flows plan §11, §0.1 item
// 14). The agents' tool server and the flow runner both come here, so the
// argument gate, the capability gate and the usage attribution cannot drift
// between the two runners. Rule: no handler is called outside this function.
//
// What it does, in order: validate the arguments against the tool's own zod
// shape (the SDK does the same before the tool server sees a call — here it
// also covers the runner, which builds arguments from ports and config);
// refuse a `needs`-gated tool whose capability is not configured, when the
// caller says what is configured; stamp the usage `featureSource` on the
// context; run the handler, turning a throw into an error result so a bug in
// one tool never takes a turn or a run down with it.

import { z } from 'zod';
import type { AiFeatureSource } from '../../../../shared/types/ai-usage';
import type { AgentToolContext, AgentToolNeed, AgentToolResult } from './types';
import { toolText } from './types';
import type { RegisteredTool, ToolCapabilities } from './registry';
import { logEngine } from '../../../../logging/log-engine';

const log = logEngine.createLogger('AgentTools');

export interface InvokeToolOptions {
  /** Who pays: `'agent'` from the tool server, `'flows'` from the runner. */
  featureSource: AiFeatureSource;
  /**
   * When given, a tool whose `needs` gate is unmet is refused before its
   * handler runs. The tool server leaves this out — the system prompt already
   * tells the model which tools are unavailable (§1.8), and a tool called
   * anyway answers with its own message.
   */
  capabilities?: ToolCapabilities;
}

/** Whether one capability gate is satisfied. */
export function needMet(need: AgentToolNeed, capabilities: ToolCapabilities): boolean {
  switch (need) {
    case 'image-provider':
      return capabilities.imageProvider;
    case 'video-provider':
      return capabilities.videoProvider;
    case 'audio-provider':
      return capabilities.audioProvider;
    case 'agent-provider':
      return capabilities.agentProvider === true;
  }
}

const NEED_LABEL: Record<AgentToolNeed, string> = {
  'image-provider': 'an image provider',
  'video-provider': 'a video provider',
  'audio-provider': 'an audio provider',
  'agent-provider': 'an AI provider that can run tools (a Claude, MiniMax, OpenRouter, Z.AI or Kimi provider)',
};

/** The user-facing line for an unmet gate, shared with the runner's validation. */
export function unmetNeedMessage(toolId: string, need: AgentToolNeed): string {
  return `${toolId} needs ${NEED_LABEL[need]} — add one in AI → Providers.`;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

/**
 * Validate, gate, attribute, run. Never throws: every failure is an
 * `isError` result whose text is the message the model (or the run log) sees.
 */
export async function invokeTool(
  def: RegisteredTool,
  args: unknown,
  ctx: AgentToolContext,
  options: InvokeToolOptions,
): Promise<AgentToolResult> {
  if (def.needs && options.capabilities && !needMet(def.needs, options.capabilities)) {
    return toolText(unmetNeedMessage(def.id, def.needs), true);
  }

  const parsed = z.object(def.schema).safeParse(args ?? {});
  if (!parsed.success) {
    return toolText(`${def.id}: invalid arguments — ${formatIssues(parsed.error)}`, true);
  }

  const context: AgentToolContext = { ...ctx, featureSource: options.featureSource };
  try {
    return await def.handler(parsed.data as Record<string, unknown>, context);
  } catch (err) {
    // A handler that throws is a bug, not a caller mistake: report it as a
    // result so the turn or the run can continue, and log it so it is not
    // swallowed.
    const message = err instanceof Error ? err.message : String(err);
    log.warn('Agent tool threw', { tool: def.id, error: message });
    return toolText(`${def.id} failed: ${message}`, true);
  }
}
