/**
 * Catalogue of runtime-backed Python models (docs/ai-runtime-implementation-plan.md §4
 * step 2 + §7b). One profile per model: where its weights come from (never re-hosted —
 * original HF / GitHub release URLs with sha256 + bytes from the Stage 0 lab), which
 * runner script ships in resources/pipelines, and a **capability descriptor** that lets
 * the Studio agent tools, the Flows node catalogue and the UI register the model
 * automatically. New model = new profile + runner script; no UI or tool code.
 *
 * Electron-free (unit-tested); `dest` paths are relative to getPythonModelsRoot().
 */
import { z } from 'zod';
import type { PythonPipelineId } from '../../../local-python-engine/types';

export type PythonModelCategory = 'image' | '3d';

/** Where the UI lists the model: its category tab, and for images the "Image tools" section. */
export type PythonModelSection = 'image-tools' | '3d';

export type PythonArtifactKind = 'image' | 'model3d';

export interface PythonModelFile {
  /** Direct, public, unauthenticated URL (original host). */
  url: string;
  sha256: string;
  bytes: number;
  /** Path relative to the python models root; forward slashes, joined with path.join at use. */
  dest: string;
  /** Shown in the download progress cell. */
  label: string;
}

export interface PythonCapabilityDescriptor {
  inputs: Array<{ kind: 'image' }>;
  outputs: Array<{ kind: PythonArtifactKind }>;
  /** zod shape validating `options` (also the agent-tool / flow-node schema). */
  options: z.ZodRawShape;
  /** Sent to the model when the descriptor becomes an agent tool. */
  description: string;
  needs: 'ai-runtime';
  /** Card numbers, from Stage 0 measurements on the 4 GB test box. */
  estimatedSeconds: { gpu: number; cpu: number };
  /** Agent tool id / flow node id. */
  toolId: string;
}

export interface PythonModelProfile {
  id: string;
  category: PythonModelCategory;
  section: PythonModelSection;
  name: string;
  /** One line for the catalogue row. */
  summary: string;
  pipeline: PythonPipelineId;
  runtime: { id: 'pytorch'; stack: string };
  /** Files owned by this model. */
  files: PythonModelFile[];
  /** Other catalogue models whose files this model also needs at run time. */
  companions: string[];
  licence: { name: string; url: string };
  sourceUrl: string;
  /** GPU floor in MB; null when the model never uses the GPU. */
  vramMb: number | null;
  /** True when the model runs (acceptably) without a GPU. */
  cpuOk: boolean;
  /** rembg pipeline only: the session name (`models/<name>/<name>.onnx`). Default u2net. */
  rembgModel?: 'u2net' | 'isnet-general-use';
  capability: PythonCapabilityDescriptor;
}

/** Runtime stack line these profiles were validated against (AI_RUNTIME_VERSION = `${stack}.N`). */
export const PYTHON_MODEL_STACK = '2026.09';

export const PYTHON_MODEL_DOWNLOAD_TYPE = 'python-model';

// ─── Shared files ──────────────────────────────────────────────────────

/** rembg ≥ 2.0.7x layout: `<rembgHome>/models/<name>/<name>.onnx`; `rembgHome` = `<root>/rembg`. */
const U2NET_FILE: PythonModelFile = {
  url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx',
  sha256: '8d10d2f3bb75ae3b6d527c77944fc5e7dcd94b29809d47a739a7a728a912b491',
  bytes: 175_997_641,
  dest: 'rembg/models/u2net/u2net.onnx',
  label: 'Background-removal model',
};

// ─── Options schemas (zod shapes; the descriptor doubles as the tool schema) ──

export const REMBG_OPTIONS = {
  alphaMatting: z.boolean().optional().describe('Refine edges with alpha matting (slower, softer edges; good for hair)'),
  postProcessMask: z.boolean().optional().describe('Morphological clean-up of the mask (removes speckles)'),
  writeMatte: z.boolean().optional().describe('Also write the alpha matte as a grayscale PNG next to the output'),
};

export const TRIPOSR_OPTIONS = {
  quality: z.enum(['256', '512']).optional().describe('Marching-cubes resolution; 256 fits a 4 GB GPU, 512 needs 8 GB or the CPU runtime'),
  removeBackground: z.boolean().optional().describe('Cut the subject out first (default true; off for images that already have a plain background)'),
  foregroundRatio: z.number().min(0.5).max(1).optional().describe('How much of the frame the subject fills after cut-out (default 0.85)'),
  seed: z.number().int().min(0).optional().describe('Random seed (the model is close to deterministic; kept for reproducibility)'),
  device: z.enum(['auto', 'cpu']).optional().describe('Force the CPU even when a GPU runtime is installed'),
};

// ─── Catalogue ─────────────────────────────────────────────────────────

export const PYTHON_MODEL_CATALOG: readonly PythonModelProfile[] = [
  {
    id: 'rembg-u2net',
    category: 'image',
    section: 'image-tools',
    name: 'Background removal (u2net)',
    summary: 'Cuts the subject out of any photo into a transparent PNG. Runs on the CPU in 1–4 s.',
    pipeline: 'rembg',
    runtime: { id: 'pytorch', stack: PYTHON_MODEL_STACK },
    files: [U2NET_FILE],
    companions: [],
    licence: { name: 'MIT (rembg) · Apache-2.0 (U²-Net weights)', url: 'https://github.com/danielgatis/rembg/blob/main/LICENSE.txt' },
    sourceUrl: 'https://github.com/danielgatis/rembg',
    vramMb: null,
    cpuOk: true,
    rembgModel: 'u2net',
    capability: {
      inputs: [{ kind: 'image' }],
      outputs: [{ kind: 'image' }],
      options: REMBG_OPTIONS,
      description: 'Remove the background from an image, producing a PNG with transparency (subject cut-out). Runs locally on the CPU in a few seconds.',
      needs: 'ai-runtime',
      estimatedSeconds: { gpu: 3, cpu: 3 },
      toolId: 'remove_background',
    },
  },
  {
    // Stage 5 quality check (plan §9.3, 2026-09-05, 12 MP plush photo): tighter fur edge
    // and 43 % fewer faint (alpha < 32) pixels than u2net, no residue; 6.0 s vs 4.3 s.
    // "Remove background" uses it automatically once downloaded (preferredRembgModelId).
    id: 'rembg-isnet',
    category: 'image',
    section: 'image-tools',
    name: 'Background removal (ISNet)',
    summary: 'Sharper edges on fur and hair than u2net. Used automatically by Remove background once downloaded. 3–6 s on the CPU.',
    pipeline: 'rembg',
    runtime: { id: 'pytorch', stack: PYTHON_MODEL_STACK },
    files: [
      {
        url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx',
        sha256: '60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a',
        bytes: 178_648_008,
        dest: 'rembg/models/isnet-general-use/isnet-general-use.onnx',
        label: 'Background-removal model (ISNet)',
      },
    ],
    companions: [],
    licence: { name: 'MIT (rembg) · Apache-2.0 (ISNet/DIS weights)', url: 'https://github.com/xuebinqin/DIS/blob/main/LICENSE.md' },
    sourceUrl: 'https://github.com/xuebinqin/DIS',
    vramMb: null,
    cpuOk: true,
    rembgModel: 'isnet-general-use',
    capability: {
      inputs: [{ kind: 'image' }],
      outputs: [{ kind: 'image' }],
      options: REMBG_OPTIONS,
      description: 'Remove the background from an image with the ISNet model (sharper edges on fur and hair than u2net), producing a PNG with transparency. Runs locally on the CPU in a few seconds.',
      needs: 'ai-runtime',
      estimatedSeconds: { gpu: 5, cpu: 5 },
      toolId: 'remove_background_isnet',
    },
  },
  {
    id: 'triposr',
    category: '3d',
    section: '3d',
    name: 'TripoSR (image → 3D)',
    summary: 'Turns one photo into a textured 3D mesh (GLB). About 40 s on a 4 GB GPU, 1½–2 minutes on the CPU.',
    pipeline: 'triposr',
    runtime: { id: 'pytorch', stack: PYTHON_MODEL_STACK },
    files: [
      {
        url: 'https://huggingface.co/stabilityai/TripoSR/resolve/main/model.ckpt',
        sha256: '429e2c6b22a0923967459de24d67f05962b235f79cde6b032aa7ed2ffcd970ee',
        bytes: 1_677_246_742,
        dest: 'triposr/model.ckpt',
        label: 'Model weights',
      },
      {
        url: 'https://huggingface.co/stabilityai/TripoSR/resolve/main/config.yaml',
        sha256: '74ca708ce086bf68e97709ea6b3d91f14717921c04691e84043f0eb8fcc68e62',
        bytes: 987,
        dest: 'triposr/config.yaml',
        label: 'Model config',
      },
      {
        url: 'https://huggingface.co/facebook/dino-vitb16/resolve/main/config.json',
        sha256: 'b87c0270b97db085fd82cf114a761fd0f62ae7914fbd407c752a2260646b689c',
        bytes: 454,
        dest: 'dino-vitb16/config.json',
        label: 'Image encoder config',
      },
    ],
    companions: ['rembg-u2net'],
    licence: { name: 'MIT', url: 'https://huggingface.co/stabilityai/TripoSR/blob/main/LICENSE' },
    sourceUrl: 'https://huggingface.co/stabilityai/TripoSR',
    vramMb: 4096,
    cpuOk: true,
    capability: {
      inputs: [{ kind: 'image' }],
      outputs: [{ kind: 'model3d' }],
      options: TRIPOSR_OPTIONS,
      description: 'Generate a 3D mesh (GLB with vertex colours) from a single image of an object. Background is removed automatically. Slow: ~40 s on a GPU, 1.5–2 min on the CPU.',
      needs: 'ai-runtime',
      // Measured through the app on the 4 GB test box (Stage 4 E2E): GPU 42 s warm incl. the preview, CPU 96–124 s.
      estimatedSeconds: { gpu: 40, cpu: 110 },
      toolId: 'generate_3d',
    },
  },
];

export function pythonModelById(id: string): PythonModelProfile | undefined {
  return PYTHON_MODEL_CATALOG.find((p) => p.id === id);
}

/** The profile's own files followed by every companion's files (deduplicated by dest). */
export function pythonModelAllFiles(profile: PythonModelProfile): PythonModelFile[] {
  const out: PythonModelFile[] = [...profile.files];
  const seen = new Set(profile.files.map((f) => f.dest));
  for (const id of profile.companions) {
    const companion = pythonModelById(id);
    if (!companion) continue;
    for (const f of companion.files) {
      if (seen.has(f.dest)) continue;
      seen.add(f.dest);
      out.push(f);
    }
  }
  return out;
}

/** Bytes of the files the model itself owns (catalogue row size). */
export function pythonModelOwnBytes(profile: PythonModelProfile): number {
  return profile.files.reduce((n, f) => n + f.bytes, 0);
}

/** Stable download-task id for a file, shared by every model that needs it. */
export function pythonModelFileTaskId(file: PythonModelFile): string {
  return `pymodel-${file.dest.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/** "176 MB" / "1.7 GB" for labels. */
export function formatModelBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}
