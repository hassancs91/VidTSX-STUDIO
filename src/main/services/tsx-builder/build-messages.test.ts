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
        "IMAGES: generate_image is not available this run. library_search finds the user's own files.",
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

  it('adds the brand and counts the reference images', () => {
    const message = buildFirstMessage({ intent: 'Caching.', format, brand: 'Navy #0B1F3A, Poppins.', referenceImageCount: 2 });
    expect(message).toContain('BRAND (follow it):\nNavy #0B1F3A, Poppins.');
    expect(message).toContain('REFERENCE: 2 images attached.');
  });

  it("points an edit at the builder's round log when the source was kept", () => {
    const message = buildFirstMessage({ intent: 'Make the coins bigger.', format, seed: { version: 3, fromSrc: true } });
    expect(message.startsWith('Change this composition.')).toBe(true);
    expect(message).toContain('CHANGE: Make the coins bigger.');
    expect(message).toContain('holds v3 as the builder left it: DESIGN.md');
    expect(message).toContain('Look at it as it is (render_stills) before you change anything.');
  });

  it('asks for a DESIGN.md when the edited version predates the builder', () => {
    const message = buildFirstMessage({ intent: 'Slower.', format, seed: { version: 1, fromSrc: false } });
    expect(message).toContain('holds v1 as one file, index.tsx');
    expect(message).toContain('there is no DESIGN.md');
  });
});
