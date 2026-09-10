// Turning a web page's `artifact:` references into files (W9).
//
// A page never holds a path: it names artifacts, and the artifacts' files are
// looked up through `artifactFiles` — the same containment-checked resolver
// every viewer uses — at the moment they are needed. So the model can only
// ever reference what the session already made, and a reference to anything
// else is a plain-words problem the tool hands back, never a read.

import fs from 'fs/promises';
import path from 'path';
import type { AgentArtifact, ArtifactOfKind } from '../../../shared/types/agents';
import {
  assetNameFor,
  findArtifactRefs,
  mimeForExtension,
  refToken,
  rewriteArtifactRefs,
  type ArtifactRef,
} from '../../../shared/agents/web-page';
import { artifactFiles } from './artifact-paths';

/** Kinds a page may reference — media in the library, never work files. */
const MEDIA_KINDS = new Set<AgentArtifact['kind']>(['video', 'image-set', 'audio']);

export interface ResolvedWebPageRef extends ArtifactRef {
  absPath: string;
  /** The name it gets under `assets/` at export. */
  assetName: string;
  mime: string;
  bytes: number;
}

export interface ResolvedWebPageRefs {
  resolved: ResolvedWebPageRef[];
  problems: string[];
}

export async function resolveWebPageRefs(
  agentId: string,
  sessionId: string,
  artifacts: AgentArtifact[],
  refs: ArtifactRef[],
): Promise<ResolvedWebPageRefs> {
  const resolved: ResolvedWebPageRef[] = [];
  const problems: string[] = [];
  for (const ref of refs) {
    const token = refToken(ref);
    const artifact = artifacts.find((a) => a.id === ref.artifactId);
    if (!artifact) {
      problems.push(`${token} does not exist in this session — call list_artifacts for the ids.`);
      continue;
    }
    if (!MEDIA_KINDS.has(artifact.kind)) {
      problems.push(`${token} is a ${artifact.kind}, not media — only video, image-set and audio artifacts can be referenced.`);
      continue;
    }
    const files = await artifactFiles(agentId, sessionId, artifact);
    const absPath = files[ref.item];
    if (!absPath) {
      problems.push(
        artifact.kind === 'image-set'
          ? `${token}: that image set has ${files.length} image(s) — items run 0 to ${files.length - 1}.`
          : `${token}: a ${artifact.kind} has one file — drop the /${ref.item}.`,
      );
      continue;
    }
    let bytes: number;
    try {
      bytes = (await fs.stat(absPath)).size;
    } catch {
      problems.push(`${token}: its file is no longer on disk.`);
      continue;
    }
    const ext = path.extname(absPath);
    resolved.push({ ...ref, absPath, assetName: assetNameFor(ref, ext), mime: mimeForExtension(ext), bytes });
  }
  return { resolved, problems };
}

/** The page with every reference inlined as a data URI — what the viewer and
 *  the capture window render. */
export async function inlineWebPage(html: string, resolved: ResolvedWebPageRef[]): Promise<string> {
  const map = new Map<string, string>();
  for (const ref of resolved) {
    const data = await fs.readFile(ref.absPath);
    map.set(refToken(ref), `data:${ref.mime};base64,${data.toString('base64')}`);
  }
  return rewriteArtifactRefs(html, (ref) => map.get(refToken(ref)));
}

/** The page as an exported site sees it: references become `assets/<name>`. */
export function rewriteRefsForExport(html: string, resolved: ResolvedWebPageRef[]): string {
  const map = new Map(resolved.map((ref) => [refToken(ref), `assets/${ref.assetName}`]));
  return rewriteArtifactRefs(html, (ref) => map.get(refToken(ref)));
}

export interface LoadedWebPage {
  html: string;
  resolved: ResolvedWebPageRef[];
  /** References that no longer resolve (an image set trimmed, a file gone). */
  problems: string[];
}

/** Read a stored page and resolve its references afresh. */
export async function loadWebPage(
  agentId: string,
  sessionId: string,
  artifacts: AgentArtifact[],
  artifact: ArtifactOfKind<'web-page'>,
): Promise<LoadedWebPage> {
  const [file] = await artifactFiles(agentId, sessionId, artifact);
  const html = await fs.readFile(file, 'utf-8');
  const { resolved, problems } = await resolveWebPageRefs(
    agentId,
    sessionId,
    artifacts,
    findArtifactRefs(html),
  );
  return { html, resolved, problems };
}
