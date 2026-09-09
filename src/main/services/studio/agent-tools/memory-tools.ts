// Memory cards: propose_memory (one durable rule/vocabulary/profile) and
// propose_style_promotion (fold a stable brand-scoped rule into the brand's
// styleNotes). Both are gated cards — never applied directly.

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { applyStyleNotesPromotion } from '../../../../shared/studio/brand';
import { MEMORY_TEXT_LIMITS } from '../../../../shared/types/studio-memory';
import { readBrand } from '../../library/brand-store';
import { getLibraryRoot } from '../../library/library-paths';
import { listMemories } from '../agent-memory';
import { addProposal, hasPendingProposal } from '../agent-memory-proposals';
import { addPromotion, hasPendingPromotion } from '../agent-style-promotions';
import { loadProject } from '../project-store';
import { emitTool, errorText, text, type StudioTool, type StudioToolContext } from './types';

export function buildMemoryTools(ctx: StudioToolContext): StudioTool[] {
  const { req, state } = ctx;

  const proposeMemory = tool(
    'propose_memory',
    'Propose ONE durable memory (rule / vocabulary / profile) when the user states a GENERAL preference. Never applied directly — it becomes a card the user accepts, edits, or rejects. Do not treat it as remembered until they accept.',
    {
      kind: z.enum(['rule', 'vocabulary', 'profile']),
      text: z
        .string()
        .describe(
          'The memory as the agent will read it back: rules are one imperative sentence; vocabulary is the CORRECT spelling; profile is a durable fact about the user/channel.',
        ),
      aliases: z
        .array(z.string())
        .optional()
        .describe('vocabulary only — the misspellings this entry corrects'),
      brandScoped: z
        .boolean()
        .optional()
        .describe(
          "rules only — true when the rule expresses THIS brand's look rather than a universal preference; the rule then applies only to projects using the current brand",
        ),
    },
    async (args) => {
      emitTool(ctx, 'propose_memory', args.text.slice(0, 60));
      if (state.memoryProposalCreated || hasPendingProposal(req.projectId) || hasPendingPromotion(req.projectId)) {
        return text(
          "A proposal card is already waiting for the user's decision. Do not propose another until they answer it.",
          true,
        );
      }
      const trimmed = args.text.replace(/\s+/g, ' ').trim();
      if (!trimmed) return text('A memory proposal needs text.', true);
      const limit = MEMORY_TEXT_LIMITS[args.kind];
      if (trimmed.length > limit) {
        return text(`A ${args.kind} memory is limited to ${limit} characters — shorten it.`, true);
      }
      try {
        // Q6b: brand scoping is stamped by MAIN from project settings —
        // the agent only ever says "this is about the brand", never which.
        let brandId: string | undefined;
        let brandName: string | undefined;
        if (args.brandScoped) {
          if (args.kind !== 'rule') {
            return text('brandScoped applies only to rules — propose it as a rule or drop the scope.', true);
          }
          brandId = (await loadProject(req.projectId)).settings.brandId;
          if (!brandId) {
            return text('This project has no active brand — propose the rule unscoped instead.', true);
          }
          brandName = (await readBrand(getLibraryRoot(), brandId))?.name;
        }
        // The active set is in the prompt, but guard anyway: a duplicate
        // card teaches the user to reject reflexively.
        const existing = await listMemories();
        const duplicate = existing.find(
          (m) => m.active && m.kind === args.kind && m.text.toLowerCase() === trimmed.toLowerCase(),
        );
        if (duplicate) {
          return text('That is already in the active memory set — do not propose it again.', true);
        }
        const proposal = addProposal({
          projectId: req.projectId,
          kind: args.kind,
          text: trimmed,
          ...(args.aliases ? { aliases: args.aliases } : {}),
          ...(brandId ? { brandId } : {}),
          ...(brandName ? { brandName } : {}),
        });
        state.memoryProposalCreated = true;
        ctx.emit({ projectId: req.projectId, kind: 'memory-proposal', proposal });
        return text(
          'Proposal shown to the user as a card in this panel — they may accept, edit, or reject it. ' +
            'Do not treat it as remembered yet, and do not propose another this turn.',
        );
      } catch (err) {
        return text(errorText(err), true);
      }
    },
  );

  const proposeStylePromotion = tool(
    'propose_style_promotion',
    "Propose promoting ONE stable brand-scoped style rule from memory into the brand's styleNotes (Q6c). Use only when the rule has held across multiple shots — name that evidence. Never applied directly: it becomes a card; on accept the brand is updated and the memory retires (styleNotes then carries the rule instead).",
    {
      rule: z
        .string()
        .describe(
          'The rule EXACTLY as it appears in your memory block — main resolves it to the stored brand-scoped rule.',
        ),
      evidence: z
        .string()
        .describe(
          'The named evidence shown to the user: which shots/regenerations the rule held across (e.g. "applied on intro-title, end-card and published-guide without correction").',
        ),
      displaces: z
        .string()
        .optional()
        .describe(
          'Only when the 2000-char styleNotes cap would overflow: the exact substring of the CURRENT styleNotes this promotion removes to make room.',
        ),
    },
    async (args) => {
      emitTool(ctx, 'propose_style_promotion', args.rule.slice(0, 60));
      if (
        state.stylePromotionCreated ||
        state.memoryProposalCreated ||
        hasPendingPromotion(req.projectId) ||
        hasPendingProposal(req.projectId)
      ) {
        return text(
          "A proposal card is already waiting for the user's decision. Do not propose another until they answer it.",
          true,
        );
      }
      const evidence = args.evidence.replace(/\s+/g, ' ').trim();
      if (!evidence) {
        return text('A promotion needs its evidence named — which shots did the rule hold across?', true);
      }
      try {
        const brandId = (await loadProject(req.projectId)).settings.brandId;
        if (!brandId) {
          return text('This project has no active brand — there is nothing to promote into.', true);
        }
        const brand = await readBrand(getLibraryRoot(), brandId);
        if (!brand) {
          return text('The project brand no longer exists — nothing to promote into.', true);
        }
        const wanted = args.rule.replace(/\s+/g, ' ').trim().toLowerCase();
        const memory = (await listMemories()).find(
          (m) =>
            m.active &&
            m.kind === 'rule' &&
            m.brandId === brandId &&
            m.text.toLowerCase() === wanted,
        );
        if (!memory) {
          return text(
            `No active brand-scoped rule matches that text for brand "${brand.name}". Promote only rules that exist in your memory block and were accepted as brand-scoped.`,
            true,
          );
        }
        const composed = applyStyleNotesPromotion(brand.styleNotes, memory.text, args.displaces);
        if (!composed.ok) {
          if (composed.reason === 'already-present') {
            return text('The styleNotes already carry this rule — tell the user the memory can simply be retired.', true);
          }
          if (composed.reason === 'displaces-not-found') {
            return text('`displaces` must be an exact substring of the CURRENT styleNotes — it was not found.', true);
          }
          return text(
            `Promoting would exceed the ${String(2000)}-char styleNotes cap by ${String(composed.overBy ?? 0)} chars. Name what it displaces: pass \`displaces\` with an exact substring of the current styleNotes to remove.\n\nCurrent styleNotes:\n${brand.styleNotes ?? ''}`,
            true,
          );
        }
        const proposal = addPromotion({
          projectId: req.projectId,
          memoryId: memory.id,
          ruleText: memory.text,
          brandId,
          brandName: brand.name,
          evidence,
          ...(brand.styleNotes !== undefined ? { currentStyleNotes: brand.styleNotes } : {}),
          proposedStyleNotes: composed.next,
          ...(args.displaces !== undefined ? { displaces: args.displaces } : {}),
        });
        state.stylePromotionCreated = true;
        ctx.emit({ projectId: req.projectId, kind: 'style-promotion-proposal', proposal });
        return text(
          'Promotion shown to the user as a card in this panel — on accept the brand styleNotes update and the memory retires. Do not treat it as done yet, and do not propose another this turn.',
        );
      } catch (err) {
        return text(errorText(err), true);
      }
    },
  );

  return [proposeMemory, proposeStylePromotion];
}
