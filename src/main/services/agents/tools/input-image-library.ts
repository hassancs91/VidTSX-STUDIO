// `input_image_library` — an Image Studio gallery entry as an `image` port
// value (flows plan §1.2; the renderer's `input-image-from-gallery` node,
// moved to main in W8 Stage 1). The picked file is COPIED into the run's
// library folder and returned as a one-item `image-set` artifact, so the run
// keeps working after the gallery entry is deleted.

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { getImageEntry, getImageFilePath } from '../../image-studio-db';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { imageExtension, importLibraryInput, readImageDimensions } from './port-media';

const schema = {
  entryId: z.string().describe('Image Studio gallery entry id.'),
};

interface InputImageLibraryArgs {
  entryId: string;
}

export interface ImageLibraryLookup {
  entry(id: string): { fileName: string; prompt: string; width: number | null; height: number | null; contentType: string } | null;
  filePath(id: string): string | null;
}

const defaultLookup: ImageLibraryLookup = {
  entry: (id) => getImageEntry(id),
  filePath: (id) => getImageFilePath(id),
};

/** Test seam: replace the gallery lookup. */
let lookup: ImageLibraryLookup = defaultLookup;
export function setImageLibraryLookupForTests(next: ImageLibraryLookup | null): void {
  lookup = next ?? defaultLookup;
}

export const inputImageLibraryTool: AgentToolDef<InputImageLibraryArgs> = {
  id: 'input_image_library',
  description:
    'Bring an image from the Image Studio gallery into the run as an "image-set" artifact. A flow input node — the entry is picked in the inspector.',
  schema,
  ports: {
    label: 'Image from Gallery',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'image', label: 'Image', dataType: 'image', from: 'artifact' }],
    configSchema: [{ kind: 'gallery-image-picker', key: 'entryId', label: 'Image' }],
    defaultConfig: { entryId: '' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    if (!args.entryId) return toolText('No image selected — pick one in the inspector.', true);
    const entry = lookup.entry(args.entryId);
    const sourcePath = lookup.filePath(args.entryId);
    if (!entry || !sourcePath) {
      return toolText(`Gallery image "${args.entryId}" no longer exists — pick another in the inspector.`, true);
    }
    try {
      await fs.access(sourcePath);
    } catch {
      return toolText(`The file behind gallery image "${args.entryId}" is missing on disk.`, true);
    }
    ctx.emitProgress(entry.fileName);
    const baseName = entry.prompt || path.basename(entry.fileName, path.extname(entry.fileName));
    const { relPath, absPath } = await importLibraryInput({
      libraryFolder: ctx.libraryFolder,
      baseName,
      ext: imageExtension(entry.contentType, entry.fileName),
      sourcePath,
      description: entry.prompt || entry.fileName,
    });
    let width = entry.width ?? 0;
    let height = entry.height ?? 0;
    if (!width || !height) {
      const dims = readImageDimensions(await fs.readFile(absPath));
      if (dims) ({ width, height } = dims);
    }
    return {
      ...toolText(`Image ready: ${relPath} (${width}x${height}).`),
      artifact: {
        kind: 'image-set',
        title: (entry.prompt || entry.fileName).slice(0, 80),
        payload: { items: [{ relPath, width, height }] },
      },
    };
  },
};
