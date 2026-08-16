// PURE memory-block composition — (memories, brandId, budget) → prompt text.
// No fs, no provider, no clock: everything here is unit-testable and, more
// importantly, DETERMINISTIC. The block rides the system prompt's stable
// prefix, so any nondeterminism (Set iteration, timestamp rendering, ordering
// by a mutable field) would silently invalidate the prompt cache on every
// turn — no error, just full price (design doc M4).
//
// Ordering is tier → createdAt → id and nothing else. Truncation under the
// budget drops profile first, then vocabulary entries from the end of the
// sorted list; rules are NEVER silently dropped — if rules alone exceed the
// budget the block is emitted whole and the overflow is reported to the
// caller to log (a half-applied rule set is worse than a large prompt).

import {
  MEMORY_PROMPT_BUDGET,
  type StudioMemory,
} from '../../../shared/types/studio-memory';

const TIER_ORDER: Record<StudioMemory['kind'], number> = {
  rule: 0,
  vocabulary: 1,
  profile: 2,
};

// Header + instruction preamble, exactly as proven in the Rev 2 spike — the
// 9/9 citation rate came from the "say which one" line, so it is part of the
// evidence-backed block, not decoration (AGENT_MEMORY_DESIGN.md §Rev 2.3).
const BLOCK_HEADER =
  '## How this editor works with you\n\n' +
  'These are things the user told you. Follow them. When you follow one, say ' +
  'which one in your reply ("applied because …").';
const RULES_HEADER = '### Rules you have set';
const VOCABULARY_HEADER = '### Names and spellings';
const PROFILE_HEADER = '### About you and your channel';

export interface ComposeMemoryBlockOptions {
  /** The open project's brand; brand-scoped memories apply only on match. */
  brandId?: string;
  /** Character budget — defaults to MEMORY_PROMPT_BUDGET. */
  budget?: number;
}

export interface ComposedMemoryBlock {
  /** The composed block, or '' when no active in-scope memories exist. */
  block: string;
  /** True when the profile section was dropped to fit the budget. */
  droppedProfile: boolean;
  /** Count of vocabulary entries dropped to fit the budget. */
  droppedVocabulary: number;
  /** Chars over budget when rules alone exceed it (block still emitted whole). */
  rulesOverflowBy: number;
}

function byTierThenCreatedAtThenId(a: StudioMemory, b: StudioMemory): number {
  const tier = TIER_ORDER[a.kind] - TIER_ORDER[b.kind];
  if (tier !== 0) return tier;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

/** Rules and vocabulary render as single markdown list lines — internal
 *  newlines would escape the list (or fake a `###` section header), so
 *  they collapse to spaces here even though the store normalizes too. */
function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Profile keeps its paragraphs; just normalize line endings and runs. */
function profileText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function renderVocabularyLine(memory: StudioMemory): string {
  const aliases = (memory.aliases ?? []).map(singleLine).filter((alias) => alias.length > 0);
  const notPart = aliases.length > 0 ? ` (not ${aliases.map((a) => `"${a}"`).join(', ')})` : '';
  return `- "${singleLine(memory.text)}"${notPart}`;
}

/** Assemble the block from already-sorted tier groups. */
function render(rules: StudioMemory[], vocabulary: StudioMemory[], profile: StudioMemory[]): string {
  const sections: string[] = [BLOCK_HEADER];
  if (rules.length > 0) {
    sections.push(`${RULES_HEADER}\n${rules.map((m) => `- ${singleLine(m.text)}`).join('\n')}`);
  }
  if (vocabulary.length > 0) {
    sections.push(`${VOCABULARY_HEADER}\n${vocabulary.map(renderVocabularyLine).join('\n')}`);
  }
  if (profile.length > 0) {
    sections.push(`${PROFILE_HEADER}\n${profile.map((m) => profileText(m.text)).join('\n\n')}`);
  }
  return sections.join('\n\n');
}

export function composeMemoryBlock(
  memories: readonly StudioMemory[],
  options: ComposeMemoryBlockOptions = {},
): ComposedMemoryBlock {
  const budget = options.budget ?? MEMORY_PROMPT_BUDGET;
  const inScope = memories
    .filter((m) => m.active && (m.brandId === undefined || m.brandId === options.brandId))
    .slice()
    .sort(byTierThenCreatedAtThenId);

  if (inScope.length === 0) {
    return { block: '', droppedProfile: false, droppedVocabulary: 0, rulesOverflowBy: 0 };
  }

  const rules = inScope.filter((m) => m.kind === 'rule');
  const allVocabulary = inScope.filter((m) => m.kind === 'vocabulary');
  const profile = inScope.filter((m) => m.kind === 'profile');

  let block = render(rules, allVocabulary, profile);
  if (block.length <= budget) {
    return { block, droppedProfile: false, droppedVocabulary: 0, rulesOverflowBy: 0 };
  }

  // Over budget: drop profile first, then vocabulary from the end.
  block = render(rules, allVocabulary, []);
  let vocabulary = allVocabulary;
  while (block.length > budget && vocabulary.length > 0) {
    vocabulary = vocabulary.slice(0, -1);
    block = render(rules, vocabulary, []);
  }

  // Nothing useful survived (e.g. an oversized profile and no rules) —
  // never inject a bare header with no content under it.
  if (rules.length === 0 && vocabulary.length === 0) {
    return {
      block: '',
      droppedProfile: profile.length > 0,
      droppedVocabulary: allVocabulary.length,
      rulesOverflowBy: 0,
    };
  }

  return {
    block,
    droppedProfile: profile.length > 0,
    droppedVocabulary: allVocabulary.length - vocabulary.length,
    rulesOverflowBy: Math.max(0, block.length - budget),
  };
}
