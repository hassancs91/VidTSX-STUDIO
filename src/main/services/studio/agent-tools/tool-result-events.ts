// Every Studio tool call also reports what it was called WITH and what it
// RETURNED to the chat panel ('tool-result' event), so the transcript the
// user exports carries the raw exchange (video-10 feedback item 9,
// 2026-09-12). Capped: a transcript dump or a long capture result must never
// flood IPC or the persisted chat file.

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { StudioTool, StudioToolContext } from './types';

export const TOOL_ARGS_CAP = 4_000;
export const TOOL_RESULT_CAP = 12_000;

export function capText(value: string, cap: number): string {
  return value.length <= cap ? value : `${value.slice(0, cap)}\n… [${value.length - cap} more characters]`;
}

function argsText(args: unknown): string {
  try {
    return JSON.stringify(args, null, 2) ?? String(args);
  } catch {
    return String(args);
  }
}

/** The text a model would see: text blocks joined, other blocks named. */
export function callToolResultText(result: CallToolResult): string {
  const content = Array.isArray(result.content) ? result.content : [];
  return content
    .map((block) => (block.type === 'text' ? block.text : `[${block.type}]`))
    .join('\n');
}

/** Wrap each tool's handler so the call and its outcome are emitted. */
export function withToolResultEvents(ctx: StudioToolContext, tools: StudioTool[]): StudioTool[] {
  return tools.map((tool) => ({
    ...tool,
    handler: async (args: unknown, extra: unknown): Promise<CallToolResult> => {
      const base = {
        projectId: ctx.req.projectId,
        kind: 'tool-result' as const,
        tool: tool.name,
        args: capText(argsText(args), TOOL_ARGS_CAP),
      };
      let result: CallToolResult;
      try {
        result = await tool.handler(args as never, extra);
      } catch (err) {
        ctx.emit({
          ...base,
          result: capText(err instanceof Error ? err.message : String(err), TOOL_RESULT_CAP),
          isError: true,
        });
        throw err;
      }
      ctx.emit({
        ...base,
        result: capText(callToolResultText(result), TOOL_RESULT_CAP),
        ...(result.isError ? { isError: true } : {}),
      });
      return result;
    },
  }));
}
