import { describe, expect, it } from 'vitest';
import {
  fontCacheExtensionFor,
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
