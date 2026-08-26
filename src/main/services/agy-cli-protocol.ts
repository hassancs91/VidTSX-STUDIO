/**
 * Pure protocol logic for driving the Antigravity CLI (`agy`) headlessly —
 * a TypeScript port of the proven `gen-image.ps1` recipe (skill
 * `google-sdk-gen-img`). No process spawning or fs here; `agy-cli.ts` owns
 * that side. Kept pure so every hard-won rule is unit-testable.
 *
 * The non-obvious behaviours this encodes (do not re-derive them):
 * - agy is an AGENT, not an API: without an explicit VERBATIM instruction it
 *   paraphrases the prompt and silently discards engineered constraints.
 * - Exit code 0 does NOT mean success: headless mode soft-denies tools and
 *   still exits 0. The only trustworthy signal is a `step_update` event with
 *   `tool_name: generate_image` and `state: DONE`.
 * - The stream's `parameters` object is a partial summary — never infer the
 *   tool schema from it.
 * - Images are harvested from agy's brain dir, NON-recursively:
 *   `<conversation>\.tempmediaStorage\` holds copies of the INPUT references
 *   and a recursive search grabs the wrong file.
 * - `conversation_id` is a sibling of the `init` event, not nested inside it.
 */

/** One parsed NDJSON event from `agy --output-format stream-json`. */
export interface AgyStreamEvent {
  event?: string;
  conversation_id?: string;
  step_update?: {
    tool_name?: string;
    state?: string;
  };
  result?: {
    response?: string;
  };
}

/** Aspect ratios the generate_image tool accepts (verified against the tool). */
export const AGY_ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '9:16', '16:9'] as const;

/** Hard cap enforced by the tool: a 4th path fails outright. */
export const AGY_MAX_REFERENCE_IMAGES = 3;

const HARVEST_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Parse the NDJSON stream, tolerating blank lines and non-JSON noise. */
export function parseAgyEvents(stdout: string): AgyStreamEvent[] {
  const events: AgyStreamEvent[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') events.push(parsed as AgyStreamEvent);
    } catch {
      // Non-JSON chatter on stdout is expected noise.
    }
  }
  return events;
}

/** conversation_id is a SIBLING of the "init" event, not nested inside it. */
export function findConversationId(events: AgyStreamEvent[]): string | null {
  const init = events.find((e) => e.event === 'init');
  return init?.conversation_id ?? null;
}

/**
 * The only trustworthy success signal: a DONE generate_image step. Headless
 * mode soft-denies tools that need approval and still exits 0.
 */
export function isGenerateImageDone(events: AgyStreamEvent[]): boolean {
  return events.some(
    (e) =>
      e.event === 'step_update' &&
      e.step_update?.tool_name === 'generate_image' &&
      e.step_update?.state === 'DONE',
  );
}

/** The agent's final text — surfaced in errors when generation never completed. */
export function findAgentResponse(events: AgyStreamEvent[]): string | null {
  const result = events.find((e) => e.event === 'result');
  return result?.result?.response ?? null;
}

export interface AgyInstructionOptions {
  prompt: string;
  imageName: string;
  aspect?: string;
  /** Absolute paths, in order: subject → setting → previous image. */
  referencePaths?: string[];
}

/**
 * Build the headless instruction that pins every generate_image parameter.
 * The VERBATIM heredoc is the load-bearing part — without it the agent
 * paraphrases the prompt before composing its own tool call.
 */
export function buildAgyInstruction(options: AgyInstructionOptions): string {
  const lines: string[] = [];
  lines.push('Call the generate_image tool EXACTLY ONCE with these exact parameter values.');
  lines.push('');
  lines.push(`ImageName: ${options.imageName}`);
  if (options.aspect) lines.push(`AspectRatio: ${options.aspect}`);
  if (options.referencePaths && options.referencePaths.length > 0) {
    lines.push('ImagePaths (use these exact absolute paths, in this order, as visual references):');
    for (const ref of options.referencePaths) lines.push(`  - ${ref}`);
  }
  lines.push('');
  lines.push(
    'Prompt: use the following text VERBATIM as the Prompt parameter. Do not paraphrase it, do not shorten it, do not add to it.',
  );
  lines.push('<<<PROMPT');
  lines.push(options.prompt.trim());
  lines.push('PROMPT');
  lines.push('');
  lines.push(
    'Do not copy, move or rename any files. Do not generate more than one image. Do not view the reference files first - pass them via ImagePaths.',
  );
  return lines.join('\n');
}

export interface HarvestCandidate {
  name: string;
  mtimeMs: number;
}

/**
 * Pick the generated image from a NON-recursive listing of the conversation's
 * brain directory: newest image file wins. (A harvested file that matches an
 * input ref's byte size means someone searched recursively — the tell from
 * the skill's failure-mode table.)
 */
export function pickHarvestedImage(files: HarvestCandidate[]): string | null {
  const images = files.filter((f) => {
    const dot = f.name.lastIndexOf('.');
    if (dot === -1) return false;
    return HARVEST_EXTENSIONS.has(f.name.slice(dot).toLowerCase());
  });
  if (images.length === 0) return null;
  images.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return images[0].name;
}
