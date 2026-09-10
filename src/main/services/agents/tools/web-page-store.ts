// Storing a web page the model wrote (W9): the one gate `write_page` and
// `edit_page` both pass through, so an edit can never store what a write
// would have refused.
//
// Three checks, in order, each answered in plain words the model can act on:
// the document is one self-contained HTML page that reaches nothing outside
// itself (`validateWebPageDocument`), every `artifact:` reference names media
// this session made (`resolveWebPageRefs`), and the page with those files
// inlined stays under the 16 MB cap the viewer serves it at.

import fs from 'fs/promises';
import type { AgentArtifactDraft } from '../../../../shared/types/agents';
import {
  WEB_PAGE_INLINE_CAP_BYTES,
  findArtifactRefs,
  inlinedWeight,
  validateWebPageDocument,
} from '../../../../shared/agents/web-page';
import { resolveWebPageRefs, type ResolvedWebPageRef } from '../web-page-refs';
import type { AgentToolContext } from './types';
import { reserveWorkspaceFile } from './workspace-files';

/** Bigger than any landing page has a reason to be; also bounds the LLM edit. */
export const MAX_PAGE_CHARS = 400_000;
const MAX_PROBLEMS_LISTED = 8;

export type StoreWebPageResult =
  | {
      ok: true;
      relPath: string;
      absPath: string;
      refs: ResolvedWebPageRef[];
      inlineBytes: number;
      draft: Extract<AgentArtifactDraft, { kind: 'web-page' }>;
    }
  | { ok: false; error: string };

function listProblems(lead: string, problems: string[]): string {
  const shown = problems.slice(0, MAX_PROBLEMS_LISTED).map((p) => `- ${p}`);
  const more = problems.length > MAX_PROBLEMS_LISTED ? `\n- …and ${problems.length - MAX_PROBLEMS_LISTED} more` : '';
  return `${lead}\n${shown.join('\n')}${more}`;
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function storeWebPage(
  ctx: AgentToolContext,
  title: string,
  html: string,
): Promise<StoreWebPageResult> {
  if (html.length > MAX_PAGE_CHARS) {
    return { ok: false, error: `The page is ${html.length} characters (max ${MAX_PAGE_CHARS}). Write less.` };
  }
  const problems = validateWebPageDocument(html);
  if (problems.length > 0) {
    return { ok: false, error: listProblems('The page was not stored. Fix these and write it again:', problems) };
  }
  const { resolved, problems: refProblems } = await resolveWebPageRefs(
    ctx.agentId,
    ctx.sessionId,
    ctx.readArtifacts(),
    findArtifactRefs(html),
  );
  if (refProblems.length > 0) {
    return { ok: false, error: listProblems('The page was not stored — its references do not resolve:', refProblems) };
  }
  const inlineBytes = inlinedWeight(html.length, resolved.map((r) => r.bytes));
  if (inlineBytes > WEB_PAGE_INLINE_CAP_BYTES) {
    const heaviest = [...resolved].sort((a, b) => b.bytes - a.bytes).slice(0, 3);
    return {
      ok: false,
      error: `The page was not stored: with its media inlined it weighs ${megabytes(inlineBytes)}, over the ${megabytes(WEB_PAGE_INLINE_CAP_BYTES)} cap the preview serves it at. Reference fewer or smaller files${heaviest.length ? ` (heaviest: ${heaviest.map((r) => `artifact:${r.artifactId} ${megabytes(r.bytes)}`).join(', ')})` : ''} — a shorter or lower-resolution video, a smaller image.`,
    };
  }
  const { relPath, absPath } = await reserveWorkspaceFile(ctx.workspaceDir, 'pages', title, '.html', 'page');
  await fs.writeFile(absPath, html, 'utf-8');
  return {
    ok: true,
    relPath,
    absPath,
    refs: resolved,
    inlineBytes,
    draft: {
      kind: 'web-page',
      title,
      payload: {
        relPath,
        refs: resolved.map((r) => ({ artifactId: r.artifactId, item: r.item })),
        inlineBytes,
      },
    },
  };
}

/** The line a tool answers with once a page is stored. */
export function describeStoredPage(relPath: string, refs: ResolvedWebPageRef[], inlineBytes: number): string {
  const media = refs.length === 0 ? 'no media' : `${refs.length} media reference(s)`;
  return `${relPath} (${media}, ${(inlineBytes / 1024).toFixed(0)} KB inlined)`;
}
