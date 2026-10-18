import { describe, expect, it } from 'vitest';
import { buildFirstMessage } from './build-messages';

const format = { width: 1080, height: 1350, fps: 30, durationInFrames: 240, loop: true };

describe('buildFirstMessage', () => {
  it('sends a new build the P0 message plus the images line when there is no brand, reference or file', () => {
    expect(buildFirstMessage({ intent: 'Compound interest.', format })).toBe(
      [
        'Build this as an animated composition.',
        '',
        'IDEA: Compound interest.',
        'FORMAT: 4:5, 1080x1350, 30 fps, 240 frames (8 s), seamless loop',
        '',
        "IMAGES: generate_image is not available this run; draw what you need. library_search finds the user's own files.",
        '',
        'Your folder is empty. Start with DESIGN.md, then build, check, and look.',
      ].join('\n'),
    );
  });

  it('lists the files in assets/ and says when generate_image is available', () => {
    const message = buildFirstMessage({
      intent: 'A robot waves.',
      format,
      assets: [
        { relPath: 'robot.glb', kind: 'model', bytes: 2_400_000 },
        { relPath: 'studio.hdr', kind: 'environment', bytes: 1_600_000 },
      ],
      imageGeneration: { provider: 'fal', max: 4 },
    });
    expect(message).toContain("FILES in assets/ (load each with staticFile('<name>')");
    expect(message).toContain('- robot.glb (model, 2.3 MB)');
    expect(message).toContain('- studio.hdr (environment, 1.5 MB)');
    expect(message).toContain('generate_image is available (fal, paid per image, at most 4 this run)');
    expect(message).toContain('Your folder holds only assets/.');
  });

  it("says why generate_image is off when the image provider cannot run (P2 problem 3)", () => {
    const message = buildFirstMessage({ intent: 'A product shot.', format, imageGenerationOff: 'sd-cli is not installed. Set it up in AI Models → Image first.' });
    expect(message).toContain('IMAGES: generate_image is not available this run (the image provider cannot run: sd-cli is not installed.');
    expect(message).not.toContain('generate_image is available');
  });

  it('adds the brand and counts the reference images', () => {
    const message = buildFirstMessage({ intent: 'Caching.', format, brand: 'Navy #0B1F3A, Poppins.', referenceImageCount: 2 });
    expect(message).toContain('BRAND (follow it):\nNavy #0B1F3A, Poppins.');
    expect(message).toContain('REFERENCE: 2 images attached.');
  });

  it("carries the user's own style words (P4), new build and edit alike", () => {
    const style = 'Chalkboard: dark green, chalk-white wobbly lines.';
    const fresh = buildFirstMessage({ intent: 'Caching.', format, style });
    expect(fresh).toContain(`STYLE (the user's own words; keep every one):\n${style}`);
    expect(buildFirstMessage({ intent: 'Slower.', format, style, seed: { version: 2, kind: 'src' } })).toContain(style);
    expect(buildFirstMessage({ intent: 'Caching.', format, style: '  ' })).not.toContain('STYLE');
  });

  it("points an edit at the builder's round log when the source was kept", () => {
    const message = buildFirstMessage({ intent: 'Make the coins bigger.', format, seed: { version: 3, kind: 'src' } });
    expect(message.startsWith('Change this composition.')).toBe(true);
    expect(message).toContain('CHANGE: Make the coins bigger.');
    expect(message).toContain('holds v3 as the builder left it: DESIGN.md');
    expect(message).toContain('Look at it as it is (render_stills) before you change anything.');
  });

  it('asks for a DESIGN.md when the edited version predates the builder', () => {
    const message = buildFirstMessage({ intent: 'Slower.', format, seed: { version: 1, kind: 'file' } });
    expect(message).toContain('holds v1 as one file, index.tsx');
    expect(message).toContain('there is no DESIGN.md');
  });

  it('sends the src and pre-builder edit messages as before part 3, word for word', () => {
    const tail = (kind: 'src' | 'file') => buildFirstMessage({ intent: 'Slower.', format, seed: { version: 2, kind } }).split('\n').slice(-2);
    expect(tail('src')).toEqual([
      'Your folder holds v2 as the builder left it: DESIGN.md has its design and round log. Read DESIGN.md and the files first.',
      'Look at it as it is (render_stills) before you change anything. Keep what works; change what the request asks and what your looks show is needed. Add this edit to the round log in DESIGN.md.',
    ]);
    expect(tail('file')[0]).toBe(
      'Your folder holds v2 as one file, index.tsx. It was made before the builder, so there is no DESIGN.md: start one with what the picture is now, then the change.',
    );
  });

  it('points a hand-edited version at HAND-EDITS.diff before the change asked for', () => {
    const later = buildFirstMessage({ intent: 'Blue ball.', format, seed: { version: 2, kind: 'hand-edits', srcVersion: 1, handEditLines: 4 } });
    expect(later).toContain('Your folder holds v1 as the builder left it');
    expect(later).toContain('v2 is v1 with changes made by hand: HAND-EDITS.diff has those changes (4 lines)');
    expect(later).toContain('make it there first: the user keeps them. Then look at it (render_stills) before the change asked for.');
    const inPlace = buildFirstMessage({ intent: 'Blue ball.', format, seed: { version: 3, kind: 'hand-edits', srcVersion: 3, handEditLines: 2 } });
    expect(inPlace).toContain('v3 was changed by hand after the builder saved it: HAND-EDITS.diff');
  });

  it('says a rewritten bundle is a bundle, and asks for staticFile() again when it names files', () => {
    const message = buildFirstMessage({ intent: 'Blue ball.', format, seed: { version: 4, kind: 'file', bundle: true, bundleAssets: true, srcVersion: 2 } });
    expect(message).toContain("holds v4 as one file, index.tsx: the builder's files for v2 bundled into one, then rewritten by hand. DESIGN.md is v2's design");
    expect(message).toContain("write staticFile('…') for each again");
    expect(message).not.toContain('made before the builder');
  });
});
