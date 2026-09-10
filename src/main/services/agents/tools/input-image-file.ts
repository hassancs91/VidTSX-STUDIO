// `input_image_file` — an uploaded image as an `image` port value (flows plan
// §1.2; the renderer's `input-image-upload` node, moved to main in W8 Stage
// 1). The inspector's upload field stores the DOWNSCALED base64 in node
// config (`base64`, `fileName`, `width`, `height`, `contentType`); a run param
// of kind `image` may instead bind an absolute file path. Either way the bytes
// are written into the run's library folder and returned as an `image-set`.

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { imageExtension, importLibraryInput, readImageDimensions } from './port-media';

const schema = {
  base64: z.string().optional().describe('The image bytes, base64 (no data: prefix).'),
  filePath: z.string().optional().describe('Absolute path of an image file, instead of base64.'),
  fileName: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  contentType: z.string().optional(),
};

interface InputImageFileArgs {
  base64?: string;
  filePath?: string;
  fileName?: string;
  width?: number;
  height?: number;
  contentType?: string;
}

export const inputImageFileTool: AgentToolDef<InputImageFileArgs> = {
  id: 'input_image_file',
  description:
    'Bring an image file into the run as an "image-set" artifact — from base64 or an absolute path. A flow input node; the file is picked in the inspector or bound to a run parameter.',
  schema,
  ports: {
    label: 'Upload Image',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'image', label: 'Image', dataType: 'image', from: 'artifact' }],
    configSchema: [{ kind: 'image-upload', key: 'base64', label: 'Image file' }],
    defaultConfig: { base64: '', fileName: '', width: 0, height: 0, contentType: 'image/jpeg' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    let bytes: Buffer;
    let fileName = args.fileName ?? '';
    if (args.filePath) {
      try {
        bytes = await fs.readFile(args.filePath);
      } catch {
        return toolText(`The image file ${args.filePath} could not be read.`, true);
      }
      fileName = fileName || path.basename(args.filePath);
    } else if (args.base64) {
      bytes = Buffer.from(args.base64, 'base64');
    } else {
      return toolText('No image uploaded — pick a file in the inspector.', true);
    }
    if (bytes.length === 0) return toolText('The image is empty.', true);

    ctx.emitProgress(fileName || 'uploaded image');
    const baseName = fileName ? path.basename(fileName, path.extname(fileName)) : 'upload';
    const { relPath } = await importLibraryInput({
      libraryFolder: ctx.libraryFolder,
      baseName,
      ext: imageExtension(args.contentType, fileName),
      bytes,
      description: fileName || 'Uploaded image',
    });
    const dims = readImageDimensions(bytes);
    const width = args.width && args.width > 0 ? args.width : (dims?.width ?? 0);
    const height = args.height && args.height > 0 ? args.height : (dims?.height ?? 0);
    return {
      ...toolText(`Image ready: ${relPath} (${width}x${height}).`),
      artifact: {
        kind: 'image-set',
        title: (fileName || 'Uploaded image').slice(0, 80),
        payload: { items: [{ relPath, width, height }] },
      },
    };
  },
};
