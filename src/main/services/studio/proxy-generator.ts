import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { getProjectCacheDir } from './studio-paths';
import { getFfmpegBinary, runFfmpeg } from './ffmpeg-bin';
import { probeMedia } from './media-import';
import { planConcatEntries, readTiming, videoOffsetSec } from './proxy-concat';
import { detectDecodeArgs } from './proxy-hwaccel';
import {
  AUDIO_FILE,
  CONCAT_LIST_FILE,
  PLAN_FILE,
  SEGMENT_SECONDS,
  concatListText,
  createProxyProgress,
  isManifestReusable,
  planSegments,
  type ProxySegment,
  type SegmentPlanManifest,
} from './proxy-segments';

const log = logEngine.createLogger('StudioProxy');

export const PROXY_DIR = 'proxies';

/**
 * Proxy profile — chosen by measurement, T3 in docs/PREVIEW_TESTS_PLAN.md
 * (2026-09-02). Proxies exist to be *scrubbed*, and a seek decodes from the
 * previous keyframe: all-intra (`-g 1`) at 540p took a 15-frame fling from
 * 32 ms to 25 ms per step (31 → 41 steps/s) against the previous 720p GOP-15
 * profile, and encodes 12% faster, at 2.6× the disk (~23 MB per minute of
 * 4K60 source). Natural scrub and playback were vsync-bound on every variant.
 * The two things that did NOT pay: all-intra at 720p (worse tail, 4.2× disk)
 * and MJPEG (Chromium's <video> will not play it at all).
 */
const PROXY_HEIGHT = 540;
const PROXY_GOP = 1;
const PROXY_CRF = 28;

/**
 * Tag for the segment-folder manifest. Bump whenever the encoder args change:
 * leftover segments from an older profile must be discarded, not concatenated
 * into a proxy that is half one codec and half another.
 */
const PROXY_PROFILE = `x264-${PROXY_HEIGHT}p-g${PROXY_GOP}-crf${PROXY_CRF}`;

/**
 * libx264 only. The bundled ffmpeg is Remotion's stripped build and has no
 * hardware encoders at all (`-encoders` lists none — see
 * docs/hardware-video-encoding-windows.md), so an NVENC attempt can only ever
 * fail; the old try-NVENC-first branch cost one doomed spawn per session.
 */
function encoderArgs(): string[] {
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(PROXY_CRF), '-g', String(PROXY_GOP)];
}

/**
 * Hardware *decode* of the input (d3d11va on Windows, adapter chosen by
 * proxy-hwaccel.ts). The frames come back to system memory —
 * `-hwaccel_output_format` is deliberately not set, because the `scale` filter
 * needs them there. Sticky-off once a segment fails with it: hwaccel
 * availability is per machine and per codec, exactly like NVENC was.
 */
let hwaccelUnavailable = false;

const COMMON_ARGS = ['-hide_banner', '-nostdin', '-progress', 'pipe:1', '-nostats'];

/**
 * Video-only transcode of one window: frames with source pts in
 * [start, start + duration). `-ss` (input) discards decoded frames before
 * the start; `-to` (output, absolute because of `-copyts`) stops at decoded
 * frames past the end — both edges judged on the same decoded-frame pts.
 * Measured alternatives that were NOT exact: an output-side `-t` (let a
 * boundary frame into the earlier window at some joins) and an input-side
 * `-t` (packet-based, so a B-frame source leaked a duplicate frame at 5 of
 * 10 joins on the video-2 master). `-copyts` keeps source pts on every
 * frame, which is what lets the join be exact.
 */
function segmentArgs(sourcePath: string, segment: ProxySegment, outputPath: string, hwaccelArgs: string[]): string[] {
  return [
    ...COMMON_ARGS,
    ...hwaccelArgs,
    ...(segment.startSec > 0 ? ['-ss', String(segment.startSec)] : []),
    '-i',
    sourcePath,
    ...(segment.durationSec !== null ? ['-to', String(segment.startSec + segment.durationSec)] : []),
    // The first video stream only: camera files carry data tracks and, on
    // DJI, a second thumbnail-sized video stream.
    '-map',
    '0:v:0',
    '-copyts',
    '-an',
    // Never upscale: min() keeps small sources at their native height.
    '-vf',
    `scale=-2:min(${PROXY_HEIGHT}\\,ih)`,
    ...encoderArgs(),
    '-pix_fmt',
    'yuv420p',
    '-y',
    outputPath,
  ];
}

/** The whole audio track in one pass — AAC is cheap, and a single encode has
 *  no priming gaps at window joins the way per-segment audio would. */
function audioArgs(sourcePath: string, outputPath: string): string[] {
  return [...COMMON_ARGS, '-i', sourcePath, '-map', '0:a:0', '-vn', '-c:a', 'aac', '-b:a', '128k', '-y', outputPath];
}

/** Stream-copy join: no re-encode, so this is I/O-bound and takes seconds. */
function concatArgs(listPath: string, audioPath: string | null, videoOffset: number, outputPath: string): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    ...(videoOffset !== 0 ? ['-itsoffset', String(videoOffset)] : []),
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    ...(audioPath ? ['-i', audioPath, '-map', '0:v:0', '-map', '1:a:0'] : ['-map', '0:v:0']),
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    '-y',
    outputPath,
  ];
}

/** Cache-relative path of an asset's proxy (forward slashes — it goes in the document). */
export function proxyRelPath(assetId: string): string {
  return `${PROXY_DIR}/${assetId}.mp4`;
}

/** Segment folder for an asset, beside its final proxy. Exists only mid-job. */
function segmentDirFor(cacheDir: string, assetId: string): string {
  return path.join(cacheDir, PROXY_DIR, assetId);
}

/** `-progress pipe:1` emits `out_time_us=…` lines; turn them into seconds. */
function createOutTimeParser(onSeconds: (sec: number) => void) {
  let buf = '';
  return (chunk: Buffer): void => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const m = /^out_time_us=(\d+)/.exec(line.trim());
      if (m) onSeconds(Number(m[1]) / 1e6);
    }
  };
}

/**
 * In-flight output name. Carries our pid so a hard-killed app's orphaned ffmpeg
 * (Windows does not kill children with the parent) keeps writing *its* file
 * while the relaunched app writes a fresh one, instead of the two colliding.
 */
function partPathFor(finalPath: string): string {
  return `${finalPath}.${process.pid}.part.mp4`;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Bring the segment folder to a known state: reuse it when its manifest says
 * it was built for this exact source and profile, otherwise start clean.
 */
async function prepareSegmentDir(dir: string, manifest: SegmentPlanManifest): Promise<void> {
  let reusable = false;
  try {
    reusable = isManifestReusable(JSON.parse(await fs.readFile(path.join(dir, PLAN_FILE), 'utf-8')), manifest);
  } catch {
    // No manifest or unreadable — treat as foreign.
  }
  if (!reusable) {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, PLAN_FILE), JSON.stringify(manifest), 'utf-8');
    return;
  }
  // Leftover .part files are from a killed ffmpeg and have no moov atom.
  // Best effort: one still held open by an orphaned ffmpeg cannot be removed
  // on Windows, and must not fail the job — our own part names never collide.
  for (const name of await fs.readdir(dir)) {
    if (name.endsWith('.part.mp4')) await fs.rm(path.join(dir, name), { force: true }).catch(() => {});
  }
}

/**
 * Transcode the all-intra 540p H.264 proxy the editor previews. Originals are never
 * touched — the export re-points the same composition at them.
 *
 * Built in ~60 s windows into `proxies/<assetId>/`, each window renamed into
 * place only after a clean ffmpeg exit, then stream-copied into the final
 * `proxies/<assetId>.mp4`. A kill mid-job costs at most the window in flight:
 * the next run skips every finished segment. The document contract (one
 * cache-relative .mp4 path) is unchanged; nothing downstream sees segments.
 */
export async function generateProxy(
  projectId: string,
  assetId: string,
  sourcePath: string,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const cacheDir = await getProjectCacheDir(projectId);
  const relPath = proxyRelPath(assetId);
  const outputPath = path.join(cacheDir, PROXY_DIR, `${assetId}.mp4`);
  const segDir = segmentDirFor(cacheDir, assetId);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const [ffmpeg, ffprobe, probe, sourceStat] = await Promise.all([
    getFfmpegBinary('ffmpeg'),
    getFfmpegBinary('ffprobe'),
    probeMedia(sourcePath, 'video'),
    fs.stat(sourcePath),
  ]);
  const hwaccelArgs = hwaccelUnavailable ? [] : await detectDecodeArgs(ffmpeg);
  const totalSec = probe.duration;
  const plan = planSegments(totalSec);
  await prepareSegmentDir(segDir, {
    version: 1,
    profile: PROXY_PROFILE,
    windowSec: SEGMENT_SECONDS,
    sourceBytes: sourceStat.size,
    sourceMtimeMs: Math.round(sourceStat.mtimeMs),
    segmentCount: plan.length,
  });

  const progress = createProxyProgress(plan, totalSec, probe.hasAudio, onProgress ?? (() => {}));
  const throwIfAborted = () => {
    if (signal?.aborted) throw new Error('Cancelled');
  };

  // 1. Video windows — skip the ones an earlier run already finished.
  let resumed = 0;
  for (const segment of plan) {
    throwIfAborted();
    const finalPath = path.join(segDir, segment.fileName);
    if (await exists(finalPath)) {
      resumed++;
      progress.segmentDone(segment);
      continue;
    }
    const partPath = partPathFor(finalPath);
    const onStdout = createOutTimeParser((sec) => progress.segmentTick(segment, sec));
    const run = (useHwaccel: boolean) =>
      runFfmpeg(ffmpeg, segmentArgs(sourcePath, segment, partPath, useHwaccel ? hwaccelArgs : []), {
        signal,
        // Below-normal priority: proxies are background work and must never
        // make the editor stutter, however many cores ffmpeg decides to use.
        priority: 'below-normal',
        onStdout,
      });
    try {
      if (hwaccelUnavailable || hwaccelArgs.length === 0) {
        await run(false);
      } else {
        try {
          await run(true);
        } catch (err) {
          if (signal?.aborted) throw err;
          hwaccelUnavailable = true;
          log.info('Hardware decode unavailable for proxies, falling back to software', {
            error: err instanceof Error ? err.message.slice(0, 200) : String(err),
          });
          await run(false);
        }
      }
      await fs.rename(partPath, finalPath);
    } catch (err) {
      await fs.rm(partPath, { force: true }).catch(() => {});
      throw err;
    }
    progress.segmentDone(segment);
  }
  if (resumed > 0) {
    log.info('Resumed proxy from finished segments', { assetId, resumed, total: plan.length });
  }

  // 2. Audio, once, resumable the same way.
  const audioPath = probe.hasAudio ? path.join(segDir, AUDIO_FILE) : null;
  if (audioPath && !(await exists(audioPath))) {
    throwIfAborted();
    const partPath = partPathFor(audioPath);
    try {
      await runFfmpeg(ffmpeg, audioArgs(sourcePath, partPath), {
        signal,
        priority: 'below-normal',
        onStdout: createOutTimeParser((sec) => progress.audioTick(sec)),
      });
      await fs.rename(partPath, audioPath);
    } catch (err) {
      await fs.rm(partPath, { force: true }).catch(() => {});
      throw err;
    }
  }
  progress.audioDone();

  // 3. Join. Each segment's real span comes from its own header (they carry
  //    source timestamps), and the list names them relative to its own folder.
  throwIfAborted();
  const [sourceTiming, ...segmentTimings] = await Promise.all([
    readTiming(ffprobe, sourcePath),
    ...plan.map((s) => readTiming(ffprobe, path.join(segDir, s.fileName))),
  ]);
  const listPath = path.join(segDir, CONCAT_LIST_FILE);
  await fs.writeFile(listPath, concatListText(planConcatEntries(plan, segmentTimings)), 'utf-8');
  const outPart = partPathFor(outputPath);
  try {
    await runFfmpeg(ffmpeg, concatArgs(listPath, audioPath, videoOffsetSec(sourceTiming), outPart), {
      signal,
      priority: 'below-normal',
    });
    // Rename only after a clean exit so a killed ffmpeg can't leave a
    // half-written proxy that later looks "ready".
    await fs.rename(outPart, outputPath);
  } catch (err) {
    await fs.rm(outPart, { force: true }).catch(() => {});
    throw err;
  }
  progress.concatDone();

  // The segments have served their purpose; the proxy is the durable artefact.
  await fs.rm(segDir, { recursive: true, force: true }).catch(() => {});
  return relPath;
}
