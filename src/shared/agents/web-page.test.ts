import { describe, it, expect } from 'vitest';
import {
  WEB_PAGE_VIEWER_CSP,
  WEB_PAGE_EXPORT_CSP,
  assetNameFor,
  buildWebPageSrcdoc,
  findArtifactRefs,
  injectWebPageCsp,
  inlinedWeight,
  mimeForExtension,
  refToken,
  rewriteArtifactRefs,
  validateWebPageDocument,
} from './web-page';

const page = (body: string, head = ''): string =>
  `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>T</title>${head}</head><body>${body}</body></html>`;

describe('artifact references', () => {
  it('finds distinct refs in first-seen order, with image-set items', () => {
    const html = page(
      '<video src="artifact:video-1"></video><img src="artifact:image-set-2/1"><img src="artifact:image-set-2"><p style="background:url(artifact:video-1)"></p>',
    );
    expect(findArtifactRefs(html)).toEqual([
      { artifactId: 'video-1', item: 0 },
      { artifactId: 'image-set-2', item: 1 },
      { artifactId: 'image-set-2', item: 0 },
    ]);
  });

  it('rewrites every ref the resolver answers and leaves the rest', () => {
    const out = rewriteArtifactRefs('a artifact:video-1 b artifact:image-set-2/1 c artifact:audio-9', (ref) =>
      ref.artifactId === 'audio-9' ? undefined : `assets/${assetNameFor(ref, '.bin')}`,
    );
    expect(out).toBe('a assets/video-1.bin b assets/image-set-2-1.bin c artifact:audio-9');
  });

  it('round-trips tokens and names', () => {
    expect(refToken({ artifactId: 'video-1', item: 0 })).toBe('artifact:video-1');
    expect(refToken({ artifactId: 'image-set-2', item: 3 })).toBe('artifact:image-set-2/3');
    expect(mimeForExtension('.MP4')).toBe('video/mp4');
    expect(mimeForExtension('.xyz')).toBe('application/octet-stream');
  });

  it('weighs the inlined page as base64 would', () => {
    expect(inlinedWeight(100, [300])).toBe(100 + 400 + 40);
  });
});

describe('validateWebPageDocument', () => {
  it('accepts a self-contained page with artifact refs, links and inline code', () => {
    const html = page(
      '<style>body{font-family:Georgia}</style><a href="https://vidtsx.com">Site</a><video src="artifact:video-1" poster="artifact:image-set-2"></video><img srcset="artifact:image-set-2 1x, artifact:image-set-2/1 2x"><script>document.title="x"</script>',
    );
    expect(validateWebPageDocument(html)).toEqual([]);
  });

  it('rejects an external image (the acceptance probe)', () => {
    const problems = validateWebPageDocument(page('<img src="https://example.com/x.png">'));
    expect(problems.some((p) => p.includes('reaches the network'))).toBe(true);
  });

  it('rejects fetch() in a script (the acceptance probe)', () => {
    const problems = validateWebPageDocument(page("<script>fetch('https://example.com')</script>"));
    expect(problems.some((p) => p.includes('network API'))).toBe(true);
  });

  it('rejects external scripts, stylesheets, imports, frames and refreshes', () => {
    const html = page(
      '<script src="https://cdn.example/x.js"></script><iframe src="artifact:video-1"></iframe><style>@import url(x.css)</style>',
      '<link rel="stylesheet" href="https://fonts.example/css"><meta http-equiv="refresh" content="0;url=https://x">',
    );
    const problems = validateWebPageDocument(html);
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('<script src>'),
        expect.stringContaining('<link href='),
        expect.stringContaining('@import'),
        expect.stringContaining('<iframe>'),
        expect.stringContaining('refresh'),
      ]),
    );
  });

  it('rejects CSS url() and protocol-relative sources that leave the page', () => {
    const problems = validateWebPageDocument(
      page('<div style="background:url(//cdn.example/bg.png)"></div><img src="assets/local.png">'),
    );
    expect(problems.some((p) => p.startsWith('CSS url('))).toBe(true);
    expect(problems.some((p) => p.includes('not an artifact reference'))).toBe(true);
  });

  it('rejects a document that is not one complete html document', () => {
    expect(validateWebPageDocument('<div>hi</div>')).toEqual(
      expect.arrayContaining([expect.stringContaining('ONE complete HTML document')]),
    );
    expect(validateWebPageDocument(page('') + page(''))).toEqual(
      expect.arrayContaining([expect.stringContaining('More than one <html>')]),
    );
  });
});

describe('the CSP wrap', () => {
  it('is the no-network policy the plan names, verbatim', () => {
    expect(WEB_PAGE_VIEWER_CSP).toBe(
      "default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:",
    );
    expect(WEB_PAGE_EXPORT_CSP).toContain("default-src 'none'");
    expect(WEB_PAGE_EXPORT_CSP).not.toMatch(/https?:/);
  });

  it('puts the meta first inside <head>', () => {
    const out = buildWebPageSrcdoc(page('<p>x</p>'));
    const headAt = out.indexOf('<head>');
    const metaAt = out.indexOf('<meta http-equiv="Content-Security-Policy"');
    expect(metaAt).toBe(headAt + '<head>'.length + 1);
    expect(out).toContain(`content="${WEB_PAGE_VIEWER_CSP}"`);
  });

  it('adds a head when the page has none, and prepends when it has no html', () => {
    expect(injectWebPageCsp('<html><body></body></html>', 'x')).toContain('<html>\n<head><meta http-equiv="Content-Security-Policy" content="x"></head>');
    expect(injectWebPageCsp('<p>x</p>', 'x').startsWith('<meta http-equiv="Content-Security-Policy" content="x">')).toBe(true);
  });
});
