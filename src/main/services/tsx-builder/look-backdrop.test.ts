import { describe, expect, it } from 'vitest';
import { BACKDROP_PROP, backdropLine, backdropLookSource } from './look-backdrop';
import { contactSheetSource } from './contact-sheet';
import { parseCompositionConfig } from '../composition-config-parser';

const config = { id: 'shot', width: 1920, height: 1080, fps: 30, durationInFrames: 150 };
const PIECE = `import { AbsoluteFill } from 'remotion';
export const compositionConfig = { id: 'shot', width: 1920, height: 1080, fps: 30, durationInFrames: 150 };
const S = compositionConfig.fps;
export default function LowerThird(props) { return null; }
`;

describe('backdropLookSource', () => {
  it('mounts the piece over the footage from the backdrop start, under the piece config', () => {
    const code = backdropLookSource(PIECE, config, 372);
    expect(parseCompositionConfig(code)).toEqual(config);
    // The piece keeps its own config under another name, references included.
    expect(code).toContain('const __vidtsxLookPieceConfig = {');
    expect(code).toContain('const S = __vidtsxLookPieceConfig.fps;');
    expect(code).toContain('function LowerThird(');
    expect(code).not.toContain('export default function LowerThird');
    expect(code).toContain('"trimBefore":372');
    expect(code).toContain(BACKDROP_PROP);
    expect(code).toContain('h(LowerThird, rest)');
  });

  it('draws a checkerboard when no footage is under the shot', () => {
    const code = backdropLookSource(PIECE, config, null);
    expect(code).toContain('"trimBefore":null');
    expect(code).toContain('repeating-conic-gradient');
  });

  it('wraps an anonymous default export too, and still makes a contact sheet', () => {
    const anon = PIECE.replace('export default function LowerThird(props) { return null; }', 'export default () => null;');
    const code = backdropLookSource(anon, config, 0);
    expect(code).toContain('const __vidtsxLookPiece = () => null;');
    // The contact sheet renames again on top: one composition, one default export.
    const sheet = contactSheetSource(code, config, [0, 75, 149]);
    expect(sheet.code.match(/export default/g)).toHaveLength(1);
    expect(sheet.code).toContain('function VidtsxBackdropLook(');
    expect(parseCompositionConfig(sheet.code)?.id).toBe('VidtsxContactSheet');
  });

  it('refuses a build without the exports every gate requires', () => {
    expect(() => backdropLookSource('export default () => null;', config, 0)).toThrow(/compositionConfig/);
    expect(() => backdropLookSource('export const compositionConfig = {};', config, 0)).toThrow(/default export/);
  });
});

describe('backdropLine', () => {
  it('names the footage, or says a checkerboard means transparent', () => {
    expect(backdropLine('talk.mp4 from 12.4 s')).toMatch(/over the footage it plays over \(talk\.mp4 from 12\.4 s\)/);
    expect(backdropLine(null)).toMatch(/grey checkerboard = transparent/);
  });
});
