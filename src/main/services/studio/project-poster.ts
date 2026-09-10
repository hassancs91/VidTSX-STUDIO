import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { logEngine } from '../../../logging/log-engine';
import type { StudioProject } from '../../../shared/types/studio';
import { getFfmpegBinary } from './ffmpeg-bin';
import { getProjectCacheDir } from './studio-paths';
import { loadProject } from './project-store';
import { POSTER_REL_PATH } from './project-poster-paths';
import { pickPosterSource, posterSignature, type PosterSource } from './project-poster-pick';

// Project posters (V1 completion plan §2.6): one JPEG per project, written
// from the save handler (debounced) and when the editor closes the project.
// Never on a listing or on Home — the lazy-engine rule: reading stores spawns
// nothing.

const log = logEngine.createLogger('StudioProjectPoster');

export { POSTER_REL_PATH };
/** Trailing debounce after a save; the editor saves every ~600 ms of edits. */
export const POSTER_DEBOUNCE_MS = 4_000;
const POSTER_WIDTH = 480;
const FFMPEG_TIMEOUT_MS = 30_000;

/** The poster exists on disk (the listing's `posterPath` check). */
export async function hasProjectPoster(projectId: string): Promise<boolean> {
  try {
    await fs.access(path.join(await getProjectCacheDir(projectId), POSTER_REL_PATH));
    return true;
  } catch {
    return false;
  }
}

/** Proxy when it is ready and still on disk, else the original — the first
 *  file that exists wins; null when neither does (a relinked-away asset). */
async function resolveSourceFile(projectId: string, source: PosterSource): Promise<string | null> {
  const candidates: string[] = [];
  if (source.asset.proxy?.status === 'ready') {
    candidates.push(path.join(await getProjectCacheDir(projectId), source.asset.proxy.path));
  }
  candidates.push(source.asset.path);
  for (const file of candidates) {
    try {
      await fs.access(file);
      return file;
    } catch {
      /* try the next */
    }
  }
  return null;
}

async function extractFrame(sourceFile: string, sourceTime: number, outputPath: string): Promise<void> {
  const ffmpeg = await getFfmpegBinary('ffmpeg');
  // Same extension so ffmpeg picks the JPEG muxer; renamed over the real file
  // so a reader never sees a half-written poster.
  const tmpPath = `${outputPath.slice(0, -'.jpg'.length)}.tmp.jpg`;
  const args = [
    '-ss', sourceTime.toFixed(3),
    '-i', sourceFile,
    '-frames:v', '1',
    '-vf', `scale=${POSTER_WIDTH}:-2`,
    '-q:v', '4',
    '-y', tmpPath,
  ];
  await new Promise<void>((resolve, reject) => {
    execFile(ffmpeg, args, { timeout: FFMPEG_TIMEOUT_MS }, (error) => (error ? reject(error) : resolve()));
  });
  await fs.rename(tmpPath, outputPath);
}

// One signature per project: a save that moved nothing the poster depends on
// costs nothing. In-memory only — the first save after a launch regenerates
// once, which is one ffmpeg frame.
const lastSignature = new Map<string, string>();

/**
 * Write (or remove) the project's poster from its current document. Never
 * throws — a poster problem must not fail a save.
 */
export async function writeProjectPoster(project: StudioProject): Promise<string | null> {
  try {
    const source = pickPosterSource(project);
    const sourceFile = source ? await resolveSourceFile(project.id, source) : null;
    const signature = posterSignature(source, sourceFile);
    const outputPath = path.join(await getProjectCacheDir(project.id), POSTER_REL_PATH);
    if (!source || !sourceFile) {
      // No video: no file, so the card falls back to the placeholder.
      await fs.rm(outputPath, { force: true });
      lastSignature.set(project.id, signature);
      return null;
    }
    if (lastSignature.get(project.id) === signature && (await hasProjectPoster(project.id))) {
      return POSTER_REL_PATH;
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await extractFrame(sourceFile, source.sourceTime, outputPath);
    lastSignature.set(project.id, signature);
    log.info('Poster written', { projectId: project.id, sourceTime: source.sourceTime });
    return POSTER_REL_PATH;
  } catch (err) {
    log.warn('Poster generation failed', {
      projectId: project.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// Per-project trailing debounce, with one run in flight at a time; a request
// that lands mid-run queues exactly one more run.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Map<string, Promise<void>>();
const rerun = new Set<string>();

async function runFor(project: StudioProject): Promise<void> {
  const id = project.id;
  const running = inFlight.get(id);
  if (running) {
    rerun.add(id);
    return running;
  }
  const job = (async () => {
    await writeProjectPoster(project);
    inFlight.delete(id);
    if (rerun.delete(id)) {
      // The document may have moved on — re-read it rather than reuse ours.
      const latest = await loadProject(id).catch(() => null);
      if (latest) await runFor(latest);
    }
  })();
  inFlight.set(id, job);
  return job;
}

/** Called by the save handler: the poster refreshes once the edits settle. */
export function scheduleProjectPoster(project: StudioProject): void {
  const existing = timers.get(project.id);
  if (existing) clearTimeout(existing);
  timers.set(
    project.id,
    setTimeout(() => {
      timers.delete(project.id);
      void runFor(project);
    }, POSTER_DEBOUNCE_MS),
  );
}

/** Called when the editor closes a project: cancel the debounce, write now. */
export async function flushProjectPoster(projectId: string): Promise<void> {
  const existing = timers.get(projectId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(projectId);
  }
  const project = await loadProject(projectId).catch(() => null);
  if (project) await runFor(project);
}
