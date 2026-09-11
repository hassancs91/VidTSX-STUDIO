import { describe, expect, it } from 'vitest';
import {
  chooseProxyEncoder,
  encoderArgs,
  encoderProbeArgs,
  gpuSegmentPlan,
  parseHardwareEncoders,
} from './proxy-encoders';

const FULL_BUILD = `Encoders:
 V..... = Video
 A..... = Audio
 ------
 V....D av1_nvenc            NVIDIA NVENC av1 encoder (codec av1)
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D h264_amf             AMD AMF H.264 Encoder (codec h264)
 V....D h264_mf              H264 via MediaFoundation (codec h264)
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
 V..... h264_qsv             H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (Intel Quick Sync Video acceleration) (codec h264)
 V....D hevc_nvenc           NVIDIA NVENC hevc encoder (codec hevc)
 A....D aac                  AAC (Advanced Audio Coding)
`;

const BUNDLED_BUILD = `Encoders:
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D libx265              libx265 H.265 / HEVC (codec hevc)
 V..... mjpeg                MJPEG (Motion JPEG)
`;

describe('parseHardwareEncoders', () => {
  it('lists the H.264 hardware encoders of a full build in preference order', () => {
    expect(parseHardwareEncoders(FULL_BUILD)).toEqual(['nvenc', 'qsv', 'amf']);
  });

  it("finds none in Remotion's stripped build", () => {
    expect(parseHardwareEncoders(BUNDLED_BUILD)).toEqual([]);
  });

  it('ignores the HEVC/AV1 variants and audio lines', () => {
    const out = ' V....D hevc_nvenc  x\n A....D aac  y\n V....D av1_amf  z\n';
    expect(parseHardwareEncoders(out)).toEqual([]);
  });

  it('handles CRLF output from a Windows binary', () => {
    expect(parseHardwareEncoders(' V....D h264_qsv  x\r\n V....D h264_amf  y\r\n')).toEqual(['qsv', 'amf']);
  });
});

describe('chooseProxyEncoder', () => {
  it('prefers NVENC, then QSV, then AMF', () => {
    expect(chooseProxyEncoder(['amf', 'qsv', 'nvenc'])).toBe('nvenc');
    expect(chooseProxyEncoder(['amf', 'qsv'])).toBe('qsv');
    expect(chooseProxyEncoder(['amf'])).toBe('amf');
  });

  it('is null when nothing works', () => {
    expect(chooseProxyEncoder([])).toBeNull();
  });
});

describe('encoderArgs', () => {
  it('NVENC is intra-only via -g 0 with B-frames off, in constant-quality mode', () => {
    const args = encoderArgs('nvenc');
    expect(args).toContain('h264_nvenc');
    expect(args.slice(args.indexOf('-g'), args.indexOf('-g') + 2)).toEqual(['-g', '0']);
    expect(args.slice(args.indexOf('-bf'), args.indexOf('-bf') + 2)).toEqual(['-bf', '0']);
    expect(args.slice(args.indexOf('-cq'), args.indexOf('-cq') + 2)).toEqual(['-cq', '33']);
    expect(args).not.toContain('-crf');
  });

  it('QSV and AMF are all-intra with their own quality knobs', () => {
    expect(encoderArgs('qsv')).toEqual(expect.arrayContaining(['h264_qsv', '-global_quality', '-g', '1', '-bf', '0']));
    expect(encoderArgs('amf')).toEqual(expect.arrayContaining(['h264_amf', '-qp_i', '-qp_p', '-g', '1']));
  });
});

describe('encoderProbeArgs', () => {
  it('encodes two synthetic frames to the null muxer — no media, no output file', () => {
    const args = encoderProbeArgs('nvenc');
    expect(args).toEqual(expect.arrayContaining(['lavfi', '-frames:v', '2', 'h264_nvenc', 'null']));
    expect(args.at(-1)).toBe('-');
  });

  it('hands QSV and AMF nv12 frames (what `ffmpeg -h encoder=` says they accept); NVENC takes the source format', () => {
    expect(encoderProbeArgs('qsv').slice(-5)).toEqual(['-pix_fmt', 'nv12', '-f', 'null', '-']);
    expect(encoderProbeArgs('amf').slice(-5)).toEqual(['-pix_fmt', 'nv12', '-f', 'null', '-']);
    expect(encoderProbeArgs('nvenc')).not.toContain('-pix_fmt');
  });
});

// Item 3 (export-engines, 2026-09-11): the probe on the binary the app ships
// with — the LIST is the build's (all three vendors, whatever the machine),
// the WORKING set is the machine's (the two-frame encode decides it; on the
// dev laptop 2026-09-11: nvenc and qsv opened, amf failed with "DLL
// amfrt64.dll failed to open").
describe("the 8.1 build's -encoders lines", () => {
  const REAL_81 = [
    ' V....D h264_amf             AMD AMF H.264 Encoder (codec h264)',
    ' V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)',
    ' V..... h264_qsv             H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (Intel Quick Sync Video acceleration) (codec h264)',
    ' V....D hevc_amf             AMD AMF HEVC encoder (codec hevc)',
    ' V....D hevc_nvenc           NVIDIA NVENC hevc encoder (codec hevc)',
    ' V..... hevc_qsv             HEVC (Intel Quick Sync Video acceleration) (codec hevc)',
  ].join('\r\n');

  it('lists all three vendors in preference order, HEVC variants ignored', () => {
    expect(parseHardwareEncoders(REAL_81)).toEqual(['nvenc', 'qsv', 'amf']);
  });

  it('the machine decides the working subset; the choice is the first working one in preference order', () => {
    const listed = parseHardwareEncoders(REAL_81);
    const on = (working: readonly string[]) => chooseProxyEncoder(listed.filter((e) => working.includes(e)));
    expect(on(['nvenc', 'qsv'])).toBe('nvenc'); // the dev laptop
    expect(on(['qsv'])).toBe('qsv'); // an Intel-only laptop
    expect(on(['amf'])).toBe('amf'); // an AMD machine
    expect(on([])).toBeNull(); // listed, none opened
  });
});

describe('gpuSegmentPlan', () => {
  it('NVENC keeps the whole pipeline on the card and never uses the d3d11va decode args', () => {
    const plan = gpuSegmentPlan('nvenc', 540, ['-hwaccel', 'd3d11va', '-hwaccel_device', '1']);
    expect(plan.inputArgs).toEqual(['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda']);
    expect(plan.videoFilter).toBe('scale_cuda=w=-2:h=min(540\\,ih):format=yuv420p');
    expect(plan.outputArgs).not.toContain('-pix_fmt');
    expect(plan.profile).toBe('nvenc-540p-intra-q33');
  });

  it('QSV/AMF reuse the shipping decode args, the software scaler and an explicit pixel format', () => {
    const decode = ['-hwaccel', 'd3d11va', '-hwaccel_device', '0'];
    const plan = gpuSegmentPlan('qsv', 540, decode);
    expect(plan.inputArgs).toBe(decode);
    expect(plan.videoFilter).toBe('scale=-2:min(540\\,ih)');
    expect(plan.outputArgs.slice(-2)).toEqual(['-pix_fmt', 'nv12']);
    expect(plan.profile).toBe('qsv-540p-intra-q33');
  });

  it('profile tags differ per encoder and from the x264 tag, so windows never mix', () => {
    const tags = (['nvenc', 'qsv', 'amf'] as const).map((e) => gpuSegmentPlan(e, 540, []).profile);
    expect(new Set(tags).size).toBe(3);
    expect(tags.every((t) => !t.startsWith('x264'))).toBe(true);
  });
});
