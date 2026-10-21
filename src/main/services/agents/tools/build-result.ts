// What an agent is told when a build ends (P3 part 4): one text block and the
// pictures the builder last looked at. Pure, so the wording and the pick are
// tested without a build. The tool reads the picked files; flows skip them
// (a node's output is the artifact, and nobody reads the images there).

import type { TsxBuildJobIpc, TsxBuildStillIpc } from '../../../../shared/ipc/types';
import type { AgentCompositionConfig } from '../../../../shared/types/agents';

/** At most this many of the last look's frames go back to the agent (~1.4k image tokens each). */
export const RESULT_STILLS_MAX = 3;

const BUDGET_LABELS: Record<TsxBuildJobIpc['budget'], string> = {
  quick: 'Quick',
  standard: 'Standard',
  craft: 'Craft',
};

/** Spread `n` picks over a list: first, middle, last for 3. */
function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const picked = new Set<number>();
  for (let i = 0; i < n; i += 1) picked.add(Math.round((i * (items.length - 1)) / (n - 1)));
  return [...picked].sort((a, b) => a - b).map((i) => items[i]);
}

/**
 * A still's look: its file name's label (`r02-f030.jpg` → `r02`; a look at a
 * changed build after the budget, `r02v1-f030.jpg` → `r02v1`, shares round 2).
 */
function lookOf(still: TsxBuildStillIpc): string {
  const name = still.path.replace(/\\/g, '/').split('/').pop() ?? '';
  return name.split('-')[0];
}

/**
 * The newest look the builder made, which is the one at the build it kept:
 * stills are listed in the order they were taken, so it is the look of the
 * last frame or sheet. Its model-size frames (≤3, spread first / middle /
 * last), or its contact sheet. Phone views are left out: they repeat a frame
 * at 390 px. Grouping by round is not enough: a look at a changed build after
 * the budget (live in P3 part 4) has the round of the look before it.
 */
export function pickResultStills(stills: TsxBuildStillIpc[]): TsxBuildStillIpc[] {
  const looks = stills.filter((s) => s.size !== 'phone');
  const last = looks[looks.length - 1];
  if (!last) return [];
  if (last.size === 'sheet') return [last];
  const label = lookOf(last);
  const frames = looks.filter((s) => s.size === 'model' && lookOf(s) === label).sort((a, b) => a.frame - b.frame);
  return spread(frames, RESULT_STILLS_MAX);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function framesLine(picked: TsxBuildStillIpc[]): string | null {
  if (picked.length === 0) return null;
  const round = picked[0].round;
  if (picked[0].size === 'sheet') {
    const frames = picked[0].frames ?? [picked[0].frame];
    return `The picture below is the contact sheet from its last look (round ${round}): frames ${frames.join(', ')}, as the builder saw them.`;
  }
  const frames = picked.map((s) => s.frame);
  const which = frames.length === 1 ? `frame ${frames[0]}` : `frames ${frames.slice(0, -1).join(', ')} and ${frames[frames.length - 1]}`;
  return `The picture${picked.length === 1 ? '' : 's'} below ${picked.length === 1 ? 'is' : 'are'} ${which} from its last look (round ${round}), as the builder saw them.`;
}

export interface BuildResultTextInput {
  /** `generate`: "Composition ready"; `edit`: "Edited <title>". */
  kind: 'generate' | 'edit';
  title: string;
  relPath: string;
  config: AgentCompositionConfig;
  build: TsxBuildJobIpc | undefined;
  /** The stills that go back with the text; empty = none (flows). */
  picked: TsxBuildStillIpc[];
}

export function buildResultText(input: BuildResultTextInput): string {
  const { config } = input;
  const seconds = (config.durationInFrames / config.fps).toFixed(1);
  const head =
    input.kind === 'generate'
      ? `Composition ready: ${input.relPath} — ${config.width}x${config.height}, ${seconds}s at ${config.fps}fps.`
      : `Edited ${input.title}: ${input.relPath} — ${config.width}x${config.height}, ${seconds}s at ${config.fps}fps.`;
  return [head, ...buildOutcomeLines(input.build, input.picked)].join('\n');
}

/** How the build went and which pictures follow: the lines under any caller's own head (Studio's generate_tsx_shot too). */
export function buildOutcomeLines(build: TsxBuildJobIpc | undefined, picked: TsxBuildStillIpc[]): string[] {
  const lines: string[] = [];
  if (build) {
    const ending = build.finished ? 'finished' : 'stopped before it finished';
    const checks = [
      build.seamOk === true ? 'loop seam OK' : build.seamOk === false ? 'loop seam NOT verified' : null,
      build.pureOk === true ? 'physics frame-pure' : build.pureOk === false ? 'physics purity NOT verified' : null,
      build.numbersOk === true ? 'numbers checked' : build.numbersOk === false ? 'numbers NOT verified (number_check: split or race)' : null,
    ].filter(Boolean);
    lines.push(
      `Built on ${BUDGET_LABELS[build.budget]}: ${plural(build.round, 'look')}, ${plural(build.checks, 'check')}, ${ending}${checks.length ? `; ${checks.join(', ')}` : ''}.`,
    );
    if (build.notice) lines.push(build.notice);
    if (build.summary?.trim()) lines.push(`Builder's summary: ${build.summary.trim()}`);
  }
  const frames = framesLine(picked);
  if (frames) lines.push(frames);
  return lines;
}
