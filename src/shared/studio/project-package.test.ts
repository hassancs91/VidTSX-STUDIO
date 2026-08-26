import { describe, expect, it } from 'vitest';
import {
  entrySizeLimit,
  formatPackageBytes,
  isSafeEntryPath,
  packageFileName,
  packageMediaPath,
  PACKAGE_DIRS,
  PACKAGE_LIMITS,
  VIDTSX_PACKAGE_FORMAT_VERSION,
} from './project-package';
import { parsePackageManifest } from './project-package-manifest';

// The manifest a well-formed v1 export writes — every test below starts from
// this and breaks exactly one thing.
function goodManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formatVersion: VIDTSX_PACKAGE_FORMAT_VERSION,
    kind: 'project',
    app: { name: 'VidTSX Studio', version: '1.0.1' },
    schemaVersion: 1,
    createdAt: '2026-08-26T10:00:00.000Z',
    project: { name: 'Demo', width: 1920, height: 1080, fps: 30 },
    mediaStrategy: 'full',
    counts: { assets: 1, media: 1, shots: 0, transcripts: 0 },
    totalBytes: 12,
    assets: [
      {
        assetId: 'asset-1',
        kind: 'video',
        originalName: 'a-roll.mp4',
        file: 'media/asset-1.mp4',
        originalBytes: 10,
        hash: 'abc123',
      },
    ],
    files: [
      { path: 'project.json', size: 2, sha256: 'a'.repeat(64) },
      { path: 'media/asset-1.mp4', size: 10, sha256: 'b'.repeat(64) },
    ],
    ...overrides,
  };
}

describe('isSafeEntryPath (zip-slip gate 1 of 2)', () => {
  it('accepts the package layout', () => {
    for (const name of [
      'manifest.json',
      'project.json',
      'media/asset-1.mp4',
      'shots/intro/v1.tsx',
      'shots/intro/original.tsx',
      'transcripts/asset-1.json',
      'cut-plans/asset-1-balanced.json',
      'kit/1.2.3/index.tsx',
      'caption-packs/hasan-pro/pack.json',
      'thumbs/asset-1.jpg',
    ]) {
      expect(isSafeEntryPath(name), name).toBe(true);
    }
  });

  it('rejects traversal in every shape it arrives in', () => {
    for (const name of [
      '../outside.json',
      'media/../../outside.mp4',
      'media/./x.mp4',
      '/etc/passwd',
      'C:/Windows/System32/evil.dll',
      'c:evil.dll',
      '\\\\server\\share\\evil.dll',
      'media\\..\\..\\evil.mp4',
      'media//double.mp4',
      '',
    ]) {
      expect(isSafeEntryPath(name), name).toBe(false);
    }
  });

  it('rejects Windows-hostile names a zip can legally carry', () => {
    // A trailing dot/space is silently trimmed by the Win32 API, so "evil.txt."
    // and "evil.txt" would land on the same file — the manifest allowlist would
    // then be checking a name that is not the one written.
    for (const name of ['evil.txt.', 'evil.txt ', 'CON', 'nul.json', 'com1.tsx', 'a:b.json', 'q?.json']) {
      expect(isSafeEntryPath(name), name).toBe(false);
    }
  });

  it('rejects control characters and over-long paths', () => {
    expect(isSafeEntryPath(`media/${String.fromCharCode(0)}.mp4`)).toBe(false);
    expect(isSafeEntryPath(`media/${String.fromCharCode(0x1f)}.mp4`)).toBe(false);
    expect(isSafeEntryPath(`media/${String.fromCharCode(0x7f)}.mp4`)).toBe(false);
    expect(isSafeEntryPath(`media/${'x'.repeat(PACKAGE_LIMITS.maxPathLength)}.mp4`)).toBe(false);
  });
});

describe('entry size limits', () => {
  it('gives media the generous cap and everything parsed the small one', () => {
    expect(entrySizeLimit(`${PACKAGE_DIRS.media}/a.mp4`)).toBe(PACKAGE_LIMITS.maxMediaFileBytes);
    expect(entrySizeLimit('project.json')).toBe(PACKAGE_LIMITS.maxDataFileBytes);
    expect(entrySizeLimit('shots/intro/v1.tsx')).toBe(PACKAGE_LIMITS.maxDataFileBytes);
    // Not the media folder — just a name that starts with the same letters.
    expect(entrySizeLimit('mediafoo/a.mp4')).toBe(PACKAGE_LIMITS.maxDataFileBytes);
  });
});

describe('packageMediaPath', () => {
  it('names media by asset id so a hostile filename never reaches disk', () => {
    expect(packageMediaPath('asset-1', 'C:/footage/A Roll (final).MP4')).toBe('media/asset-1.mp4');
    expect(packageMediaPath('asset-1', '/tmp/../../etc/passwd')).toBe('media/asset-1');
    expect(packageMediaPath('asset-1', 'no-extension')).toBe('media/asset-1');
  });
});

describe('packageFileName', () => {
  it('slugs the project name and always ends in .vidtsx', () => {
    expect(packageFileName('My Great Video!')).toBe('my-great-video.vidtsx');
    expect(packageFileName('***')).toBe('project.vidtsx');
    expect(packageFileName('x'.repeat(200)).length).toBeLessThanOrEqual(60 + '.vidtsx'.length);
  });
});

describe('formatPackageBytes', () => {
  it('scales the unit', () => {
    expect(formatPackageBytes(512)).toBe('512 B');
    expect(formatPackageBytes(2048)).toBe('2 KB');
    expect(formatPackageBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatPackageBytes(3 * 1024 * 1024 * 1024)).toBe('3.00 GB');
    expect(formatPackageBytes(Number.NaN)).toBe('—');
  });
});

describe('parsePackageManifest', () => {
  it('accepts a well-formed v1 manifest', () => {
    const result = parsePackageManifest(goodManifest());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.kind).toBe('project');
    expect(result.manifest.assets[0].file).toBe('media/asset-1.mp4');
    // totalBytes is recomputed from files — never trusted from the document.
    expect(result.manifest.totalBytes).toBe(12);
  });

  it('recomputes totalBytes instead of believing the manifest', () => {
    const result = parsePackageManifest(goodManifest({ totalBytes: 1 }));
    expect(result.ok && result.manifest.totalBytes).toBe(12);
  });

  it('rejects a manifest whose files list carries a traversal path', () => {
    const result = parsePackageManifest(
      goodManifest({
        files: [
          { path: 'project.json', size: 2, sha256: 'a'.repeat(64) },
          { path: '../evil.exe', size: 2, sha256: 'b'.repeat(64) },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('Unsafe path');
  });

  it('rejects duplicate paths, bad hashes and bad sizes', () => {
    const dup = parsePackageManifest(
      goodManifest({
        files: [
          { path: 'project.json', size: 2, sha256: 'a'.repeat(64) },
          { path: 'project.json', size: 2, sha256: 'a'.repeat(64) },
        ],
      }),
    );
    expect(dup.ok === false && dup.error).toContain('Duplicate path');

    const badHash = parsePackageManifest(
      goodManifest({ files: [{ path: 'project.json', size: 2, sha256: 'nope' }] }),
    );
    expect(badHash.ok === false && badHash.error).toContain('sha256');

    const badSize = parsePackageManifest(
      goodManifest({ files: [{ path: 'project.json', size: -1, sha256: 'a'.repeat(64) }] }),
    );
    expect(badSize.ok === false && badSize.error).toContain('Bad size');
  });

  it('rejects a data entry over the parse cap', () => {
    const result = parsePackageManifest(
      goodManifest({
        files: [
          {
            path: 'project.json',
            size: PACKAGE_LIMITS.maxDataFileBytes + 1,
            sha256: 'a'.repeat(64),
          },
        ],
      }),
    );
    expect(result.ok === false && result.error).toContain('size limit');
  });

  it('rejects a manifest with more entries than the cap allows', () => {
    const files = Array.from({ length: PACKAGE_LIMITS.maxEntries + 1 }, (_, i) => ({
      path: `shots/s${i}/v1.tsx`,
      size: 1,
      sha256: 'a'.repeat(64),
    }));
    const result = parsePackageManifest(goodManifest({ files }));
    expect(result.ok === false && result.error).toContain('the limit is');
  });

  it('refuses a package with no project.json', () => {
    const result = parsePackageManifest(
      goodManifest({
        files: [{ path: 'media/asset-1.mp4', size: 10, sha256: 'b'.repeat(64) }],
        assets: [],
      }),
    );
    expect(result.ok === false && result.error).toContain('no project.json');
  });

  it('refuses an asset pointing at a file the manifest does not list', () => {
    const result = parsePackageManifest(
      goodManifest({
        assets: [{ assetId: 'asset-1', kind: 'video', originalName: 'a.mp4', file: 'media/ghost.mp4' }],
      }),
    );
    expect(result.ok === false && result.error).toContain('does not list');
  });

  it('refuses bad asset ids and kinds', () => {
    expect(
      parsePackageManifest(goodManifest({ assets: [{ assetId: '../x', kind: 'video', originalName: 'a' }] })).ok,
    ).toBe(false);
    expect(
      parsePackageManifest(goodManifest({ assets: [{ assetId: 'a1', kind: 'hologram', originalName: 'a' }] })).ok,
    ).toBe(false);
  });

  it('bounds the display strings it hands the UI', () => {
    const result = parsePackageManifest(
      goodManifest({
        project: { name: `Evil\nName${'x'.repeat(400)}`, width: 1920, height: 1080, fps: 30 },
        assets: [
          {
            assetId: 'asset-1',
            kind: 'video',
            originalName: `a\nb${'y'.repeat(400)}`,
            file: 'media/asset-1.mp4',
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.project.name).not.toContain('\n');
    expect(result.manifest.project.name.length).toBeLessThanOrEqual(120);
    expect(result.manifest.assets[0].originalName).not.toContain('\n');
    expect(result.manifest.assets[0].originalName.length).toBeLessThanOrEqual(200);
  });

  it('rejects manifests with no usable versions', () => {
    expect(parsePackageManifest(goodManifest({ formatVersion: 'one' })).ok).toBe(false);
    expect(parsePackageManifest(goodManifest({ formatVersion: 0 })).ok).toBe(false);
    expect(parsePackageManifest(goodManifest({ schemaVersion: undefined })).ok).toBe(false);
    expect(parsePackageManifest('not an object').ok).toBe(false);
    expect(parsePackageManifest(null).ok).toBe(false);
  });

  // Q7g/Q8 forward compatibility: a v1 reader must be able to NAME these, which
  // is why they round-trip through the validator instead of being dropped.
  it('round-trips the reserved template + pack fields', () => {
    const result = parsePackageManifest(
      goodManifest({
        kind: 'template',
        packs: ['hasan-pro'],
        captionPacks: ['hasan-captions'],
        kitVersion: '1.2.3',
        agentChat: true,
        brand: true,
        assets: [
          {
            assetId: 'asset-1',
            kind: 'video',
            originalName: 'placeholder.mp4',
            file: 'media/asset-1.mp4',
            replaceable: true,
            role: 'your A-roll here',
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.kind).toBe('template');
    expect(result.manifest.packs).toEqual(['hasan-pro']);
    expect(result.manifest.captionPacks).toEqual(['hasan-captions']);
    expect(result.manifest.kitVersion).toBe('1.2.3');
    expect(result.manifest.agentChat).toBe(true);
    expect(result.manifest.brand).toBe(true);
    expect(result.manifest.assets[0].replaceable).toBe(true);
    expect(result.manifest.assets[0].role).toBe('your A-roll here');
  });

  it('rejects bad pack ids and kit versions rather than passing them to the installer', () => {
    expect(parsePackageManifest(goodManifest({ packs: ['../evil'] })).ok).toBe(false);
    expect(parsePackageManifest(goodManifest({ captionPacks: ['Evil Pack'] })).ok).toBe(false);
    expect(parsePackageManifest(goodManifest({ kitVersion: '../evil' })).ok).toBe(false);
    expect(parsePackageManifest(goodManifest({ kitVersion: 'latest' })).ok).toBe(false);
  });

  it('defaults an unknown media strategy to the safest one (no media)', () => {
    const result = parsePackageManifest(goodManifest({ mediaStrategy: 'teleport' }));
    expect(result.ok && result.manifest.mediaStrategy).toBe('none');
  });
});
