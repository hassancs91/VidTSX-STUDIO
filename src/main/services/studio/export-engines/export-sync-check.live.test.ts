// Live T8 check against the A5 video-14 exports (END_TO_END_PLAN A6 exit:
// "the A5 files pass; a file offset by 100 ms on purpose fails") — skipped
// unless VIDTSX_LIVE_SYNC=1. Needs .vidtsx-temp/end-to-end/A5/export/*.mp4,
// the preserved export context in .vidtsx-temp/end-to-end/A6/a5-contexts/ and
// the read-only video-14 master. Reports go to .vidtsx-temp/end-to-end/A6/reports/;
// the 100 ms audio file and the 3-frame video file are made there with a
// stream copy (never beside the A5 files).
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { StudioExportContext } from './export-context';
import { runFfmpeg } from '../ffmpeg-bin';
import { checkExportSync } from './export-sync-check';
import { cropScaleFilter, exactFrameSeek, thumbSize } from './sync-measure';
import { grabGrayFrames } from './sync-media';

const LIVE = process.env.VIDTSX_LIVE_SYNC === '1';
const REPO = path.resolve(__dirname, '../../../../..');
const BIN = path.join(REPO, 'node_modules', '@remotion', 'compositor-win32-x64-msvc');
const FFMPEG = path.join(BIN, 'ffmpeg.exe');
const FFPROBE = path.join(BIN, 'ffprobe.exe');
const A5 = path.join(REPO, '.vidtsx-temp', 'end-to-end', 'A5', 'export');
const A6 = path.join(REPO, '.vidtsx-temp', 'end-to-end', 'A6');
const CONTEXT = path.join(A6, 'a5-contexts', 'studio-entry-video-14-4650cc99.tsx.json');
const REPORTS = path.join(A6, 'reports');
const STANDARD = path.join(A5, 'studio-video-14_2026-10-21T21-30-54.mp4');
const FASTEST = path.join(A5, 'studio-video-14_2026-10-21T21-10-24.mp4');
const OFFSET = path.join(REPORTS, 'standard-audio-plus-100ms.mp4');
const VIDEO_LATE = path.join(REPORTS, 'standard-video-plus-3-frames.mp4');
const MASTER = 'D:/repos/claude-youtube-editor/videos/video-14/output/master-tight-h264.mp4';

async function project() {
  const context = JSON.parse(await fs.readFile(CONTEXT, 'utf-8')) as StudioExportContext;
  return context.project;
}

async function check(file: string, name: string) {
  const { report, reportPath } = await checkExportSync({
    exportPath: file,
    project: await project(),
    reportPath: path.join(REPORTS, `${name}.sync.json`),
    ffmpeg: FFMPEG,
    ffprobe: FFPROBE,
  });
  const v = report.verdict;
  const statuses = report.probes.map((p) => `${p.t.toFixed(2)}:${p.status}${p.errorMs === null ? '' : `(${p.errorMs})`} a${p.audio?.quality ?? '-'} v${p.video?.quality ?? '-'} (plain ${p.video?.plainQuality ?? '-'}, mask ${p.video?.maskShare ?? '-'})`);
  console.log(`[${name}] ${v.verdict} offset=${v.offsetMs} drift=${v.driftOverSpanMs} span=${v.spanSec} ${v.confident}/${v.attempted} ${report.elapsedMs} ms\n  ${v.message}\n  ${statuses.join('\n  ')}\n  → ${reportPath}`);
  return report;
}

describe.skipIf(!LIVE)('export sync check (live, video-14 A5 exports)', () => {
  it('passes the A5 Standard export', async () => {
    await fs.mkdir(REPORTS, { recursive: true });
    const report = await check(STANDARD, 'a5-standard');
    expect(report.verdict.verdict).toBe('pass');
  }, 600_000);

  it('passes the A5 Fastest export', async () => {
    const report = await check(FASTEST, 'a5-fastest');
    expect(report.verdict.verdict).toBe('pass');
  }, 600_000);

  it('fails the Standard export with its audio delayed 100 ms', async () => {
    if (!fsSync.existsSync(OFFSET)) {
      await runFfmpeg(FFMPEG, ['-v', 'error', '-nostdin', '-y', '-i', STANDARD, '-itsoffset', '0.1', '-i', STANDARD, '-map', '0:v', '-map', '1:a', '-c', 'copy', OFFSET]);
    }
    const report = await check(OFFSET, 'standard-audio-plus-100ms');
    expect(report.verdict.verdict).toBe('fail');
    expect(Math.abs((report.verdict.offsetMs ?? 0) - 100)).toBeLessThan(25);
  }, 600_000);

  // The layout mask is learned from the data, so prove the FRAME side
  // discriminates on its own: the picture 3 frames (50 ms at 60 fps) late,
  // audio untouched → the picture shows earlier camera time than the sound →
  // error ≈ −50 ms ("audio AHEAD"), with the mask in use.
  it('fails the Standard export with its video delayed 3 frames', async () => {
    if (!fsSync.existsSync(VIDEO_LATE)) {
      await runFfmpeg(FFMPEG, ['-v', 'error', '-nostdin', '-y', '-itsoffset', '0.05', '-i', STANDARD, '-i', STANDARD, '-map', '0:v', '-map', '1:a', '-c', 'copy', VIDEO_LATE]);
    }
    const report = await check(VIDEO_LATE, 'standard-video-plus-3-frames');
    expect(report.verdict.verdict).toBe('fail');
    expect(Math.abs((report.verdict.offsetMs ?? 0) + 50)).toBeLessThan(25);
    expect(report.probes.some((p) => p.video?.maskShare !== null && p.video?.maskShare !== undefined)).toBe(true);
  }, 600_000);

  // A6 verifier round 1: at this seek the old read emitted the first frame twice
  // ([5415, 5415, 5416, 5417]) and the label first + index was one frame late.
  it('reads a camera window at the seek that used to repeat its first frame as 5415..5418', async () => {
    const fps = 60000 / 1001;
    const thumb = thumbSize({ width: 2700, height: 2160 });
    const { frames, times } = await grabGrayFrames(
      FFMPEG, MASTER, exactFrameSeek(5415, fps), 4, cropScaleFilter({ x: 2, y: 0, width: 2700, height: 2160 }, thumb), thumb,
    );
    expect(times.map((t) => Math.round(t.sec * fps))).toEqual([5415, 5416, 5417, 5418]);
    expect(Buffer.from(frames[0]).equals(Buffer.from(frames[1]))).toBe(false);
  }, 120_000);

  // The verifier's own files (copied from A6-verify/neg into A6/neg). Truth: + = audio behind the picture.
  const NEGATIVES: Array<[string, number]> = [
    ['std-audio-early-27ms', -27], ['std-audio-early-30ms', -30], ['std-audio-early-33ms', -33], ['std-audio-early-80ms', -80],
    ['std-audio-early-600ms', -600], ['std-audio-late-10ms', 10], ['std-video-late-2f', -2000 / 60],
  ];
  for (const [name, truth] of NEGATIVES) {
    it.skipIf(!fsSync.existsSync(path.join(A6, 'neg', `${name}.mp4`)))(`judges ${name} by the truth (${truth.toFixed(1)} ms)`, async () => {
      const report = await check(path.join(A6, 'neg', `${name}.mp4`), name);
      expect(report.verdict.verdict).toBe(Math.abs(truth) < 25 ? 'pass' : 'fail');
      expect(Math.abs((report.verdict.offsetMs ?? 9999) - truth)).toBeLessThan(6);
    }, 600_000);
  }
});
