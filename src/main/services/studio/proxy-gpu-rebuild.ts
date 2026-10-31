// A4 override: after the GPU encoder download from the first-4K-import card,
// the proxies this session built (or is building) on x264 are rebuilt on the
// GPU — the clip that triggered the card ends with an `nvenc-…` proxy without
// a re-import. Jobs still queued pick the GPU by themselves when they start
// (`generateProxy` resolves the encoder per build).

import { logEngine } from '../../../logging/log-engine';
import { resolveProxyGpuEncoder } from './ffmpeg-full';
import { studioMediaJobs } from './media-jobs';
import { getProxyBuildEncoder, type ProxyBuildEncoder } from './proxy-build-encoders';

const log = logEngine.createLogger('StudioProxyGpuRebuild');

export type ProxyJobState = 'running' | 'queued' | 'none';
export type ProxyGpuRebuildAction = 'restart' | 'rebuild' | 'skip';

/**
 * Pure: what to do with one asset's proxy now that the GPU encoder resolves.
 * Only builds KNOWN to be on x264 this session move: a running one restarts,
 * a finished one is rebuilt. A queued job, a GPU build, a build that has not
 * resolved its encoder yet, and a proxy from an earlier session stay as they are.
 */
export function planProxyGpuRebuild(job: ProxyJobState, encoder: ProxyBuildEncoder | undefined): ProxyGpuRebuildAction {
  if (job === 'queued' || encoder !== 'x264') return 'skip';
  return job === 'running' ? 'restart' : 'rebuild';
}

export interface ProxyGpuRebuildResult {
  restarted: string[];
  rebuilt: string[];
}

export async function rebuildProxiesOnGpu(
  projectId: string,
  assets: ReadonlyArray<{ assetId: string; path: string }>,
): Promise<ProxyGpuRebuildResult> {
  const result: ProxyGpuRebuildResult = { restarted: [], rebuilt: [] };
  // The same resolution the next build makes: off by choice, latched after a
  // GPU failure, or not installed/working → leave every x264 proxy alone.
  const gpu = await resolveProxyGpuEncoder();
  if (!gpu) return result;
  for (const asset of assets) {
    const action = planProxyGpuRebuild(
      studioMediaJobs.jobState(projectId, asset.assetId, 'proxy'),
      getProxyBuildEncoder(projectId, asset.assetId),
    );
    if (action === 'skip') continue;
    await studioMediaJobs.restart(projectId, asset.assetId, 'proxy', asset.path);
    (action === 'restart' ? result.restarted : result.rebuilt).push(asset.assetId);
  }
  log.info('Proxies re-queued on the GPU encoder', { projectId, encoder: gpu.encoder, ...result });
  return result;
}
