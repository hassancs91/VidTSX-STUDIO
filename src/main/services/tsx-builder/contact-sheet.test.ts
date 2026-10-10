import { describe, expect, it } from 'vitest';
import { parseCompositionConfig } from '../composition-config-parser';
import { contactSheetLayout, contactSheetSource, CONTACT_SHEET_MAX_SIDE } from './contact-sheet';

const portrait = { id: 'CoinPiles', width: 1080, height: 1350, fps: 30, durationInFrames: 240 };

// The shape `check` returns (finishShotBundle): literal config at the head, a
// function-scoped copy inside, the default export at the tail.
const bundle = `import React from "react";
export const compositionConfig = { id: "CoinPiles", durationInFrames: 240, fps: 30, width: 1080, height: 1350 };
function __vidtsxInit() {
  var compositionConfig = { id: "CoinPiles", durationInFrames: 240, fps: 30, width: 1080, height: 1350 };
  return () => compositionConfig.fps;
}
const __vidtsxShot = (props) => null;
export default __vidtsxShot;
`;

describe('contactSheetLayout', () => {
  it('fits the grid inside the max side and keeps the tiles at the build aspect', () => {
    for (const n of [2, 5, 9, 12]) {
      const layout = contactSheetLayout(portrait, Array.from({ length: n }, (_, i) => i * 20));
      expect(layout.width).toBeLessThanOrEqual(CONTACT_SHEET_MAX_SIDE);
      expect(layout.height).toBeLessThanOrEqual(CONTACT_SHEET_MAX_SIDE);
      expect(layout.cols * layout.rows).toBeGreaterThanOrEqual(n);
      expect(layout.width % 2).toBe(0);
      expect(layout.height % 2).toBe(0);
      expect(Math.abs(layout.tileWidth / layout.tileHeight - 1080 / 1350)).toBeLessThan(0.01);
      expect(layout.cells).toHaveLength(n);
    }
  });

  it('picks the grid with the biggest tiles: 9 portrait frames in 3x3, 12 in 4x3', () => {
    expect(contactSheetLayout(portrait, Array(9).fill(0))).toMatchObject({ cols: 3, rows: 3 });
    expect(contactSheetLayout(portrait, Array(12).fill(0))).toMatchObject({ cols: 4, rows: 3 });
    expect(contactSheetLayout({ width: 1920, height: 1080 }, Array(4).fill(0))).toMatchObject({ cols: 2, rows: 2 });
  });

  it('lays tiles left to right, then top to bottom', () => {
    const { cells } = contactSheetLayout(portrait, [0, 60, 120, 180]);
    expect(cells[0].y).toBe(cells[1].y);
    expect(cells[1].x).toBeGreaterThan(cells[0].x);
    expect(cells[2].y).toBeGreaterThan(cells[0].y);
  });
});

describe('contactSheetSource', () => {
  it('exports only the sheet: its own literal config and default component', () => {
    const sheet = contactSheetSource(bundle, portrait, [0, 120, 239]);
    expect(sheet.code.match(/export\s+const\s+compositionConfig/g)).toHaveLength(1);
    expect(sheet.code.match(/export\s+default/g)).toHaveLength(1);
    expect(sheet.code).toContain('export default function VidtsxContactSheet()');
    expect(parseCompositionConfig(sheet.code)).toMatchObject({
      id: 'VidtsxContactSheet',
      width: sheet.layout.width,
      height: sheet.layout.height,
      fps: 30,
      durationInFrames: 240,
    });
  });

  it("renames the build's config everywhere, so its own references still resolve", () => {
    const { code } = contactSheetSource(bundle, portrait, [0]);
    expect(code).toContain('const __vidtsxPieceConfig = { id: "CoinPiles"');
    expect(code).toContain('var __vidtsxPieceConfig =');
    expect(code).toContain('() => __vidtsxPieceConfig.fps');
    expect(code).toContain('const __vidtsxPiece = __vidtsxShot;');
    expect(code).toContain('h(__vidtsxPiece, {})');
  });

  it('mounts each tile at the build size, frozen at its frame', () => {
    const { code } = contactSheetSource(bundle, portrait, [0, 120]);
    expect(code).toContain('"cells":[{"frame":0,');
    expect(code).toContain('{"frame":120,');
    expect(code).toContain('h(__VidtsxSequence, { from: 0, durationInFrames: S.d, width: S.w, height: S.h');
    expect(code).toContain('h(__VidtsxFreeze, { frame: c.frame }');
  });

  it('keeps a default-exported function declaration callable by its name', () => {
    const single = `export const compositionConfig = { id: 'A', durationInFrames: 60, fps: 30, width: 1080, height: 1080 };
export default function Bounce() { return null; }
`;
    const { code } = contactSheetSource(single, { ...portrait, height: 1080, durationInFrames: 60 }, [0, 30]);
    expect(code).toContain('\nfunction Bounce() {');
    expect(code).toContain('h(Bounce, {})');
  });

  it('refuses an artifact without the exports the gates require', () => {
    expect(() => contactSheetSource('export default () => null;', portrait, [0])).toThrow(/compositionConfig/);
    expect(() => contactSheetSource("export const compositionConfig = { id: 'A' };", portrait, [0])).toThrow(/default export/);
  });
});
