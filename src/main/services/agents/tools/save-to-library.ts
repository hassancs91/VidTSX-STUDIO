// `save_to_library` — file any artifact through the library import (flows
// plan §1.2, W8 Stage 3). Media artifacts already live in the library (born-
// managed, agents plan §1.11): with a `folder` they are COPIED there and
// indexed, without one they are re-described and brand-tagged in place. Work
// files (a composition, a transcript document) are copied into the library
// as ordinary content, the way the stage's "Save to Library" does. The output
// ports carry the SAME kind in — the runner puts the filed artifact only on
// the port of its kind (`port-kinds.ts`) — so a flow can save and keep going.

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type { AgentArtifact, AgentArtifactDraft } from '../../../../shared/types/agents';
import { ensureLibraryRoot, resolveLibraryPath } from '../../library/library-paths';
import { reserveLibraryFile, sanitizeFolder, slugify } from '../../library/library-filing';
import { artifactRoot } from '../artifact-paths';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { indexLibraryOutput } from './port-media';

const schema = {
  video: z.string().optional().describe('A "video" artifact id.'),
  image: z.string().optional().describe('An "image-set" artifact id.'),
  audio: z.string().optional().describe('An "audio" artifact id.'),
  composition: z.string().optional().describe('A "composition" artifact id.'),
  transcript: z.string().optional().describe('A transcript "document" artifact id.'),
  folder: z.string().optional().describe('Library folder to file into; absent = the run\'s own folder (media stays where it is).'),
  description: z.string().optional().describe('Library description; absent = the artifact title.'),
};

interface SaveToLibraryArgs {
  video?: string;
  image?: string;
  audio?: string;
  composition?: string;
  transcript?: string;
  folder?: string;
  description?: string;
}

const PORT_ORDER = ['video', 'image', 'audio', 'composition', 'transcript'] as const;

function workFileExtension(artifact: AgentArtifact): string {
  return artifact.kind === 'composition' ? '.tsx' : artifact.kind === 'web-page' ? '.html' : '.md';
}

export const saveToLibraryTool: AgentToolDef<SaveToLibraryArgs> = {
  id: 'save_to_library',
  description:
    'File an artifact in the asset library: a video, image set, audio, composition or transcript. Media is copied into the given folder (or re-described where it is); work files are copied in as library content. Returns the artifact so the flow can continue with it.',
  schema,
  ports: {
    label: 'Save to Library',
    category: 'library',
    inputs: [
      { id: 'video', label: 'Video', dataType: 'video', argKey: 'video' },
      { id: 'image', label: 'Image', dataType: 'image', argKey: 'image' },
      { id: 'audio', label: 'Audio', dataType: 'audio', argKey: 'audio' },
      { id: 'composition', label: 'Composition', dataType: 'composition', argKey: 'composition' },
      { id: 'transcript', label: 'Transcript', dataType: 'transcript', argKey: 'transcript' },
    ],
    outputs: [
      { id: 'video', label: 'Video', dataType: 'video', from: 'artifact' },
      { id: 'image', label: 'Image', dataType: 'image', from: 'artifact' },
      { id: 'audio', label: 'Audio', dataType: 'audio', from: 'artifact' },
      { id: 'composition', label: 'Composition', dataType: 'composition', from: 'artifact' },
      { id: 'transcript', label: 'Transcript', dataType: 'transcript', from: 'artifact' },
    ],
    configSchema: [
      { kind: 'text', key: 'folder', label: 'Library folder (optional)', placeholder: 'e.g. generated/thumbnails' },
      { kind: 'text', key: 'description', label: 'Description (optional)', placeholder: 'the artifact title' },
    ],
    defaultConfig: { folder: '', description: '' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    const id = PORT_ORDER.map((p) => args[p]).find((v) => typeof v === 'string' && v.length > 0);
    if (!id) return toolText('Connect something to save — a video, image, audio, composition or transcript.', true);
    const artifact = ctx.readArtifacts().find((a) => a.id === id);
    if (!artifact) return toolText(`No artifact "${id}" in this run.`, true);
    if (artifact.kind === 'job' || artifact.kind === 'web-page') {
      return toolText(`A ${artifact.kind} cannot be saved to the library.`, true);
    }
    const description = args.description?.trim() || artifact.title;
    const folder = args.folder?.trim() ? sanitizeFolder(args.folder, 'generated') : undefined;
    const root = await ensureLibraryRoot();
    try {
      if (artifactRoot(artifact) === 'library') {
        const relPaths = artifact.kind === 'image-set' ? artifact.payload.items.map((i) => i.relPath) : [artifact.payload.relPath];
        if (!folder) {
          for (const relPath of relPaths) await indexLibraryOutput(relPath, description, ctx.brandId);
          return { ...toolText(`Already in the library: ${relPaths.join(', ')} — description and brand updated.`), artifact: draftOf(artifact) };
        }
        const moved: string[] = [];
        for (const relPath of relPaths) {
          const ext = path.extname(relPath);
          const { relPath: target, absPath } = await reserveLibraryFile(root, folder, slugify(path.basename(relPath, ext)), ext);
          await fs.copyFile(resolveLibraryPath(root, relPath), absPath);
          await indexLibraryOutput(target, description, ctx.brandId);
          moved.push(target);
        }
        return { ...toolText(`Saved to ${folder}: ${moved.join(', ')}.`), artifact: draftOf(artifact, moved) };
      }
      // A work file: copy it into the library as content; the artifact keeps
      // its workspace path so a downstream node can still render or read it.
      if (artifact.kind !== 'composition' && artifact.kind !== 'document') {
        return toolText(`A ${artifact.kind} cannot be saved to the library.`, true);
      }
      const ext = workFileExtension(artifact);
      const { relPath: target, absPath } = await reserveLibraryFile(root, folder ?? sanitizeFolder(ctx.libraryFolder, 'generated'), slugify(artifact.title, artifact.kind), ext);
      await fs.copyFile(path.join(ctx.workspaceDir, artifact.payload.relPath), absPath);
      await indexLibraryOutput(target, description, ctx.brandId);
      return { ...toolText(`Saved to the library: ${target}.`), fields: { relPath: target }, artifact: draftOf(artifact) };
    } catch (err) {
      return toolText(`Save failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  },
};

/** The same artifact as a draft, with new library paths for a copied media artifact. */
function draftOf(artifact: AgentArtifact, relPaths?: string[]): AgentArtifactDraft {
  switch (artifact.kind) {
    case 'image-set':
      return {
        kind: 'image-set',
        title: artifact.title,
        payload: { items: artifact.payload.items.map((item, i) => ({ ...item, relPath: relPaths?.[i] ?? item.relPath })) },
      };
    case 'video':
      return { kind: 'video', title: artifact.title, payload: { ...artifact.payload, relPath: relPaths?.[0] ?? artifact.payload.relPath } };
    case 'audio':
      return { kind: 'audio', title: artifact.title, payload: { ...artifact.payload, relPath: relPaths?.[0] ?? artifact.payload.relPath } };
    case 'composition':
      return { kind: 'composition', title: artifact.title, payload: { ...artifact.payload } };
    case 'document':
      return { kind: 'document', title: artifact.title, payload: { ...artifact.payload } };
    case 'web-page':
      return { kind: 'web-page', title: artifact.title, payload: { ...artifact.payload } };
    case 'job':
      return { kind: 'job', title: artifact.title, payload: { ...artifact.payload } };
  }
}
