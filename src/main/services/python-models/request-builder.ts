/**
 * Pure: catalogue profile + caller input → the JSON request a runner understands
 * (resources/pipelines/<pipeline>/runner.py docstrings are the contract). Options are
 * validated against the profile's zod shape first, so an agent or a flow cannot pass a
 * field the runner would ignore silently. Unit-tested; no fs, no electron.
 */
import path from 'path';
import { z } from 'zod';
import type { PythonModelProfile } from './registry';

export interface BuildRequestInput {
  profile: PythonModelProfile;
  /** getPythonModelsRoot() — absolute. */
  modelsRoot: string;
  imagePath: string;
  outputPath: string;
  /** Already validated by `validatePythonOptions`. */
  options: Record<string, unknown>;
  /** 'cpu' forces the CPU path (also sets CUDA_VISIBLE_DEVICES=-1 in the runner). */
  device: 'auto' | 'cpu';
  /** 3D only: where the runner should render the view-0 preview PNG. */
  previewPath?: string;
}

/** Parse `options` with the profile's schema; unknown keys are an error (strict). */
export function validatePythonOptions(profile: PythonModelProfile, options: Record<string, unknown> | undefined): Record<string, unknown> {
  const schema = z.object(profile.capability.options).strict();
  const result = schema.safeParse(options ?? {});
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? `${first.path.join('.')}: ` : '';
    throw new Error(`Invalid options for ${profile.id} — ${where}${first?.message ?? 'invalid'}`);
  }
  return result.data as Record<string, unknown>;
}

/** Output file extension per artifact kind. */
export function outputExtensionFor(profile: PythonModelProfile): string {
  return profile.capability.outputs[0]?.kind === 'model3d' ? '.glb' : '.png';
}

export function rembgHomeFor(modelsRoot: string): string {
  return path.join(modelsRoot, 'rembg');
}

export function buildPythonRequest(input: BuildRequestInput): Record<string, unknown> {
  const { profile, modelsRoot, imagePath, outputPath, options } = input;
  switch (profile.pipeline) {
    case 'rembg': {
      const matte = options.writeMatte === true
        ? path.join(path.dirname(outputPath), `${path.basename(outputPath, path.extname(outputPath))}-matte.png`)
        : undefined;
      return {
        imagePath,
        outputPath,
        rembgHome: rembgHomeFor(modelsRoot),
        model: 'u2net',
        device: 'cpu',
        alphaMatting: options.alphaMatting === true,
        postProcessMask: options.postProcessMask === true,
        ...(matte ? { mattePath: matte } : {}),
      };
    }
    case 'triposr': {
      const quality = typeof options.quality === 'string' ? Number.parseInt(options.quality, 10) : 256;
      return {
        imagePath,
        outputPath,
        modelDir: path.join(modelsRoot, 'triposr'),
        dinoConfigPath: path.join(modelsRoot, 'dino-vitb16', 'config.json'),
        rembgHome: rembgHomeFor(modelsRoot),
        rembgModel: 'u2net',
        mcResolution: Number.isFinite(quality) ? quality : 256,
        removeBackground: options.removeBackground !== false,
        foregroundRatio: typeof options.foregroundRatio === 'number' ? options.foregroundRatio : 0.85,
        device: input.device === 'cpu' ? 'cpu' : (options.device === 'cpu' ? 'cpu' : 'auto'),
        ...(typeof options.seed === 'number' ? { seed: options.seed } : {}),
        // NeRF preview: 320² costs ~1 s on the GPU but 27 s on the CPU (measured) → 160² there.
        ...(input.previewPath ? { previewPath: input.previewPath, previewSize: input.device === 'cpu' || options.device === 'cpu' ? 160 : 320 } : {}),
      };
    }
    default:
      throw new Error(`No request builder for pipeline "${String(profile.pipeline)}"`);
  }
}
