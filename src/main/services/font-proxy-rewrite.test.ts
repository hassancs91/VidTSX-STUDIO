import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  collectCssFontFileUrls,
  collectEntryFontUrls,
  collectFontUrls,
  fontCacheExtensionFor,
  isFontStylesheetUrl,
  rewriteCssFontUrls,
  rewriteFontUrls,
} from './font-proxy-rewrite';

const BASE = 'http://127.0.0.1:4321';
const CSS2 = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;700&display=swap';
const WOFF2 = 'https://fonts.gstatic.com/s/archivo/v19/k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTTNDNZ9xdp.woff2';

describe('rewriteFontUrls (code)', () => {
  it('rewrites a quoted Google Fonts URL and keeps the quote style', () => {
    expect(rewriteFontUrls(`const u = "${CSS2}";`, BASE)).toBe(
      `const u = "${BASE}/fonts?u=${encodeURIComponent(CSS2)}";`,
    );
    expect(rewriteFontUrls(`const u = '${WOFF2}';`, BASE)).toContain(
      `'${BASE}/fonts?u=`,
    );
  });

  it('rewrites a quoted @import inside a template literal', () => {
    const code = "const css = `@import url('" + CSS2 + "');`;";
    expect(rewriteFontUrls(code, BASE)).toContain(`@import url('${BASE}/fonts?u=`);
  });

  it('leaves unrelated hosts alone', () => {
    const code = `const u = "https://evil.example.com/fonts.gstatic.com/x.woff2";`;
    expect(rewriteFontUrls(code, BASE)).toBe(code);
  });
});

describe('collectFontUrls (export font preflight input)', () => {
  it('finds each quoted URL once, in first-seen order, both quote styles', () => {
    const code = [
      `const a = "${WOFF2}";`,
      `const b = '${CSS2}';`,
      `const c = "${WOFF2}";`,
      "const css = `@import url('" + CSS2 + "');`;",
    ].join('\n');
    expect(collectFontUrls(code)).toEqual([WOFF2, CSS2]);
  });

  it('reads the @remotion/google-fonts inlined info block (css2 url + per-subset woff2s)', () => {
    const info = [
      'var getInfo = () => ({',
      '  fontFamily: "Space Grotesk",',
      '  url: "https://fonts.googleapis.com/css2?family=Space+Grotesk:ital,wght@0,300;0,400",',
      '  fonts: { normal: {',
      '    "300": { vietnamese: "https://fonts.gstatic.com/s/spacegrotesk/v22/A.woff2", latin: "https://fonts.gstatic.com/s/spacegrotesk/v22/B.woff2" },',
      '    "400": { vietnamese: "https://fonts.gstatic.com/s/spacegrotesk/v22/A.woff2", latin: "https://fonts.gstatic.com/s/spacegrotesk/v22/B.woff2" }',
      '  } }',
      '});',
      // FontFace(..., `url(${font})`) — a template with no literal URL in it
      "const fontFace = new FontFace(meta.fontFamily, `url(${font}) format('woff2')`);",
    ].join('\n');
    expect(collectFontUrls(info)).toEqual([
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:ital,wght@0,300;0,400',
      'https://fonts.gstatic.com/s/spacegrotesk/v22/A.woff2',
      'https://fonts.gstatic.com/s/spacegrotesk/v22/B.woff2',
    ]);
  });

  it('ignores unquoted, other-host and already-proxied references', () => {
    const code = [
      `// see https://fonts.gstatic.com/s/x/y.woff2 in a comment`,
      `const u = "https://evil.example.com/fonts.gstatic.com/x.woff2";`,
      `const p = "${rewriteFontUrls(`'${WOFF2}'`, BASE).slice(1, -1)}";`,
    ].join('\n');
    expect(collectFontUrls(code)).toEqual([]);
  });

  // A real bundled shot (video-14 copy, END_TO_END A3): every Google Fonts URL
  // in it must be a quoted literal the preflight sees. Local-only material.
  const SHOT = path.join(
    process.cwd(),
    '.vidtsx-temp/end-to-end/v14-root/projects/video-14/shots/v14-a1-nobody/v1.tsx',
  );
  it.skipIf(!existsSync(SHOT))('sees every Google Fonts URL in a real bundled shot', () => {
    const code = readFileSync(SHOT, 'utf-8');
    const anywhere = new Set(code.match(/https:\/\/fonts\.(?:gstatic|googleapis)\.com\/[^"'\s`)]+/g) ?? []);
    const urls = collectFontUrls(code);
    expect(urls.length).toBeGreaterThan(0);
    expect(new Set(urls)).toEqual(anywhere);
    expect(urls.filter(isFontStylesheetUrl).map((u) => new URL(u).searchParams.get('family')?.split(':')[0])).toEqual([
      'Space Grotesk',
      'Inter',
      'JetBrains Mono',
      'Spectral',
    ]);
    expect(rewriteFontUrls(code, BASE)).not.toMatch(/["']https:\/\/fonts\.(?:gstatic|googleapis)\.com/);
  });
});

describe('collectEntryFontUrls (the shot copies, after the rewrite)', () => {
  it('decodes the proxied references back to the upstream URLs, once each', () => {
    const source = [`const a = "${WOFF2}";`, `const b = '${CSS2}';`, `const c = "${WOFF2}";`].join('\n');
    expect(collectEntryFontUrls(rewriteFontUrls(source, BASE))).toEqual([WOFF2, CSS2]);
  });

  it('keeps raw quoted URLs too, and drops proxied refs to other hosts or broken encodings', () => {
    const code = [
      `const raw = "${WOFF2}";`,
      `const other = "${BASE}/fonts?u=${encodeURIComponent('https://evil.example.com/x.woff2')}";`,
      `const broken = "${BASE}/fonts?u=%E0%A4%A";`,
      `const plain = "${BASE}/fonts?u=${encodeURIComponent(CSS2)}";`,
    ].join('\n');
    expect(collectEntryFontUrls(code)).toEqual([WOFF2, CSS2]);
  });
});

describe('collectCssFontFileUrls', () => {
  it('lists the gstatic files of a stylesheet body once each, any url() quoting', () => {
    const css = `src: url(${WOFF2}) format('woff2');\nsrc: url("${WOFF2}");\nsrc: url('https://fonts.gstatic.com/s/b/v1/B.woff2');`;
    expect(collectCssFontFileUrls(css)).toEqual([WOFF2, 'https://fonts.gstatic.com/s/b/v1/B.woff2']);
  });
});

describe('isFontStylesheetUrl', () => {
  it('tells a css2 stylesheet from a font file', () => {
    expect(isFontStylesheetUrl(CSS2)).toBe(true);
    expect(isFontStylesheetUrl(WOFF2)).toBe(false);
    expect(isFontStylesheetUrl('not a url')).toBe(false);
  });
});

describe('rewriteCssFontUrls (served stylesheet body)', () => {
  const body = [
    '@font-face {',
    "  font-family: 'Archivo';",
    '  font-style: normal;',
    `  src: url(${WOFF2}) format('woff2');`,
    '}',
  ].join('\n');

  it('rewrites the unquoted url() in a @font-face src', () => {
    const out = rewriteCssFontUrls(body, BASE);
    expect(out).toContain(`url(${BASE}/fonts?u=${encodeURIComponent(WOFF2)})`);
    expect(out).not.toContain('fonts.gstatic.com/s/archivo');
    // everything else survives untouched
    expect(out).toContain("format('woff2')");
    expect(out).toContain("font-family: 'Archivo';");
  });

  it('rewrites quoted url() forms and preserves the quote', () => {
    expect(rewriteCssFontUrls(`src: url("${WOFF2}");`, BASE)).toContain(
      `url("${BASE}/fonts?u=`,
    );
    expect(rewriteCssFontUrls(`src: url( '${WOFF2}' );`, BASE)).toContain(
      `url('${BASE}/fonts?u=`,
    );
  });

  it('rewrites a bare @import string', () => {
    expect(rewriteCssFontUrls(`@import "${CSS2}";`, BASE)).toBe(
      `@import "${BASE}/fonts?u=${encodeURIComponent(CSS2)}";`,
    );
  });

  it('emits a root-relative reference when no base URL is given', () => {
    expect(rewriteCssFontUrls(`src: url(${WOFF2});`)).toBe(
      `src: url(/fonts?u=${encodeURIComponent(WOFF2)});`,
    );
  });

  it('rewrites every face in a multi-weight stylesheet', () => {
    const two = `${body}\n${body.replace('v19', 'v20')}`;
    const out = rewriteCssFontUrls(two, BASE);
    expect(out.match(/\/fonts\?u=/g)).toHaveLength(2);
    expect(out).not.toContain('https://fonts.gstatic.com');
  });

  it('leaves data: and relative url() references alone', () => {
    const css = 'src: url(data:font/woff2;base64,AAAA) format("woff2"), url(./local.woff2);';
    expect(rewriteCssFontUrls(css, BASE)).toBe(css);
  });
});

describe('fontCacheExtensionFor', () => {
  it('treats an extension-less googleapis path as CSS', () => {
    expect(fontCacheExtensionFor(new URL(CSS2))).toBe('.css');
    expect(fontCacheExtensionFor(new URL('https://fonts.googleapis.com/css?family=Inter'))).toBe(
      '.css',
    );
  });

  it('keeps a real font extension', () => {
    expect(fontCacheExtensionFor(new URL(WOFF2))).toBe('.woff2');
    expect(fontCacheExtensionFor(new URL('https://fonts.gstatic.com/s/x/y.ttf'))).toBe('.ttf');
  });

  it('falls back to .bin for an unknown gstatic path', () => {
    expect(fontCacheExtensionFor(new URL('https://fonts.gstatic.com/s/x/y'))).toBe('.bin');
  });
});
