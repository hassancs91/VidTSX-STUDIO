// The PACKAGE manifest rules (docs/templates-plan.md §7): what `files[]` must
// cover on top of `parseTemplateManifest` — the entry, the thumbnail, every
// file a default or a preset names — and what it may not list.

import { describe, it, expect } from 'vitest';
import { TemplateManifestError } from './manifest';
import { parseTemplatePackageManifest, templateReferencedFiles } from './template-package';

const file = (p: string, size = 10) => ({ path: p, size, sha256: 'a'.repeat(64) });

function base(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formatVersion: 1,
    id: 'acme/count',
    name: 'Count',
    version: '1.0.0',
    author: { name: 'Acme' },
    minAppVersion: '1.1.0',
    category: 'openers',
    entry: 'composition.tsx',
    thumbnail: 'thumb.jpg',
    controls: [
      { key: 'bg', label: 'Background', type: 'image', default: 'assets/bg.jpg' },
      { key: 'music', label: 'Music', type: 'audio', default: '' },
    ],
    presets: [{ id: 'party', name: 'Party', values: { music: 'assets/party.mp3' } }],
    files: [file('composition.tsx'), file('thumb.jpg'), file('assets/bg.jpg'), file('assets/party.mp3')],
    ...over,
  };
}

function problemsOf(raw: Record<string, unknown>): string[] {
  try {
    parseTemplatePackageManifest(raw);
    return [];
  } catch (err) {
    if (err instanceof TemplateManifestError) return err.problems;
    throw err;
  }
}

describe('parseTemplatePackageManifest', () => {
  it('accepts a package whose files[] covers everything the template opens', () => {
    expect(problemsOf(base())).toEqual([]);
  });

  it('names every file a default or a preset points at, without duplicates or the empty value', () => {
    expect(templateReferencedFiles(parseTemplatePackageManifest(base()))).toEqual(['assets/bg.jpg', 'assets/party.mp3']);
  });

  it('refuses a files[] that misses the entry, the thumbnail, or a bundled default', () => {
    expect(problemsOf(base({ files: [file('assets/party.mp3')] }))).toEqual([
      'entry "composition.tsx" is not listed in files[]',
      'thumbnail "thumb.jpg" is not listed in files[]',
      '"assets/bg.jpg" is named by a default or a preset but not listed in files[]',
    ]);
  });

  it('refuses an empty files[], a reserved name, a duplicate, and an oversized entry', () => {
    expect(problemsOf(base({ files: [] }))[0]).toContain('files[] is empty');
    const crowded = base({
      files: [...(base().files as unknown[]), file('signature.json'), file('thumb.jpg'), file('assets/huge.wav', 65 * 1024 * 1024)],
    });
    expect(problemsOf(crowded)).toEqual([
      'files: "signature.json" is reserved — the packer writes it',
      'files: "thumb.jpg" is listed twice',
      `files: "assets/huge.wav" is ${65 * 1024 * 1024} bytes (max ${64 * 1024 * 1024})`,
    ]);
  });

  it('still applies every manifest rule (an unsafe audio default never reaches the files check)', () => {
    const bad = base({ controls: [{ key: 'music', label: 'Music', type: 'audio', default: '../../music.mp3' }] });
    expect(problemsOf(bad)).toEqual(["controls.music: default must be '' or a safe path inside the template"]);
  });
});
