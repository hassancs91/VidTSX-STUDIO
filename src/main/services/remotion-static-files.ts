// `staticFile('<absolute path>')` in a composition that is about to be
// RENDERED (W8 Stage 6 finding, flows plan §6 "media convention").
//
// The preview overrides `staticFile` with a virtual module that routes any
// path through the module server's `/asset` endpoint, so a generated
// composition can say `staticFile("C:/…/hero.png")` and it plays. The render
// bundles the real Remotion, whose `staticFile` refuses an absolute path
// ("does not support absolute paths"), so the same composition failed the
// first time a flow rendered one with a video on its port. The bundler's own
// asset server already serves `/asset?path=` for Studio exports; this turns
// each absolute-path `staticFile(...)` literal into that URL before bundling.
// Relative paths and anything that is not a string literal are left alone.

import fs from 'fs/promises';
import path from 'path';

const STATIC_FILE_LITERAL = /staticFile\(\s*(["'`])([^"'`\n]+)\1\s*\)/g;

/** `C:/x`, `C:\x`, `/x`, `\\server\x` — a path Remotion's `staticFile` rejects. */
export function isAbsoluteMediaPath(value: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(value);
}

/** The asset-server url for one file — what Studio's export entry embeds. */
export function assetUrlFor(baseUrl: string, absPath: string): string {
  return `${baseUrl.replace(/\/$/, '')}/asset?path=${encodeURIComponent(absPath)}`;
}

/** Pure: the code with every absolute-path `staticFile("…")` replaced by a url string. */
export function rewriteAbsoluteStaticFiles(code: string, baseUrl: string): { code: string; count: number } {
  let count = 0;
  const out = code.replace(STATIC_FILE_LITERAL, (whole, _quote: string, value: string) => {
    if (!isAbsoluteMediaPath(value)) return whole;
    count += 1;
    return JSON.stringify(assetUrlFor(baseUrl, value));
  });
  return { code: out, count };
}

/**
 * Write a rewritten sibling of `entryFilePath` when it needs one and return
 * its path; otherwise return the entry untouched. The sibling sits in the
 * same folder under `<name>.abs-assets.tsx`, so the wrapper's `./<name>.tsx`
 * import resolves exactly as before.
 */
export async function materializeAbsoluteStaticFiles(entryFilePath: string, baseUrl: string): Promise<string> {
  const source = await fs.readFile(entryFilePath, 'utf-8');
  if (!source.includes('staticFile(')) return entryFilePath;
  const { code, count } = rewriteAbsoluteStaticFiles(source, baseUrl);
  if (count === 0) return entryFilePath;
  const ext = path.extname(entryFilePath);
  const sibling = path.join(path.dirname(entryFilePath), `${path.basename(entryFilePath, ext)}.abs-assets${ext}`);
  await fs.writeFile(sibling, code, 'utf-8');
  return sibling;
}
