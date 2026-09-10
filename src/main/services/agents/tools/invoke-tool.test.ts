// `invokeTool` is the one handler path (flows plan §11): the argument gate,
// the capability gate, the usage attribution and the throw-to-result rule are
// what the tool server and the flow runner share.

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { invokeTool, needMet, unmetNeedMessage } from './invoke-tool';
import type { RegisteredTool } from './registry';
import { makeToolContext } from './test-context';
import { toolText, type AgentToolContext } from './types';

const ALL = { imageProvider: true, videoProvider: true, audioProvider: true };
const NONE = { imageProvider: false, videoProvider: false, audioProvider: false };

function tool(over: Partial<RegisteredTool> = {}): RegisteredTool {
  return {
    id: 'echo',
    description: 'Echoes the text it is given, for the invoke tests.',
    schema: { text: z.string().min(1), times: z.number().int().optional() },
    handler: async (args) => toolText(`${String(args.text)} x${String(args.times ?? 1)}`),
    ...over,
  };
}

describe('invokeTool', () => {
  it('validates arguments against the tool schema and names the field', async () => {
    const res = await invokeTool(tool(), { text: '' }, makeToolContext(), { featureSource: 'agent' });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('echo: invalid arguments');
    expect(res.content[0].text).toContain('text');
  });

  it('strips unknown keys so node config never reaches a handler it does not name', async () => {
    const seen: Record<string, unknown>[] = [];
    const def = tool({
      handler: async (args) => {
        seen.push(args);
        return toolText('ok');
      },
    });
    await invokeTool(def, { text: 'hi', modelMode: 'default', stray: 1 }, makeToolContext(), {
      featureSource: 'flows',
    });
    expect(seen[0]).toEqual({ text: 'hi' });
  });

  it('stamps the usage featureSource on the context the handler sees', async () => {
    let ctxSeen: AgentToolContext | null = null;
    const def = tool({
      handler: async (_args, ctx) => {
        ctxSeen = ctx;
        return toolText('ok');
      },
    });
    await invokeTool(def, { text: 'hi' }, makeToolContext(), { featureSource: 'flows' });
    expect(ctxSeen?.featureSource).toBe('flows');
    await invokeTool(def, { text: 'hi' }, makeToolContext(), { featureSource: 'agent' });
    expect(ctxSeen?.featureSource).toBe('agent');
  });

  it('turns a throwing handler into an error result instead of propagating', async () => {
    const def = tool({
      handler: async () => {
        throw new Error('boom');
      },
    });
    const res = await invokeTool(def, { text: 'hi' }, makeToolContext(), { featureSource: 'agent' });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('echo failed: boom');
  });

  it('refuses a gated tool when the caller says the capability is missing', async () => {
    const handler = vi.fn(async () => toolText('made an image'));
    const def = tool({ id: 'generate_image', needs: 'image-provider', handler });
    const refused = await invokeTool(def, { text: 'hi' }, makeToolContext(), {
      featureSource: 'flows',
      capabilities: NONE,
    });
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toBe(unmetNeedMessage('generate_image', 'image-provider'));
    expect(handler).not.toHaveBeenCalled();

    const allowed = await invokeTool(def, { text: 'hi' }, makeToolContext(), {
      featureSource: 'flows',
      capabilities: ALL,
    });
    expect(allowed.isError).toBeUndefined();
    // No capabilities given = the tool server's path: the prompt did the gating.
    const ungated = await invokeTool(def, { text: 'hi' }, makeToolContext(), { featureSource: 'agent' });
    expect(ungated.isError).toBeUndefined();
  });

  it('needMet reads the one flag each gate names', () => {
    expect(needMet('image-provider', { ...NONE, imageProvider: true })).toBe(true);
    expect(needMet('video-provider', { ...NONE, videoProvider: true })).toBe(true);
    expect(needMet('audio-provider', { ...NONE, audioProvider: true })).toBe(true);
    expect(needMet('audio-provider', ALL)).toBe(true);
    expect(needMet('image-provider', NONE)).toBe(false);
  });
});
