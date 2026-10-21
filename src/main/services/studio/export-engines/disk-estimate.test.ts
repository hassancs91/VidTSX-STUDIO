import { describe, expect, it } from 'vitest';
import { AAC_BYTES_PER_SECOND, estimateExportDisk, h264BytesPerSecond, PCM_BYTES_PER_SECOND } from './disk-estimate';

const GB = 1024 ** 3;

describe('h264BytesPerSecond', () => {
  it('puts 1080p30 at CRF 18 near 9 Mb/s and halves every +6 CRF', () => {
    const crf18 = h264BytesPerSecond(1920, 1080, 30, 18);
    expect((crf18 * 8) / 1e6).toBeCloseTo(9.33, 1);
    expect(h264BytesPerSecond(1920, 1080, 30, 24)).toBeCloseTo(crf18 / 2, 6);
    expect(h264BytesPerSecond(1920, 1080, 30)).toBe(crf18);
  });
});

describe('estimateExportDisk', () => {
  const sixtySeconds = { width: 3840, height: 2160, fps: 30, durationInFrames: 1800 };

  it('Standard: temp = whole-file copies of every source + the encoded .mkv + its PCM; output = video + AAC', () => {
    const e = estimateExportDisk({
      engineId: 'remotion',
      ...sixtySeconds,
      crf: 18,
      sources: [
        { bytes: 3.77 * GB, durationSeconds: 600, videoSeconds: 60 },
        { bytes: 0.2 * GB, durationSeconds: 600, videoSeconds: 0 },
      ],
    });
    const video = Math.ceil(60 * h264BytesPerSecond(3840, 2160, 30, 18));
    expect(e.temp.remotionCopies).toBeCloseTo(3.97 * GB, 0);
    expect(e.temp.intermediate).toBe(video);
    expect(e.temp.audio).toBe(60 * PCM_BYTES_PER_SECOND);
    expect(e.temp.shotLayers).toBe(0);
    expect(e.tempBytes).toBe(e.temp.remotionCopies + video + 60 * PCM_BYTES_PER_SECOND);
    expect(e.outputBytes).toBe(video + 60 * AAC_BYTES_PER_SECOND);
  });

  it('copy engines: a copied second costs the larger of the source rate and the encode rate', () => {
    // A 100 Mb/s camera file shown for 40 s of a 60 s range; the other 20 s are encoded.
    const sourceRate = 100e6 / 8;
    const e = estimateExportDisk({
      engineId: 'passthrough',
      ...sixtySeconds,
      sources: [{ bytes: sourceRate * 600, durationSeconds: 600, videoSeconds: 40 }],
    });
    const encodedRate = h264BytesPerSecond(3840, 2160, 30);
    const video = Math.ceil(40 * Math.max(sourceRate, encodedRate) + 20 * encodedRate);
    expect(e.temp.intermediate).toBe(video);
    expect(e.outputBytes).toBe(video + 60 * AAC_BYTES_PER_SECOND);
    expect(e.temp.remotionCopies).toBe(sourceRate * 600);
  });

  it('copy engines: a source of unknown length is bounded by the whole file', () => {
    const e = estimateExportDisk({
      engineId: 'passthrough',
      width: 640,
      height: 360,
      fps: 30,
      durationInFrames: 300,
      sources: [{ bytes: 2 * GB, durationSeconds: 0, videoSeconds: 10 }],
    });
    expect(e.temp.intermediate).toBe(2 * GB);
  });

  it('Fastest adds one ProRes 4444 layer for the longest run of shots', () => {
    const base = { ...sixtySeconds, sources: [] };
    const fast = estimateExportDisk({ engineId: 'passthrough', ...base, longestShotRunSeconds: 10 });
    const fastest = estimateExportDisk({ engineId: 'shot-composite', ...base, longestShotRunSeconds: 10 });
    expect(fast.temp.shotLayers).toBe(0);
    // ~1.3 Gb/s at 4K30 → ~1.6 GB for 10 s.
    expect(fastest.temp.shotLayers / GB).toBeGreaterThan(1.4);
    expect(fastest.temp.shotLayers / GB).toBeLessThan(1.8);
    expect(fastest.tempBytes - fast.tempBytes).toBe(fastest.temp.shotLayers);
  });

  it('an empty or zero-fps entry needs nothing', () => {
    const e = estimateExportDisk({ engineId: 'remotion', width: 1920, height: 1080, fps: 0, durationInFrames: 0, sources: [] });
    expect(e).toEqual({ outputBytes: 0, tempBytes: 0, temp: { remotionCopies: 0, intermediate: 0, audio: 0, shotLayers: 0 } });
  });
});
