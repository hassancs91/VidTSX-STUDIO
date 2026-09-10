import { describe, expect, it, vi } from 'vitest';

vi.mock('../ffmpeg-bin', () => ({
  getFfmpegBinary: async () => 'ffmpeg',
  runFfmpeg: async () => undefined,
}));

import { AAC_ENCODE_ARGS, MOOV_TOO_SMALL, aacEncodeArgs, aacFrameCount, colorMismatch, colorTagArgs, finishMuxArgs, reservedMoovBytes, videoInputArgs } from './finishing';
import { EXPORT_COLOR } from './types';

const good = { codec: 'h264', pixFmt: 'yuv420p', range: 'tv', matrix: 'bt709', primaries: 'bt709', transfer: 'bt709' };

describe('finishing stage colour policy (D7)', () => {
  it('accepts yuv420p tv bt709 and nothing else', () => {
    expect(colorMismatch(good, EXPORT_COLOR)).toBeNull();
    // Remotion's default tags — what every export carried before the seam.
    expect(colorMismatch({ ...good, pixFmt: 'yuvj420p', range: 'pc', matrix: 'bt470bg' }, EXPORT_COLOR)).toMatch(/pixel format is yuvj420p/);
    expect(colorMismatch({ ...good, range: 'pc' }, EXPORT_COLOR)).toMatch(/colour range is pc/);
    expect(colorMismatch({ ...good, matrix: undefined }, EXPORT_COLOR)).toMatch(/matrix is untagged/);
    expect(colorMismatch({ ...good, transfer: 'smpte170m' }, EXPORT_COLOR)).toMatch(/transfer is smpte170m/);
    expect(colorMismatch(undefined, EXPORT_COLOR)).toBe('no video stream');
  });

  it('carries the policy into the container as ffmpeg flags', () => {
    expect(colorTagArgs(EXPORT_COLOR)).toEqual([
      '-color_range', 'tv',
      '-colorspace', 'bt709',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
    ]);
  });
});

describe('finishing mux (D7, Stage 4)', () => {
  const tags = ['-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];

  it('encodes PCM audio with Remotion\'s settings in the mux', () => {
    expect(finishMuxArgs({ videoPath: 'v.mp4', audioPath: 'a.wav', audio: 'encode', outputPath: 'out.mp4', color: EXPORT_COLOR })).toEqual([
      '-y', '-hide_banner', '-nostdin',
      '-i', 'v.mp4', '-i', 'a.wav', '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', ...tags,
      '-c:a', 'aac', '-b:a', '320k', '-cutoff', '18000',
      '-map_metadata', '-1', '-movflags', '+faststart', 'out.mp4',
    ]);
  });

  it('copies audio an engine already encoded with the same settings', () => {
    expect(finishMuxArgs({ videoPath: 'v.mp4', audioPath: 'a.m4a', audio: 'copy', outputPath: 'out.mp4', color: EXPORT_COLOR })).toContain('-c:a');
    const args = finishMuxArgs({ videoPath: 'v.mp4', audioPath: 'a.m4a', audio: 'copy', outputPath: 'out.mp4', color: EXPORT_COLOR });
    expect(args.slice(args.indexOf('-c:a'), args.indexOf('-c:a') + 2)).toEqual(['-c:a', 'copy']);
    expect(args).not.toContain('aac');
  });

  it('joins the passthrough\'s pieces from their concat list in the same write as the mux (Stage 4)', () => {
    expect(videoInputArgs('v.mp4')).toEqual(['-i', 'v.mp4']);
    expect(videoInputArgs('spans.txt', 'concat')).toEqual(['-f', 'concat', '-safe', '0', '-i', 'spans.txt']);
    const args = finishMuxArgs({ videoPath: 'spans.txt', videoDemuxer: 'concat', audioPath: 'a.m4a', audio: 'copy', outputPath: 'out.mp4', color: EXPORT_COLOR, moovBytes: 139424 });
    expect(args.join(' ')).toContain('-f concat -safe 0 -i spans.txt -i a.m4a -map 0:v:0 -map 1:a:0 -c:v copy ' + tags.join(' ') + ' -c:a copy -map_metadata -1 -moov_size 139424 out.mp4');
    // A silent timeline's list is its own audio source: one input, no audio track.
    const silent = finishMuxArgs({ videoPath: 'spans.txt', videoDemuxer: 'concat', audioPath: 'spans.txt', audio: 'none', outputPath: 'out.mp4', color: EXPORT_COLOR });
    expect(silent.filter((a) => a === '-i')).toHaveLength(1);
    expect(silent).toContain('-an');
  });

  it('writes no audio track for a silent timeline', () => {
    const args = finishMuxArgs({ videoPath: 'v.mp4', audioPath: 'v.mp4', audio: 'none', outputPath: 'out.mp4', color: EXPORT_COLOR });
    expect(args).toContain('-an');
    expect(args.filter((a) => a === '-i')).toHaveLength(1);
  });

  it('reserves the index at the front instead of the faststart pass, and falls back to it', () => {
    const reserved = finishMuxArgs({ videoPath: 'v.mp4', audioPath: 'a.m4a', audio: 'copy', outputPath: 'out.mp4', color: EXPORT_COLOR, moovBytes: 139360 });
    expect(reserved.slice(-3)).toEqual(['-moov_size', '139360', 'out.mp4']);
    expect(reserved).not.toContain('+faststart');
    const fallback = finishMuxArgs({ videoPath: 'v.mp4', audioPath: 'a.m4a', audio: 'copy', outputPath: 'out.mp4', color: EXPORT_COLOR });
    expect(fallback.slice(-3)).toEqual(['-movflags', '+faststart', 'out.mp4']);
    expect(MOOV_TOO_SMALL.test('ffmpeg exited with code 1: [mp4 @ 0x1] reserved_moov_size is too small, needed 4096 additional')).toBe(true);
  });

  it('sizes the reservation from the sample counts with 1.5× headroom over the measured index', () => {
    // The 3 h product: 330,749 video frames + 516,802 AAC frames needed 14,824,791 bytes.
    expect(aacFrameCount(11024.97, 48000)).toBe(516798);
    expect(reservedMoovBytes(330749, 516798)).toBe(27187040);
    // 30 s at 30 fps: 900 + 1,409 frames → 139 KB, of which the unused part becomes a `free` atom.
    expect(reservedMoovBytes(900, aacFrameCount(30, 48000))).toBe(139424);
  });

  it('the early AAC encode uses the very same settings as the mux', () => {
    expect(aacEncodeArgs('a.wav', 'a.m4a')).toEqual(['-y', '-hide_banner', '-nostdin', '-i', 'a.wav', '-vn', '-map', '0:a:0', ...AAC_ENCODE_ARGS, '-map_metadata', '-1', '-f', 'mp4', 'a.m4a']);
    expect(AAC_ENCODE_ARGS).toEqual(['-c:a', 'aac', '-b:a', '320k', '-cutoff', '18000']);
  });
});
