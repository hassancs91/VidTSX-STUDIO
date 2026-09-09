// W3 `insert_asset`: build the ONE-clip insert proposal the review panel
// shows. Pure — the tool resolves assets and imports; this file turns a
// validated request into a StudioProposal and resolves "at the Nth time the
// speaker says X" against the footage transcript. Placement stays
// renderer-mapped at apply (the cut/shot discipline): a word anchor becomes
// a source span on the footage asset, a plain time becomes `timelineStart`.

import type {
  StudioInsertLane,
  StudioProposal,
  StudioProposalItem,
} from '../../../shared/types/studio';
import { makeProposalId } from '../../../shared/studio/cut-proposal';

/** How long a still image occupies the timeline when no duration is given
 *  (mirrors the renderer's clip-factory DEFAULT_IMAGE_DURATION). */
export const DEFAULT_INSERT_IMAGE_DURATION = 5;

export interface InsertWord {
  text: string;
  start: number;
  end: number;
}

export interface WordAnchorMatch {
  /** Source seconds of the matched word's start. */
  start: number;
  /** Index of the matched occurrence (1-based) and how many there were. */
  take: number;
  total: number;
}

function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim();
}

/**
 * Find the `take`-th occurrence (1-based) of `phrase` — one word or a short
 * run of words — in the transcript. Punctuation and case are ignored. Returns
 * null when the phrase never occurs, or the take is out of range (the
 * `total` tells the caller how many there were).
 */
export function resolveWordAnchor(
  words: InsertWord[],
  phrase: string,
  take = 1,
): WordAnchorMatch | { start: null; take: number; total: number } {
  const wanted = normalizeWord(phrase).split(' ').filter(Boolean);
  if (wanted.length === 0) return { start: null, take, total: 0 };
  const tokens = words.map((w) => normalizeWord(w.text));
  const starts: number[] = [];
  for (let i = 0; i + wanted.length <= tokens.length; i++) {
    let hit = true;
    for (let j = 0; j < wanted.length; j++) {
      if (tokens[i + j] !== wanted[j]) {
        hit = false;
        break;
      }
    }
    if (hit) starts.push(words[i].start);
  }
  if (take < 1 || take > starts.length) return { start: null, take, total: starts.length };
  return { start: starts[take - 1], take, total: starts.length };
}

export interface BuildInsertProposalInput {
  /** The project asset to place. */
  asset: { id: string; name: string; kind: 'video' | 'audio' | 'image'; durationSeconds?: number };
  lane: StudioInsertLane;
  /** Either a footage anchor (source seconds) or a timeline position. */
  at: { anchorAssetId: string; sourceStart: number } | { timelineStart: number };
  /** Clip length, timeline seconds; defaults from the asset. */
  duration?: number;
  gain?: number;
  /** Why here — shown in the review row. */
  note?: string;
  /** Review header. */
  summary?: string;
  createdAt?: string;
}

/** Clip length when none was asked for: the media's own length, images 5 s. */
export function defaultInsertDuration(asset: BuildInsertProposalInput['asset']): number {
  if (asset.kind === 'image') return DEFAULT_INSERT_IMAGE_DURATION;
  return Math.max(0.1, asset.durationSeconds ?? DEFAULT_INSERT_IMAGE_DURATION);
}

/** Where the item lands, for the summary line. */
function placementLabel(input: BuildInsertProposalInput): string {
  if ('timelineStart' in input.at) return `at ${formatTc(input.at.timelineStart)}`;
  return `where the footage reaches ${formatTc(input.at.sourceStart)} (source)`;
}

function formatTc(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

/** One insert-plan proposal with one accepted item. */
export function buildInsertProposal(input: BuildInsertProposalInput): StudioProposal {
  const duration = Math.max(0.1, input.duration ?? defaultInsertDuration(input.asset));
  // A media clip cannot outlast its source (images have no source length).
  const clipped =
    input.asset.kind !== 'image' && input.asset.durationSeconds !== undefined
      ? Math.min(duration, Math.max(0.1, input.asset.durationSeconds))
      : duration;
  const placement =
    'timelineStart' in input.at
      ? { timelineStart: Math.max(0, input.at.timelineStart) }
      : {
          assetId: input.at.anchorAssetId,
          sourceStart: input.at.sourceStart,
          sourceEnd: input.at.sourceStart + clipped,
        };
  const item: StudioProposalItem = {
    id: `ins_${Math.random().toString(36).slice(2, 8)}`,
    status: 'accepted',
    ...placement,
    duration: clipped,
    ...(input.note ? { note: input.note } : {}),
    insert: {
      assetId: input.asset.id,
      kind: input.asset.kind,
      lane: input.lane,
      ...(input.gain !== undefined ? { gain: input.gain } : {}),
    },
  };
  const laneLabel = input.lane === 'broll' ? 'b-roll' : input.lane;
  const headline =
    input.summary ??
    `Insert "${input.asset.name}" as ${laneLabel} ${placementLabel(input)} · ${clipped.toFixed(1)} s`;
  return {
    id: makeProposalId(),
    kind: 'insert-plan',
    status: 'proposed',
    createdAt: input.createdAt ?? new Date().toISOString(),
    agentNote: headline,
    items: [item],
  };
}
