// Dev-entry helpers for generateTsx() (builder-spike.ts). `enginesProbe` is
// free: it reports which engine every provider this profile knows would get,
// and why. `savePipelineRun` keeps what the one-shot fallback made — it saves
// nothing itself — as `<outDir>/pipeline/` (code, debug, three stills).

import fs from 'fs/promises';
import path from 'path';
import { getLlmProviders } from '../settings';
import { llmEngine, PROVIDER_PRESETS } from '../../../engine';
import { renderBuildStills } from './build-stills';
import { chooseTsxEngine } from './generate-tsx';
import type { GenerateTsxResult } from './types';

export async function enginesProbe(): Promise<Record<string, unknown>> {
  const { providers, activeProvider } = await getLlmProviders();
  const registered = llmEngine.getProviders();
  const ids = [...new Set([...providers.map((p) => p.id), ...PROVIDER_PRESETS.map((p) => p.id), ...registered])];
  const rows = [];
  for (const id of ids) {
    const saved = providers.find((p) => p.id === id);
    rows.push({
      id,
      type: saved?.type ?? PROVIDER_PRESETS.find((p) => p.id === id)?.type ?? 'unknown',
      saved: Boolean(saved),
      registered: registered.includes(id),
      ...(await chooseTsxEngine({ providerId: id })),
    });
  }
  return {
    mode: 'engines',
    activeSaved: activeProvider ?? null,
    activeEngine: llmEngine.getActiveProvider(),
    noProviderId: await chooseTsxEngine({}),
    mode3d: await chooseTsxEngine({ mode: '3d' }),
    providers: rows,
  };
}

export async function savePipelineRun(
  result: Extract<GenerateTsxResult, { engine: 'pipeline' }>,
  outDir: string,
): Promise<Record<string, unknown>> {
  const dir = path.join(outDir, 'pipeline');
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const { pipeline } = result;
  if (pipeline) {
    await fs.writeFile(path.join(dir, 'v1.tsx'), pipeline.text, 'utf-8');
    const { text: _text, ...debug } = pipeline;
    await fs.writeFile(path.join(dir, 'v1.debug.json'), JSON.stringify(debug, null, 2), 'utf-8');
  }
  if (!result.ok || !result.code || !result.config) return { dir, stills: [] };
  const last = result.config.durationInFrames - 1;
  const stills = await renderBuildStills(result.code, result.config, path.join(dir, 'stills'), [0, Math.floor(last / 2), last], {
    label: 'pipeline',
  });
  return { dir, stillsMs: stills.ms, stills: stills.stills.map((s) => s.path) };
}
