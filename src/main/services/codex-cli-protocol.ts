import type { CodexImageSize, CodexUsage } from '../../image-engine/providers/codex-cli-provider';

/**
 * Pure protocol logic for driving the OpenAI Codex CLI headlessly for image
 * generation — what the 2026-09-16 spike settled (docs/ai-models-redesign.md
 * §3.7). No process spawning or fs here; `codex-cli.ts` owns that side.
 *
 * The non-obvious behaviours this encodes (do not re-derive them):
 * - The image tool call is INVISIBLE in `--json`: the stream carries
 *   `thread.started`, `agent_message` items and `turn.completed` usage only.
 *   Proof of success is the file in the thread folder, never an event.
 * - The image lands in `$CODEX_HOME/generated_images/<thread_id>/exec-*.png`;
 *   the thread id is the first event. No cwd copy, `-s read-only` is enough.
 * - `-i <FILE>...` is greedy: a prompt placed after it is swallowed as a file
 *   path and the run exits 1. Prompt first, `-i` last.
 * - stdin must be closed or Codex reads it ("Reading additional input…").
 * - Sizes are honoured (1536×1024 came back exact); 1024² came back 1254² —
 *   the request is an aspect, not a pixel size.
 */

/** One parsed JSONL event from `codex exec --json`. */
export interface CodexEvent {
  type?: string;
  thread_id?: string;
  item?: { id?: string; type?: string; text?: string };
  usage?: { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number };
}

/** What the agent must answer once the image exists; anything else is the error path. */
export const CODEX_DONE_TOKEN = 'DONE';

const HARVEST_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/** Parse the JSONL stream, tolerating blank lines and non-JSON noise. */
export function parseCodexEvents(stdout: string): CodexEvent[] {
  const events: CodexEvent[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') events.push(parsed as CodexEvent);
    } catch {
      // Non-JSON chatter on stdout is expected noise.
    }
  }
  return events;
}

/** The thread id is the first event (`thread.started`) — the harvest folder's name. */
export function findThreadId(events: CodexEvent[]): string | null {
  return events.find((e) => e.type === 'thread.started')?.thread_id ?? null;
}

/** The agent's final text — DONE on success, an explanation when it refused or could not generate. */
export function findLastAgentMessage(events: CodexEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === 'item.completed' && event.item?.type === 'agent_message' && typeof event.item.text === 'string') {
      return event.item.text;
    }
  }
  return null;
}

/** Plan usage from `turn.completed` — logged with the usage row (the plan, not dollars). */
export function findUsage(events: CodexEvent[]): CodexUsage | null {
  const completed = events.find((e) => e.type === 'turn.completed' && e.usage);
  if (!completed?.usage) return null;
  return {
    inputTokens: completed.usage.input_tokens ?? 0,
    cachedInputTokens: completed.usage.cached_input_tokens ?? 0,
    outputTokens: completed.usage.output_tokens ?? 0,
  };
}

/** True when the agent's last word is the DONE token (a trailing period or whitespace is tolerated). */
export function isDoneMessage(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim().replace(/[.!]+$/, '').trim();
  return trimmed.toUpperCase() === CODEX_DONE_TOKEN;
}

export interface CodexInstructionOptions {
  prompt: string;
  size: CodexImageSize;
  referenceCount: number;
}

/**
 * The headless instruction: pins the size, keeps the prompt verbatim (Codex
 * is an agent and paraphrases otherwise), forbids commands and files (the
 * app harvests from the thread folder), and asks for DONE as the last word
 * so `-o` gives a one-word success check.
 */
export function buildCodexInstruction(options: CodexInstructionOptions): string {
  const lines: string[] = [];
  lines.push('Generate exactly one image with the built-in image generation tool, then stop.');
  lines.push('');
  lines.push(`Size: ${options.size.label}`);
  lines.push(
    'Prompt: use the following text VERBATIM as the image prompt. Do not paraphrase it, do not shorten it, do not add to it.',
  );
  lines.push('<<<PROMPT');
  lines.push(options.prompt.trim());
  lines.push('PROMPT');
  lines.push('');
  if (options.referenceCount > 0) {
    const n = options.referenceCount;
    lines.push(
      `The ${n} attached image${n === 1 ? '' : 's'} ${n === 1 ? 'is a visual reference' : 'are visual references'} — keep ${n === 1 ? 'its' : 'their'} subject and style. Do not describe ${n === 1 ? 'it' : 'them'} back to me.`,
    );
  }
  lines.push(
    'Do not run any commands, do not read or write any files, and do not generate more than one image.',
  );
  lines.push(`When the image has been generated, reply with exactly: ${CODEX_DONE_TOKEN}`);
  return lines.join('\n');
}

export interface CodexArgsOptions {
  instruction: string;
  /** Scratch working directory for the run (`-C`); nothing is written there but `-o`. */
  cwd: string;
  /** Where `-o` writes the agent's last message. */
  lastMessagePath: string;
  referencePaths?: string[];
  /** `--ephemeral`: no session file, so app runs stay out of `codex resume`. */
  ephemeral: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

/** `codex exec` arguments — the prompt before `-i`, because `-i <FILE>...` is greedy. */
export function buildCodexArgs(options: CodexArgsOptions): string[] {
  const args = [
    'exec',
    '--skip-git-repo-check',
    '-s',
    'read-only',
    '-C',
    options.cwd,
    '-c',
    `model_reasoning_effort=${options.reasoningEffort ?? 'low'}`,
    '--json',
    '-o',
    options.lastMessagePath,
  ];
  if (options.ephemeral) args.push('--ephemeral');
  args.push(options.instruction);
  if (options.referencePaths && options.referencePaths.length > 0) {
    args.push('-i', ...options.referencePaths);
  }
  return args;
}

export interface HarvestCandidate {
  name: string;
  mtimeMs: number;
}

/**
 * Pick the generated image from a listing of the thread folder: an image file
 * written after the run started (a clock-slop tolerance is the caller's),
 * `exec-*` names first, newest wins.
 */
export function pickHarvestedImage(files: HarvestCandidate[], notBeforeMs: number): string | null {
  const images = files.filter((f) => {
    const dot = f.name.lastIndexOf('.');
    return dot !== -1 && HARVEST_EXTENSIONS.has(f.name.slice(dot).toLowerCase()) && f.mtimeMs >= notBeforeMs;
  });
  if (images.length === 0) return null;
  images.sort((a, b) => {
    const execA = a.name.startsWith('exec-') ? 1 : 0;
    const execB = b.name.startsWith('exec-') ? 1 : 0;
    return execB - execA || b.mtimeMs - a.mtimeMs;
  });
  return images[0].name;
}

/** "codex-cli 0.154.0" → "0.154.0"; unknown formats come back trimmed as-is. */
export function parseCodexVersion(stdout: string): string | null {
  const line = stdout.trim().split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!line) return null;
  const match = /(\d+\.\d+\.\d+[^\s]*)/.exec(line);
  return match ? match[1] : line.trim();
}

/** `codex login status` prints "Logged in using ChatGPT" (or an API key) when signed in. */
export function isLoggedInOutput(stdout: string, stderr: string): boolean {
  return /logged in/i.test(`${stdout}\n${stderr}`) && !/not logged in/i.test(`${stdout}\n${stderr}`);
}
