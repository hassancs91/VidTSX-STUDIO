import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENDER_QUALITY,
  EXPORT_RESOLUTION_PRESETS,
  TSX_RESOLUTION_PRESETS,
  isRenderQualityLevel,
  isResolutionPresetId,
  makeEven,
  pickResolutionOption,
  renderCrf,
  resolutionOptions,
  type RenderQualityLevel,
} from './render-presets';

const LEVELS: RenderQualityLevel[] = ['best', 'high', 'medium', 'low'];

describe('renderCrf', () => {
  it("is the table both dialogs used (15 / 18 / 23 / 28 for h264), and 'high' — Remotion's default 18 — is the default level", () => {
    expect(LEVELS.map((q) => renderCrf(q))).toEqual([15, 18, 23, 28]);
    expect(renderCrf(DEFAULT_RENDER_QUALITY)).toBe(18);
    expect(renderCrf('high', 'h265')).toBe(18);
    expect(LEVELS.map((q) => renderCrf(q, 'vp9'))).toEqual([15, 25, 33, 40]);
    expect(LEVELS.map((q) => renderCrf(q, 'webp'))).toEqual([100, 90, 80, 65]);
    expect(renderCrf('best', 'gif')).toBe(0);
  });

  it('guards the level ids', () => {
    expect(isRenderQualityLevel('medium')).toBe(true);
    expect(isRenderQualityLevel('ultra')).toBe(false);
    expect(isResolutionPresetId('540p')).toBe(true);
    expect(isResolutionPresetId('2160p')).toBe(false);
  });
});

describe('resolutionOptions', () => {
  it('offers the export ladder under a 1080p project with exact even dims and the scale the renderer applies', () => {
    const options = resolutionOptions(1920, 1080, EXPORT_RESOLUTION_PRESETS, 'Full');
    expect(options.map((o) => [o.value, o.width, o.height])).toEqual([
      ['original', 1920, 1080],
      ['720p', 1280, 720],
      ['540p', 960, 540],
      ['360p', 640, 360],
    ]);
    expect(options[0].label).toBe('Full (1920×1080)');
    expect(options[0].scale).toBe(1);
    for (const o of options.slice(1)) {
      // The very float expressions Remotion's stitcher validates.
      expect(1920 * o.scale).toBe(o.width);
      expect(1080 * o.scale).toBe(o.height);
    }
  });

  it('keeps the TSX ladder as the modal offered it (480p from 1080p snaps to 864×486; nothing at or above the composition)', () => {
    const options = resolutionOptions(1920, 1080, TSX_RESOLUTION_PRESETS);
    expect(options.map((o) => o.value)).toEqual(['original', '720p', '480p']);
    expect(options[0].label).toBe('Original (1920×1080)');
    expect(options[2]).toMatchObject({ width: 864, height: 486, label: '480p (864×486)' });
  });

  it('scales a portrait composition by its width', () => {
    const options = resolutionOptions(1080, 1920, EXPORT_RESOLUTION_PRESETS, 'Full');
    expect(options.map((o) => [o.value, o.width, o.height])).toEqual([
      ['original', 1080, 1920],
      ['720p', 720, 1280],
      ['540p', 540, 960],
      ['360p', 360, 640],
    ]);
  });

  it('a project smaller than every preset offers only its own size', () => {
    expect(resolutionOptions(640, 360, EXPORT_RESOLUTION_PRESETS, 'Full').map((o) => o.value)).toEqual(['original']);
    expect(resolutionOptions(1280, 720, EXPORT_RESOLUTION_PRESETS, 'Full').map((o) => o.value)).toEqual(['original', '540p', '360p']);
  });

  it('falls back to the composition size for an unknown or missing id', () => {
    const options = resolutionOptions(1920, 1080, EXPORT_RESOLUTION_PRESETS, 'Full');
    expect(pickResolutionOption(options, '540p').height).toBe(540);
    expect(pickResolutionOption(options, '4k').value).toBe('original');
    expect(pickResolutionOption(options, undefined).value).toBe('original');
  });

  it('makeEven rounds up to the next even integer', () => {
    expect([853.33, 854, 855, 486.4].map(makeEven)).toEqual([854, 854, 856, 486]);
  });
});
