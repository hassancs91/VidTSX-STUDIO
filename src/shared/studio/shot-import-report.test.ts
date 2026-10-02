import { describe, expect, it } from 'vitest';
import { describeImportReport } from './shot-import';

describe('describeImportReport', () => {
  it('says what was inlined and attached', () => {
    expect(
      describeImportReport({ inlinedFiles: 2, inlinedPackages: ['lucide-react'], media: 1, missingMedia: [], dynamicMediaCalls: 0 }),
    ).toBe('Bundled into one file (2 local files and lucide-react inlined). 1 media file attached as project asset.');
  });

  it('names the media it could not find and counts computed paths', () => {
    expect(
      describeImportReport({ inlinedFiles: 0, inlinedPackages: [], media: 0, missingMedia: ['brand/x.png'], dynamicMediaCalls: 2 }),
    ).toBe(
      "Bundled into one file. Not found beside the source: brand/x.png — attach them in the shot's Media section. 2 staticFile() calls have a computed path and will load nothing until the matching key is attached.",
    );
  });
});
