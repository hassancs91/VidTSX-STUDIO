// The passthrough engine's pure ffmpeg builders (docs/export-engines-plan.md
// Stage 2): the T1 conditions as argument lists.
import { describe, expect, it } from 'vitest';
import { EXPORT_COLOR } from './types';
import {
  audioPassArgs,
  blackSpanArgs,
  browserSpanArgs,
  concatListText,
  copySpanArgs,
  holdLastFrameArgs,
  isConstantFrameRate,
  joinArgs,
  nearestSelectFilter,
  parseFrameRate,
  parseStatsFrame,
  seekSeconds,
  spanEncoderArgs,
} from './passthrough-ffmpeg';

const DJI = { num: 60000, den: 1001 };
const base = { encoder: 'nvenc' as const, fps: 30, width: 1920, height: 1080, color: EXPORT_COLOR, sourceFrameRate: DJI, sourcePath: 'C:\\raw\\a.MP4' };

describe('nearestSelectFilter (condition 1)', () => {
  it('keeps source frame K only when it is the nearest to the slot it is nearest to', () => {
    expect(nearestSelectFilter({ sourceFrame: 450, fps: 30, sourceFrameRate: DJI, firstFrameCeil: false })).toBe(
      "select='eq(floor(((450/30)+max(round((t-(450/30))*30)\\,0)/30)/(1001/60000)+0.5)\\,round(t/(1001/60000)))'",
    );
  });

  it('takes the ceil frame for slot 0 when the composition opens mid-source (T1 leg 3)', () => {
    const f = nearestSelectFilter({ sourceFrame: 450, fps: 30, sourceFrameRate: DJI, firstFrameCeil: true });
    expect(f).toContain('if(lt(max(round((t-(450/30))*30)\\,0)\\,1)\\,ceil((450/30)/(1001/60000)-0.000001)\\,floor(');
  });

  it('seeks one source frame early, never before 0', () => {
    expect(seekSeconds({ sourceFrame: 0, fps: 30, sourceFrameRate: DJI })).toBe('0.000000');
    expect(seekSeconds({ sourceFrame: 450, fps: 30, sourceFrameRate: DJI })).toBe((15 - 1001 / 60000).toFixed(6));
  });

  it('evaluates the rule the way T1 measured it (f=30 → K 60, f=600 → K 1199, f=870 → K 1738)', () => {
    // The same maths in JS: slot n at S + n/fps picks K = floor(t/D + 0.5).
    const D = 1001 / 60000;
    const K = (n: number) => Math.floor((0 + n / 30) / D + 0.5);
    expect(K(30)).toBe(60);
    expect(K(600)).toBe(1199);
    expect(K(870)).toBe(1738);
  });
});

describe('span argument builders', () => {
  it('copy spans: NVDEC → select → scale_cuda → setpts → tag → NVENC, cfr, exact frame count, TS video-only', () => {
    const args = copySpanArgs({ ...base, sourceFrame: 450, frames: 450, firstFrameCeil: false, outputPath: 'C:\\w\\s1.ts' });
    const s = args.join(' ');
    expect(s).toContain('-hwaccel cuda -hwaccel_output_format cuda -ss ' + (15 - 1001 / 60000).toFixed(6) + ' -copyts -i C:\\raw\\a.MP4');
    expect(s).toMatch(/-filter_complex \[0:v\]select='eq\(.*\)',scale_cuda=w=1920:h=1080:format=yuv420p,setpts=N\/\(30\*TB\),setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709\[v\] -map \[v\]/);
    expect(s).toContain('-r 30 -fps_mode cfr -frames:v 450 -c:v h264_nvenc -preset p5 -rc vbr -cq 23 -b:v 0 -bf 2 -g 60');
    expect(s).toContain('-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -an -f mpegts C:\\w\\s1.ts');
    expect(s).not.toMatch(/fps=/);
    // Never `-r` alone: cfr and the frame cap always ride with it.
    expect(args.indexOf('-fps_mode')).toBe(args.indexOf('-r') + 2);
  });

  it('copy spans on QSV/AMF decode in software and scale on the CPU', () => {
    const s = copySpanArgs({ ...base, encoder: 'qsv', sourceFrame: 0, frames: 10, firstFrameCeil: false, outputPath: 'o.ts' }).join(' ');
    expect(s).not.toContain('cuda');
    expect(s).toContain('scale=w=1920:h=1080,format=yuv420p,setpts');
    expect(s).toContain('-c:v h264_qsv');
    expect(spanEncoderArgs('amf')).toContain('h264_amf');
  });

  it('black spans come from lavfi with the same encoder, tags and timing', () => {
    const s = blackSpanArgs({ ...base, frames: 30, outputPath: 'b.ts' }).join(' ');
    expect(s).toContain('-f lavfi -i color=black:size=1920x1080:rate=30 -vf format=yuv420p,setparams=');
    expect(s).toContain('-r 30 -fps_mode cfr -frames:v 30 -c:v h264_nvenc');
    expect(s).toContain('-an -f mpegts b.ts');
  });

  it('browser spans drop the lead-in and re-encode with the copied spans\' settings (conditions 2 + 4)', () => {
    const s = browserSpanArgs({ ...base, inputPath: 'r.mkv', leadIn: 1, frames: 450, outputPath: 'r.ts' }).join(' ');
    expect(s).toContain('-i r.mkv -vf trim=start_frame=1,setpts=N/(30*TB),format=yuv420p,setparams=');
    expect(s).toContain('-frames:v 450 -c:v h264_nvenc -preset p5 -rc vbr -cq 23');
    expect(s).toContain('-f mpegts r.ts');
  });

  it("a clip tail past the stream end holds the short piece's last frame", () => {
    const s = holdLastFrameArgs({ ...base, inputPath: 's.ts', lastFrame: 688, frames: 2, outputPath: 't.ts' }).join(' ');
    expect(s).toContain('-i s.ts -vf trim=start_frame=688,tpad=stop=1:stop_mode=clone,setpts=N/(30*TB),format=yuv420p,setparams=');
    expect(s).toContain('-r 30 -fps_mode cfr -frames:v 2 -c:v h264_nvenc');
    expect(s).toContain('-f mpegts t.ts');
  });

  it('the concat list carries forward slashes, quoting and exact durations', () => {
    expect(concatListText([{ path: "C:\\w\\it's.ts", frames: 450 }, { path: 'C:\\w\\b.ts', frames: 30 }], 30)).toBe(
      "file 'C:/w/it'\\''s.ts'\nduration 15.000000\nfile 'C:/w/b.ts'\nduration 1.000000\n",
    );
  });

  it('the join is a stream copy of the video only, tagged', () => {
    const s = joinArgs('l.txt', 'v.mp4', EXPORT_COLOR).join(' ');
    expect(s).toContain('-f concat -safe 0 -i l.txt -map 0:v:0 -c:v copy -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -an v.mp4');
  });
});

describe('audioPassArgs (the one pass)', () => {
  it('trims each source segment, fills silence, shares inputs and pads to the exact length', () => {
    const { args, graph } = audioPassArgs({
      duration: 31,
      segments: [
        { kind: 'source', assetId: 'a', assetPath: 'A.MP4', sourceIn: 0, duration: 15 },
        { kind: 'silence', duration: 1 },
        { kind: 'source', assetId: 'a', assetPath: 'A.MP4', sourceIn: 15, duration: 15 },
      ],
    }, 'audio.wav', 'graph.txt');
    expect(args.filter((a) => a === '-i')).toHaveLength(1);
    // The graph rides a script file (275 segments overran the Windows command line inline).
    expect(args).not.toContain('-filter_complex');
    expect(args.join(' ')).toContain('-filter_complex_script graph.txt -map [out] -ar 48000 -ac 2 -c:a pcm_s16le audio.wav');
    // Every source segment is pinned to its planned length (a short audio stream
    // at a clip tail shifted every later segment by −44.7 ms on the 3 h project).
    expect(graph).toBe(
      '[0:a:0]aresample=async=1:first_pts=0,atrim=start=0.000000:end=15.000000,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=15.000000,atrim=end=15.000000[s0];\n' +
      'anullsrc=r=48000:cl=stereo,atrim=duration=1.000000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[s1];\n' +
      '[0:a:0]aresample=async=1:first_pts=0,atrim=start=15.000000:end=30.000000,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=15.000000,atrim=end=15.000000[s2];\n' +
      '[s0][s1][s2]concat=n=3:v=0:a=1,atrim=end=31.000000,apad=whole_dur=31.000000[out]\n',
    );
  });
});

describe('audioPassArgs with gain (Stage 3)', () => {
  it('applies volume=<gain> on that segment only, after the format and before the length pin', () => {
    const { graph } = audioPassArgs({
      duration: 30,
      segments: [
        { kind: 'source', assetId: 'a', assetPath: 'A.MP4', sourceIn: 0, duration: 15 },
        { kind: 'source', assetId: 'a', assetPath: 'A.MP4', sourceIn: 15, duration: 15, gain: 0.5 },
      ],
    }, 'audio.wav', 'graph.txt');
    const lines = graph.split(';\n');
    expect(lines[0]).not.toContain('volume=');
    expect(lines[1]).toContain('aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.500000,apad=whole_dur=15.000000,atrim=end=15.000000[s1]');
    // A muted clip is a plain multiply by 0, not a silence segment (its length is still pinned from the source).
    const muted = audioPassArgs({ duration: 5, segments: [{ kind: 'source', assetId: 'a', assetPath: 'A.MP4', sourceIn: 0, duration: 5, gain: 0 }] }, 'o.wav', 'g.txt').graph;
    expect(muted).toContain('volume=0.000000,apad');
  });
});

describe('audioPassArgs with a second chain (Stage 3 slice 2)', () => {
  it('concatenates and pins each chain, then sums them with Remotion\'s amix (normalize=0)', () => {
    const { args, graph } = audioPassArgs({
      duration: 30,
      segments: [
        { kind: 'source', assetId: 'a', assetPath: 'A.MP4', sourceIn: 0, duration: 15 },
        { kind: 'source', assetId: 'a', assetPath: 'A.MP4', sourceIn: 15, duration: 15 },
      ],
      chains: [[
        { kind: 'silence', duration: 5 },
        { kind: 'source', assetId: 'm', assetPath: 'M.wav', sourceIn: 2, duration: 20, gain: 0.5 },
        { kind: 'silence', duration: 5 },
      ]],
    }, 'audio.wav', 'graph.txt');
    expect(args.filter((a) => a === '-i')).toHaveLength(2);
    expect(args[args.indexOf('-i') + 1]).toBe('A.MP4');
    expect(args[args.lastIndexOf('-i') + 1]).toBe('M.wav');
    const lines = graph.trimEnd().split(';\n');
    expect(lines).toHaveLength(8);
    expect(lines[2]).toBe('[s0][s1]concat=n=2:v=0:a=1,atrim=end=30.000000,apad=whole_dur=30.000000[m0]');
    expect(lines[3]).toBe('anullsrc=r=48000:cl=stereo,atrim=duration=5.000000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[c1s0]');
    expect(lines[4]).toBe('[1:a:0]aresample=async=1:first_pts=0,atrim=start=2.000000:end=22.000000,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.500000,apad=whole_dur=20.000000,atrim=end=20.000000[c1s1]');
    expect(lines[5]).toBe('anullsrc=r=48000:cl=stereo,atrim=duration=5.000000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[c1s2]');
    expect(lines[6]).toBe('[c1s0][c1s1][c1s2]concat=n=3:v=0:a=1,atrim=end=30.000000,apad=whole_dur=30.000000[m1]');
    // Exactly @remotion/renderer's merge filter (create-ffmpeg-merge-filter.js).
    expect(lines[7]).toBe('[m0][m1]amix=inputs=2:dropout_transition=0:normalize=0[out]');
  });

  it('one chain keeps the Stage 2 graph to the byte (no amix, [out] on the concat)', () => {
    const one = audioPassArgs({ duration: 2, segments: [{ kind: 'source', assetId: 'a', assetPath: 'A.MP4', sourceIn: 0, duration: 2 }] }, 'o.wav', 'g.txt').graph;
    expect(one).not.toContain('amix');
    expect(one).toContain('concat=n=1:v=0:a=1,atrim=end=2.000000,apad=whole_dur=2.000000[out]');
    expect(audioPassArgs({ duration: 2, segments: [{ kind: 'source', assetId: 'a', assetPath: 'A.MP4', sourceIn: 0, duration: 2 }], chains: [] }, 'o.wav', 'g.txt').graph).toBe(one);
  });
});

describe('small parsers', () => {
  it('reads the last frame counter from a -stats chunk', () => {
    expect(parseStatsFrame('frame=   12 fps=0.0 q=0.0 size=0KiB\rframe=  340 fps=120')).toBe(340);
    expect(parseStatsFrame('nothing')).toBeNull();
  });

  it('parses ffprobe frame rates and judges constancy', () => {
    expect(parseFrameRate('60000/1001')).toEqual({ num: 60000, den: 1001 });
    expect(parseFrameRate('0/0')).toBeNull();
    expect(parseFrameRate('29.97')).toEqual({ num: 29970, den: 1000 });
    expect(isConstantFrameRate({ num: 60000, den: 1001 }, { num: 60000, den: 1001 })).toBe(true);
    expect(isConstantFrameRate({ num: 60000, den: 1001 }, { num: 2997, den: 100 })).toBe(false);
  });
});
