// Read-only project context (W3): list_assets (project inventory or the
// app-wide library) and get_brand (the brand shots and images render under).

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { formatBrandSummary } from '../../library/brand-summary';
import { getLibraryRoot } from '../../library/library-paths';
import { loadIndex } from '../../library/library-store';
import { classifyMediaKind } from '../media-import';
import { resolveProjectBrand } from '../project-brand';
import { LIBRARY_REF_PREFIX } from '../shot-asset-refs';
import {
  emitTool,
  errorText,
  projectInventory,
  readProjectBrandId,
  text,
  type StudioTool,
  type StudioToolContext,
} from './types';

/** Library listings are capped so a large root cannot flood the context. */
const LIBRARY_LIST_CAP = 150;

export function buildProjectTools(ctx: StudioToolContext): StudioTool[] {
  const { req } = ctx;

  const listAssets = tool(
    'list_assets',
    'List media: scope "project" (default) is this project\'s inventory — ids, kinds, lengths, transcript state, descriptions — including anything imported this turn; scope "library" is the app-wide asset library (generated images/videos, captures, imports) as "library:<path>" refs with descriptions and brand tags, usable in insert_asset and generate_tsx_shot assetRefs.',
    {
      scope: z.enum(['project', 'library']).optional(),
      kind: z.enum(['video', 'audio', 'image']).optional().describe('Filter by media kind'),
      query: z.string().optional().describe('Case-insensitive substring over names/paths and descriptions'),
    },
    async (args) => {
      const scope = args.scope ?? 'project';
      emitTool(ctx, 'list_assets', `${scope}${args.kind ? ` · ${args.kind}` : ''}${args.query ? ` · "${args.query}"` : ''}`);
      const q = args.query?.toLowerCase();
      if (scope === 'project') {
        const rows = projectInventory(ctx)
          .filter((a) => !args.kind || a.kind === args.kind)
          .filter((a) => !q || a.name.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q))
          .map((a) => {
            const length = a.durationSeconds !== undefined ? `${a.durationSeconds.toFixed(1)} s` : 'unknown length';
            const transcript = a.transcript
              ? `transcript: ${a.transcript.engine}${a.transcript.verbatim ? ' (verbatim)' : ''}${a.transcript.wordCount !== undefined ? `, ${a.transcript.wordCount} words` : ''}`
              : 'no transcript';
            return `- ${a.id} — "${a.name}" (${a.kind}, ${length}; ${transcript})${a.description ? ` — "${a.description}"` : ''}`;
          });
        return text(rows.length > 0 ? rows.join('\n') : 'No matching assets in the project.');
      }
      try {
        const index = await loadIndex(getLibraryRoot());
        const rows: string[] = [];
        for (const entry of index.entries) {
          const kind = classifyMediaKind(entry.relPath);
          if (!kind || (args.kind && kind !== args.kind)) continue;
          if (q && !entry.relPath.toLowerCase().includes(q) && !(entry.description ?? '').toLowerCase().includes(q)) continue;
          const length = entry.probe?.duration ? `, ${entry.probe.duration.toFixed(1)} s` : '';
          rows.push(
            `- ${LIBRARY_REF_PREFIX}${entry.relPath} (${kind}${length}, ${entry.origin}${entry.brandId ? `, brand: ${entry.brandId}` : ''})${entry.description ? ` — "${entry.description}"` : ''}`,
          );
          if (rows.length >= LIBRARY_LIST_CAP) {
            rows.push(`… capped at ${LIBRARY_LIST_CAP} — narrow with query/kind.`);
            break;
          }
        }
        return text(rows.length > 0 ? rows.join('\n') : 'No matching assets in the library.');
      } catch (err) {
        return text(`Could not read the library: ${errorText(err)}`, true);
      }
    },
  );

  const getBrand = tool(
    'get_brand',
    "Read the project's active brand: name, palette, fonts, logo refs (usable in assetRefs / insert_asset), the style notes every shot and generated image already follows, and the vocabulary (names spelled the brand's way — use them verbatim in titles and captions). Read it before designing shots or picking colours; never restate its rules in briefs.",
    {},
    async () => {
      emitTool(ctx, 'get_brand');
      try {
        const brandId = await readProjectBrandId(req.projectId);
        const brand = await resolveProjectBrand(req.projectId, brandId);
        if (!brand) return text('This project has no active brand — shots use their own defaults. The user can pick one in the Inspector.');
        return text(formatBrandSummary(brand, { logoRefPrefix: LIBRARY_REF_PREFIX }));
      } catch (err) {
        return text(`Could not read the brand: ${errorText(err)}`, true);
      }
    },
  );

  return [listAssets, getBrand];
}
