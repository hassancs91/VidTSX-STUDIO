/**
 * The pure half of segmented proxy generation: how a source is cut into
 * windows, what the pieces are called, which pieces still need doing, and how
 * per-piece progress adds up to one honest percent. No ffmpeg, no fs — the
 * orchestration in proxy-generator.ts owns those, and this stays unit-testable.
 *
 * Why segments at all: a killed ffmpeg leaves an mp4 with no moov atom, so a
 * half-written proxy is unreadable and "continue the .part" is impossible.
 * Cutting the job into fixed windows makes each finished window durable, and
 * a restart re-does at most the one that was in flight.
 */

/** Fixed window each segment covers, in source seconds. */
export const SEGMENT_SECONDS = 60;

/** A remainder shorter than this is folded into the previous window rather
 *  than becoming a stub segment of its own. */
const MIN_TAIL_SECONDS = 10;

/** Work-unit weight of one second of audio against one second of video: the
 *  AAC pass is a small fraction of the transcode and the bar should say so. */
const AUDIO_WEIGHT = 0.05;
/** The concat (stream copy) at the end, as a share of the total. */
const CONCAT_WEIGHT = 0.01;

export const AUDIO_FILE = 'audio.mp4';
export const PLAN_FILE = 'plan.json';
export const CONCAT_LIST_FILE = 'concat.txt';

export interface ProxySegment {
  index: number;
  /** Source time the window starts at. */
  startSec: number;
  /** Seconds it covers, or null for the final window — that one runs to the
   *  end of the source so no trailing frame is lost to rounding. */
  durationSec: number | null;
  fileName: string;
}

export function segmentFileName(index: number): string {
  return `seg-${String(index).padStart(4, '0')}.mp4`;
}

/**
 * Cut `totalSec` of source into windows. An unknown duration (0 or NaN) gets a
 * single open-ended segment, which is exactly the old single-pass behaviour.
 */
export function planSegments(totalSec: number, windowSec: number = SEGMENT_SECONDS): ProxySegment[] {
  if (!(totalSec > 0) || !(windowSec > 0)) {
    return [{ index: 0, startSec: 0, durationSec: null, fileName: segmentFileName(0) }];
  }
  let count = Math.max(1, Math.ceil(totalSec / windowSec));
  if (count > 1 && totalSec - (count - 1) * windowSec < MIN_TAIL_SECONDS) count -= 1;
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    startSec: i * windowSec,
    durationSec: i === count - 1 ? null : windowSec,
    fileName: segmentFileName(i),
  }));
}

/** Seconds a segment covers, resolving the open-ended final window. */
export function segmentSeconds(segment: ProxySegment, totalSec: number): number {
  if (segment.durationSec !== null) return segment.durationSec;
  return Math.max(0, totalSec - segment.startSec);
}

/** The segments whose files are not on disk yet — resume is just this. */
export function pendingSegments(plan: ProxySegment[], existingFiles: Iterable<string>): ProxySegment[] {
  const have = new Set(existingFiles);
  return plan.filter((s) => !have.has(s.fileName));
}

/**
 * What a segment folder was built for. Written before the first segment and
 * checked on resume: leftovers from a different source file, window size or
 * encoder profile must be thrown away, not concatenated.
 */
export interface SegmentPlanManifest {
  version: 1;
  /** Encoder profile tag — bump it whenever the ffmpeg args change. */
  profile: string;
  windowSec: number;
  sourceBytes: number;
  sourceMtimeMs: number;
  segmentCount: number;
}

export function isManifestReusable(existing: unknown, expected: SegmentPlanManifest): boolean {
  if (typeof existing !== 'object' || existing === null) return false;
  const e = existing as Record<string, unknown>;
  return (
    e.version === expected.version &&
    e.profile === expected.profile &&
    e.windowSec === expected.windowSec &&
    e.sourceBytes === expected.sourceBytes &&
    e.sourceMtimeMs === expected.sourceMtimeMs &&
    e.segmentCount === expected.segmentCount
  );
}

/**
 * Body of the concat demuxer's list file. Names are relative to the list's own
 * folder (the demuxer resolves them there), which keeps Windows paths and
 * spaces out of it entirely; the only escaping the format needs is the quote.
 * Each entry carries an explicit duration — see proxy-concat.ts for why the
 * container's own duration is not trusted.
 */
export function concatListText(entries: { fileName: string; durationSec: number }[]): string {
  return (
    entries
      .map((e) => `file '${e.fileName.replace(/'/g, "'\\''")}'\nduration ${e.durationSec.toFixed(6)}`)
      .join('\n') + '\n'
  );
}

export interface ProxyProgress {
  /** A segment already on disk from an earlier run, or just finished. */
  segmentDone(segment: ProxySegment): void;
  /** ffmpeg's out_time for the segment in flight, in seconds from its start. */
  segmentTick(segment: ProxySegment, outSec: number): void;
  audioTick(outSec: number): void;
  audioDone(): void;
  concatDone(): void;
}

/**
 * One percent across every piece of the job. Finished segments count in full,
 * the one in flight by its own ffmpeg progress, audio at a small weight, and
 * the final concat as the last 1%. The number never goes backwards — a
 * restarted segment reports from 0 again, and the bar must not.
 */
export function createProxyProgress(
  plan: ProxySegment[],
  totalSec: number,
  hasAudio: boolean,
  onPercent: (percent: number) => void,
): ProxyProgress {
  const videoUnits = plan.reduce((sum, s) => sum + segmentSeconds(s, totalSec), 0);
  const audioUnits = hasAudio ? totalSec * AUDIO_WEIGHT : 0;
  const workUnits = videoUnits + audioUnits;
  const totalUnits = workUnits / (1 - CONCAT_WEIGHT);
  const concatUnits = totalUnits - workUnits;

  const done = new Set<number>();
  let doneUnits = 0;
  let inFlightUnits = 0;
  let audioDoneUnits = 0;
  let concat = 0;
  let last = -1;

  const emit = () => {
    if (totalUnits <= 0) return;
    const units = doneUnits + inFlightUnits + audioDoneUnits + concat;
    const percent = Math.min(100, (units / totalUnits) * 100);
    if (percent <= last) return;
    last = percent;
    onPercent(percent);
  };

  return {
    segmentDone(segment) {
      if (done.has(segment.index)) return;
      done.add(segment.index);
      doneUnits += segmentSeconds(segment, totalSec);
      inFlightUnits = 0;
      emit();
    },
    segmentTick(segment, outSec) {
      if (done.has(segment.index)) return;
      const cap = segmentSeconds(segment, totalSec);
      inFlightUnits = Math.max(0, Math.min(cap, outSec));
      emit();
    },
    audioTick(outSec) {
      if (!hasAudio) return;
      audioDoneUnits = Math.max(0, Math.min(audioUnits, outSec * AUDIO_WEIGHT));
      emit();
    },
    audioDone() {
      audioDoneUnits = audioUnits;
      emit();
    },
    concatDone() {
      concat = concatUnits;
      // Everything is accounted for; land exactly on 100.
      doneUnits = videoUnits;
      inFlightUnits = 0;
      audioDoneUnits = audioUnits;
      emit();
    },
  };
}
