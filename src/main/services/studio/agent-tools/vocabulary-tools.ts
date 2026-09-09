// propose_vocabulary (W4): the agent proposes names and spellings for the
// project's brand — after a transcription (the manglings it saw), from the
// script (its proper nouns), or from chat. A gated multi-select card, never
// applied directly; accept writes the LIBRARY brand and retires matching
// vocabulary memories. Main stamps the brandId from project settings (the
// style-promotion rule: the agent never names a brand).

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { normalizeBrandTerm, termKey } from '../../../../shared/studio/brand-vocabulary';
import { VOCABULARY_PROPOSAL_MAX_TERMS } from '../../../../shared/types/studio-memory';
import type { StudioVocabularyTerm } from '../../../../shared/types/studio-memory';
import { readBrand } from '../../library/brand-store';
import { getLibraryRoot } from '../../library/library-paths';
import {
  addVocabularyProposal,
  hasPendingVocabularyProposal,
} from '../agent-vocabulary-proposals';
import { loadProject } from '../project-store';
import { emitTool, errorText, text, type StudioTool, type StudioToolContext } from './types';

const SOURCES = ['transcript', 'script', 'memory', 'chat'] as const;

export function buildVocabularyTools(ctx: StudioToolContext): StudioTool[] {
  const { req, state } = ctx;

  const proposeVocabulary = tool(
    'propose_vocabulary',
    "Propose names and spellings for the project's brand vocabulary: proper nouns, product names and the manglings a transcript produced for them. Call it after every transcription (compare the words against the script and the brand) and when a script names things the brand does not know. ONE card per turn, multi-select — the user ticks what goes on the brand; the transcriber is then primed with those terms and their manglings are corrected in every later transcript. Never applied directly.",
    {
      terms: z
        .array(
          z.object({
            term: z.string().describe('The CORRECT spelling (as the brand or script writes it)'),
            aliases: z.array(z.string()).optional().describe('Manglings seen in the transcript, e.g. "vid t s x"'),
            source: z.enum(SOURCES).describe('Where it came from'),
            note: z.string().optional().describe('One line of evidence, e.g. heard "Vid TSX" at 0:12 and 0:41'),
          }),
        )
        .min(1)
        .max(VOCABULARY_PROPOSAL_MAX_TERMS),
      note: z.string().optional().describe('One line for the card header, e.g. "From the transcript of clip 1"'),
    },
    async (args) => {
      emitTool(ctx, 'propose_vocabulary', `${args.terms.length} term${args.terms.length === 1 ? '' : 's'}`);
      if (state.vocabularyProposalCreated || hasPendingVocabularyProposal(req.projectId)) {
        return text("A vocabulary card is already waiting for the user's decision. Do not propose another until they answer it.", true);
      }
      try {
        const brandId = (await loadProject(req.projectId)).settings.brandId;
        if (!brandId) {
          return text('This project has no library brand, so there is nowhere to keep vocabulary. Ask the user to pick a brand in the Inspector, or propose each name with `propose_memory(kind: "vocabulary")` instead (app-wide).', true);
        }
        const brand = await readBrand(getLibraryRoot(), brandId);
        if (!brand) {
          return text('The project brand no longer exists in the library — ask the user to pick one in the Inspector.', true);
        }
        const known = new Map((brand.vocabulary ?? []).map((t) => [termKey(t.term), t] as const));
        const seen = new Set<string>();
        const terms: StudioVocabularyTerm[] = [];
        const skipped: string[] = [];
        for (const raw of args.terms) {
          const normalized = normalizeBrandTerm({ term: raw.term, aliases: raw.aliases });
          if (!normalized) continue;
          const key = termKey(normalized.term);
          if (seen.has(key)) continue;
          seen.add(key);
          const existing = known.get(key);
          const newAliases = (normalized.aliases ?? []).filter(
            (a) => !(existing?.aliases ?? []).some((x) => termKey(x) === termKey(a)),
          );
          if (existing && newAliases.length === 0) {
            skipped.push(normalized.term);
            continue;
          }
          terms.push({
            term: existing?.term ?? normalized.term,
            ...(newAliases.length > 0 ? { aliases: newAliases } : {}),
            source: raw.source,
            ...(raw.note?.trim() ? { note: raw.note.trim() } : {}),
          });
        }
        if (terms.length === 0) {
          return text(`Nothing new: ${skipped.length > 0 ? `${skipped.join(', ')} ${skipped.length === 1 ? 'is' : 'are'} already on the brand with those spellings` : 'no usable terms'}. Do not propose again this turn.`, true);
        }
        const proposal = addVocabularyProposal({
          projectId: req.projectId,
          brandId,
          brandName: brand.name,
          terms,
          ...(args.note?.trim() ? { note: args.note.trim() } : {}),
        });
        state.vocabularyProposalCreated = true;
        ctx.emit({ projectId: req.projectId, kind: 'vocabulary-proposal', proposal });
        return text(
          `Vocabulary card shown to the user (${terms.length} term${terms.length === 1 ? '' : 's'}${skipped.length > 0 ? `; ${skipped.length} already on the brand were left out` : ''}). They tick what goes on the brand "${brand.name}". Do not treat any of it as saved yet, and do not propose another card this turn — continue with the edit.`,
        );
      } catch (err) {
        return text(errorText(err), true);
      }
    },
  );

  return [proposeVocabulary];
}
