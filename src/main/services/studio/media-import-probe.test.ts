import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// E1 fix round 1 (verifier V1-1 / V1-2): an ID3 cover picture shows up in ffprobe as a
// "video" stream (mjpeg, disposition.attached_pic = 1). probeMedia must treat it as
// NOT video: the mp3 gapless trim still applies, and the picture's width / codec are
// not recorded as the audio file's.

const ffprobe = vi.hoisted(() => ({ json: '' }));
const gapless = vi.hoisted(() => ({ calls: 0 }));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: vi.fn(() => {
      const proc = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
      });
      setImmediate(() => {
        proc.stdout.emit('data', Buffer.from(ffprobe.json));
        proc.emit('close', 0);
      });
      return proc;
    }),
  };
});
vi.mock('@remotion/renderer', () => ({ RenderInternals: { getExecutablePath: () => 'ffprobe.exe' } }));
vi.mock('../../utils/paths', () => ({ getRemotionBinariesDir: () => 'binaries' }));
vi.mock('./mp3-gapless', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mp3-gapless')>();
  return {
    ...actual,
    // The verifier's cover-art.mp3: 116 frames, LAME delay 576 + padding 756 at 44.1 kHz.
    readMp3Gapless: vi.fn(async () => {
      gapless.calls += 1;
      return { frames: 116, samplesPerFrame: 1152, sampleRate: 44100, startPad: 576, endPad: 756 };
    }),
  };
});

import { probeMedia } from './media-import';

const coverPic = {
  codec_type: 'video',
  codec_name: 'mjpeg',
  width: 320,
  height: 320,
  r_frame_rate: '90000/1',
  disposition: { default: 0, attached_pic: 1 },
};
const mp3Audio = { codec_type: 'audio', codec_name: 'mp3', disposition: { default: 0, attached_pic: 0 } };

function setProbe(streams: object[], duration: string): void {
  ffprobe.json = JSON.stringify({ streams, format: { duration } });
}

describe('probeMedia — attached pictures are not video (E1 V1-1 / V1-2)', () => {
  beforeEach(() => {
    gapless.calls = 0;
  });

  it('trims an mp3 with embedded cover art to its gapless length', async () => {
    setProbe([mp3Audio, coverPic], '3.030204');
    const probe = await probeMedia('C:/lib/cover-art.mp3', 'audio');
    expect(gapless.calls).toBe(1);
    expect(Math.abs(probe.duration - 3.0)).toBeLessThan(0.0005);
  });

  it('records the audio stream, not the cover picture, for an mp3 with cover art', async () => {
    setProbe([coverPic, mp3Audio], '3.030204');
    const probe = await probeMedia('C:/lib/cover-art.mp3', 'audio');
    expect(probe.codec).toBe('mp3');
    expect(probe.width).toBeUndefined();
    expect(probe.height).toBeUndefined();
    expect(probe.hasAudio).toBe(true);
  });

  it('a plain mp3 is trimmed as before', async () => {
    setProbe([mp3Audio], '3.030204');
    const probe = await probeMedia('C:/lib/plain.mp3', 'audio');
    expect(Math.abs(probe.duration - 3.0)).toBeLessThan(0.0005);
    expect(probe.codec).toBe('mp3');
  });

  it('a video with cover art keeps its real video stream (size, fps, codec)', async () => {
    const h264 = { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' };
    setProbe([coverPic, h264, { codec_type: 'audio', codec_name: 'aac' }], '2.000000');
    const probe = await probeMedia('C:/lib/clip.mp4', 'video');
    expect(probe).toMatchObject({ codec: 'h264', width: 1920, height: 1080, fps: 30, duration: 2, hasAudio: true });
    expect(gapless.calls).toBe(0);
  });
});
