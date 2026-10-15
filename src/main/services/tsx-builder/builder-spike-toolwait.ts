// Dev entry mode "toolwait" (P3 part 4's probe, design doc §5): can an agent's
// MCP tool call block for as long as a build takes? Each case runs one agent
// turn through `runLlmGenerate` (what agent-runner calls) with one probe tool
// wrapped by the agents' own `buildAgentToolServer`. `wait_probe(minutes)`
// sleeps in 30 s steps with only our own progress lines (no MCP progress, like
// a build), honours ctx.signal, and returns text (start/end times) plus one
// existing still, so a case also shows whether images arrive after a long call.
// Cases: A long wait (pass = the model quotes the text and describes the
// image); B a server `timeout` shorter than the wait (is the knob live, and
// what does the model see); C an abort mid-wait (the tool stops, the run says
// cancelled); D a wait past a Craft build's cap. Results merge by case id into
// `<outDir>/report.json` after every case, so D can run on its own later.

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { buildAgentToolServer, AGENT_MCP_SERVER_NAME } from '../agents/tools/tool-server';
import type { RegisteredTool } from '../agents/tools/registry';
import type { AgentToolResult } from '../agents/tools/types';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('ToolWaitProbe');

const STEP_MS = 30_000;

export interface ToolWaitCase {
  id: string;
  /** What the tool is asked to sleep. */
  minutes: number;
  /** createSdkMcpServer `timeout` (ms) for this case's server; absent = the SDK default. */
  serverTimeoutMs?: number;
  /** Abort the run this long after it starts. */
  abortAfterMs?: number;
}

export interface ToolWaitRequest {
  mode: 'toolwait';
  outDir: string;
  providerId?: string;
  model?: string;
  /** The JPEG the tool hands back (an existing still). */
  imagePath: string;
  cases: ToolWaitCase[];
  quit?: boolean;
}

interface ToolRecord {
  startedAt?: string;
  endedAt?: string;
  ms?: number;
  steps: number;
  outcome?: 'done' | 'aborted';
  /** Abort → the handler's return, when the run was aborted. */
  stopLagMs?: number;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Resolves after `ms`, or as soon as the signal aborts (true = aborted). */
function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(true);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(false);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(true);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function probeTool(image: string, record: ToolRecord, lines: string[], settled: { promise: Promise<void> }): RegisteredTool {
  return {
    id: 'wait_probe',
    description:
      'Waits the given number of minutes, then returns a line with its start and end times and one picture. ' +
      'It reports no progress while it waits.',
    schema: { minutes: z.number().positive().max(120) },
    handler: async (args, ctx): Promise<AgentToolResult> => {
      const minutes = Number(args.minutes);
      const started = Date.now();
      record.startedAt = iso(started);
      let release: () => void = () => {};
      settled.promise = new Promise<void>((resolve) => {
        release = () => resolve();
      });
      const abortMark = { at: 0 };
      ctx.signal.addEventListener('abort', () => (abortMark.at = Date.now()), { once: true });
      try {
        const total = minutes * 60_000;
        while (Date.now() - started < total) {
          const aborted = await sleep(Math.min(STEP_MS, total - (Date.now() - started)), ctx.signal);
          if (aborted) break;
          record.steps += 1;
          // Our own run-event progress line only; nothing reaches the SDK as MCP progress.
          ctx.emitProgress(`wait_probe: ${Math.round((Date.now() - started) / 1000)} s of ${minutes * 60} s`);
        }
        const ended = Date.now();
        record.endedAt = iso(ended);
        record.ms = ended - started;
        if (ctx.signal.aborted) {
          record.outcome = 'aborted';
          if (abortMark.at > 0) record.stopLagMs = ended - abortMark.at;
          return { content: [{ type: 'text', text: 'wait_probe stopped: the run was cancelled.' }], isError: true };
        }
        record.outcome = 'done';
        const text = `wait_probe finished. Started ${record.startedAt}, ended ${record.endedAt}, waited ${Math.round(record.ms / 1000)} s.`;
        lines.push(text);
        return { content: [{ type: 'text', text }], images: [{ data: image, mimeType: 'image/jpeg' }] };
      } finally {
        release();
      }
    },
  };
}

async function runCase(req: ToolWaitRequest, c: ToolWaitCase, image: string): Promise<Record<string, unknown>> {
  const abort = new AbortController();
  const record: ToolRecord = { steps: 0 };
  const toolLines: string[] = [];
  const progress: Array<{ at: string; detail: string }> = [];
  const settled = { promise: Promise.resolve() };
  const built = buildAgentToolServer([probeTool(image, record, toolLines, settled)], {
    sessionId: `toolwait-${c.id}`,
    agentId: 'toolwait-probe',
    workspaceDir: req.outDir,
    signal: abort.signal,
    emit: (event) => {
      if (event.kind === 'progress') progress.push({ at: new Date().toISOString(), detail: event.detail });
    },
    readArtifacts: () => [],
    ask: async () => ({ status: 'rejected', reason: 'probe' }),
    fileArtifact: async () => {
      throw new Error('the probe files no artifacts');
    },
    requestJob: () => {},
  });
  // The same wrapped tools, on a server that carries this case's timeout.
  const server = createSdkMcpServer({
    name: AGENT_MCP_SERVER_NAME,
    tools: built.tools,
    ...(c.serverTimeoutMs ? { timeout: c.serverTimeoutMs } : {}),
  });
  const prompt =
    `Call the wait_probe tool once with minutes = ${c.minutes}. When it returns, reply with two lines: ` +
    '"TEXT: " followed by the exact text the tool returned (or its exact error message), and ' +
    '"IMAGE: " followed by one sentence describing the picture it returned (or "none" if there was no picture). ' +
    'Do not call any other tool.';
  const started = Date.now();
  const aborted = { atMs: null as number | null };
  const abortTimer = c.abortAfterMs
    ? setTimeout(() => {
        aborted.atMs = Date.now() - started;
        abort.abort();
      }, c.abortAfterMs)
    : null;
  log.info('Case started', { id: c.id, minutes: c.minutes, serverTimeoutMs: c.serverTimeoutMs, abortAfterMs: c.abortAfterMs });
  const result = await runLlmGenerate(
    {
      prompt,
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'You are a test harness assistant. Follow the instructions exactly.',
      maxTurns: 6,
      featureSource: 'agent',
      ...(req.providerId ? { providerId: req.providerId } : {}),
      ...(req.model ? { model: req.model } : {}),
      allowedTools: built.allowedTools,
    },
    abort.signal,
    undefined,
    { agentId: 'toolwait-probe', mcpServers: { [AGENT_MCP_SERVER_NAME]: server } },
  );
  const runMs = Date.now() - started;
  if (abortTimer) clearTimeout(abortTimer);
  // A timed-out call's handler keeps running: wait for it (bounded) to see when it really ended.
  const handlerStillRunning = record.startedAt !== undefined && record.endedAt === undefined;
  if (handlerStillRunning) {
    await Promise.race([settled.promise, new Promise((r) => setTimeout(r, c.minutes * 60_000 + STEP_MS))]);
  }
  const entry = {
    id: c.id,
    minutes: c.minutes,
    serverTimeoutMs: c.serverTimeoutMs ?? null,
    abortAfterMs: c.abortAfterMs ?? null,
    startedAt: iso(started),
    runMs,
    abortedAtMs: aborted.atMs,
    cancelled: abort.signal.aborted,
    success: result.success,
    text: result.text ?? null,
    error: result.error ?? null,
    model: result.model ?? null,
    usage: result.usage ?? null,
    tool: { ...record, handlerStillRunningWhenRunEnded: handlerStillRunning },
    toolText: toolLines,
    progressLines: progress.length,
    lastProgress: progress.at(-1) ?? null,
  };
  log.info('Case done', { id: c.id, runMs, success: result.success, cancelled: abort.signal.aborted });
  return entry;
}

async function readReport(file: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function toolWaitProbe(req: ToolWaitRequest): Promise<Record<string, unknown>> {
  const image = (await fs.readFile(req.imagePath)).toString('base64');
  const reportPath = path.join(req.outDir, 'report.json');
  const ran: Array<Record<string, unknown>> = [];
  for (const c of req.cases) {
    let entry: Record<string, unknown>;
    try {
      entry = await runCase(req, c, image);
    } catch (err) {
      entry = { id: c.id, threw: err instanceof Error ? err.message : String(err) };
    }
    ran.push(entry);
    // Merge by case id after every case, so a later run (case D) adds to the same file.
    const report = await readReport(reportPath);
    const cases = ((report.cases as Array<Record<string, unknown>> | undefined) ?? []).filter((e) => e.id !== c.id);
    cases.push(entry);
    cases.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    await fs.writeFile(
      reportPath,
      JSON.stringify(
        {
          mode: 'toolwait',
          providerId: req.providerId ?? 'engine default',
          model: req.model ?? 'provider default',
          imagePath: req.imagePath,
          updatedAt: new Date().toISOString(),
          cases,
        },
        null,
        2,
      ),
      'utf-8',
    );
  }
  return { mode: 'toolwait', report: reportPath, cases: ran };
}
