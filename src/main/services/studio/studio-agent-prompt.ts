// System prompt for the Studio editing agent. The editorial POLICY (how to
// decide what is a retake, a filler, fluff) ships as the studio-clean-cut
// skill and is composed in by runLlmGenerate; this file covers the ROLE, the
// project inventory and state, and (from studio-agent-prompt-tools.ts) the
// tool contract and workflows.

import type {
  StudioAgentAssetInfo,
  StudioAgentOpenProposal,
} from '../../../shared/ipc/types/studio';
import type { StudioShot } from '../../../shared/types/studio';
import { scriptHead } from './project-script';
import { MEMORY_LINES, TOOL_LINES, WORKFLOW_LINES } from './studio-agent-prompt-tools';

/** One pool line per shot — shared by the system prompt and `list_shots`. */
export function formatShotLine(shot: StudioShot): string {
  const duration = shot.config
    ? `${(shot.config.durationInFrames / shot.config.fps).toFixed(1)} s`
    : 'unknown length';
  const anchor = shot.anchor
    ? `, anchored to ${shot.anchor.assetId} ${shot.anchor.sourceStart.toFixed(1)}–${shot.anchor.sourceEnd.toFixed(1)}s`
    : ', unanchored';
  const origin = shot.origin?.by === 'user' ? ', imported' : '';
  return `- ${shot.id} — "${shot.name}" (${shot.kind}, ${duration}, v${shot.activeVersion}, ${shot.status}${anchor}${origin})`;
}

function assetLine(asset: StudioAgentAssetInfo): string {
  const duration =
    asset.durationSeconds !== undefined ? `${asset.durationSeconds.toFixed(1)} s` : 'unknown length';
  const transcript = asset.transcript
    ? `transcript: ${asset.transcript.engine}${asset.transcript.verbatim ? ' (verbatim)' : ' (cleaned — fillers removed by the engine)'}${asset.transcript.wordCount !== undefined ? `, ${asset.transcript.wordCount} words` : ''}`
    : 'no transcript yet';
  const description = asset.description ? ` — "${asset.description}"` : '';
  return `- ${asset.id} — "${asset.name}" (${asset.kind}, ${duration}; ${transcript})${description}`;
}

function formatTc(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const KIND_LABEL: Record<StudioAgentOpenProposal['kind'], string> = {
  'cut-plan': 'cut',
  'shot-plan': 'shot',
  'insert-plan': 'insert',
  'sfx-plan': 'sound',
};

export interface BuildAgentPromptInput {
  projectName: string;
  assets: StudioAgentAssetInfo[];
  /** Registry snapshot — the pool survives sessions, so the agent must see it. */
  shots: StudioShot[];
  toolsAvailable: boolean;
  reviewOpen: boolean;
  /** The open proposal, when one is (W3) — named so `accept_proposal` can. */
  openProposal?: StudioAgentOpenProposal;
  captions?: { templateId: string; enabled: boolean };
  timelineDurationSeconds?: number;
  /** W4: the project script; its opening is injected, the rest is on demand. */
  script?: string;
}

/** The "Script" block: the opening verbatim, the rest via `get_script`. */
function scriptLines(script: string | undefined): string[] {
  if (!script || script.trim() === '') {
    return ['## Script', '', '(none — the Script tab is empty; judge takes from the transcript alone)'];
  }
  const { head, remaining, total } = scriptHead(script);
  const lines = [
    '## Script',
    '',
    `The user wrote a script — the INTENDED FINAL READ (${total} chars). When takes differ, the keeper is the take that matches it; wording the script dropped is fluff; spell its names exactly.`,
    remaining > 0
      ? `The opening follows; call \`get_script(startChar: ${head.length})\` for the remaining ${remaining} chars before an editorial pass.`
      : 'It follows in full.',
    '',
    head,
  ];
  return lines;
}

/** The "state of the edit" block: timeline length, captions, open review. */
function stateLines(input: BuildAgentPromptInput): string[] {
  const lines: string[] = ['## State of the edit', ''];
  lines.push(
    input.timelineDurationSeconds !== undefined && input.timelineDurationSeconds > 0
      ? `- Timeline: ${formatTc(input.timelineDurationSeconds)} long.`
      : '- Timeline: empty.',
  );
  lines.push(
    input.captions
      ? `- Captions: ${input.captions.enabled ? 'on' : 'off'} (template ${input.captions.templateId}).`
      : '- Captions: none set.',
  );
  if (input.openProposal) {
    const p = input.openProposal;
    lines.push(
      `- Open proposal: id "${p.id}" — ${p.itemCount} ${KIND_LABEL[p.kind] ?? p.kind} item${p.itemCount === 1 ? '' : 's'}${p.note ? ` ("${p.note}")` : ''}, waiting in the review panel.`,
    );
  } else if (input.reviewOpen) {
    lines.push('- Open proposal: one is waiting in the review panel.');
  } else {
    lines.push('- Open proposal: none.');
  }
  return lines;
}

export function buildAgentSystemPrompt(input: BuildAgentPromptInput): string {
  const lines: string[] = [
    'You are the editing assistant inside VidTSX Studio, a desktop video editor.',
    `You are working on the project "${input.projectName}".`,
    'You act like a professional video editor: you do editorial passes over raw talking-head footage (retakes, false starts, filler, fluff), you design TSX shots — generated motion-graphics compositions (cutaways, overlays, word-synced titles) placed over or between the footage — and you can take a raw clip all the way to an exported video: transcribe, cut, shots, b-roll, captions, export, with the user answering a review card at every step.',
    '',
    '## Media assets in this project',
    '',
    ...(input.assets.length > 0 ? input.assets.map(assetLine) : ['(none imported yet)']),
    '',
    '## Shot pool (TSX shots already in this project)',
    '',
    ...(input.shots.length > 0
      ? [
          ...input.shots.map(formatShotLine),
          '',
          'These shots persist across sessions — including ones generated in earlier conversations. Any READY shot can be placed with propose_shots by its id; never regenerate a shot that already exists unless the user wants it changed.',
        ]
      : ['(empty — no shots generated or imported yet)']),
    '',
    ...scriptLines(input.script),
    '',
    ...stateLines(input),
    '',
  ];

  if (input.toolsAvailable) {
    lines.push('## Tools and workflow', '', ...TOOL_LINES, '', ...MEMORY_LINES, '', ...WORKFLOW_LINES);
    if (input.reviewOpen) {
      lines.push(
        '',
        'IMPORTANT: a proposal is already open in the review panel. `propose_cuts`, `run_auto_cut`, `generate_tsx_shot`, `propose_shots` and `insert_asset` will refuse until the user applies or rejects it — help them with questions instead. If their latest message explicitly says to apply it, call `accept_proposal` with the open proposal\'s id; otherwise do not attempt another proposal.',
      );
    }
  } else {
    lines.push(
      '## Tool availability',
      '',
      'The provider configured for this project cannot drive editing tools, so you cannot read transcripts, create cut proposals, or generate TSX shots right now — only converse. If the user asks for an editorial pass or shots, tell them to pick a Claude/Agent-SDK-based provider (Claude, OpenRouter, Z.AI, MiniMax) in the Inspector\'s AI Assistant section.',
    );
  }

  lines.push(
    '',
    '## Style',
    '',
    'Keep replies short and concrete — this is a narrow chat panel. Use plain sentences, not headers. Times read as M:SS in prose.',
    '',
    '## Content policy',
    '',
    'This app does not produce sexual or explicit content. If asked for it (in shots, images, captures, or scripts), decline briefly and say the app does not generate sexual content.',
  );

  return lines.join('\n');
}
