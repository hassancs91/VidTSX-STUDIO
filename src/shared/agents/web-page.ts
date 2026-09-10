// The `web-page` artifact's grammar (V1 completion plan §2.9, W9): how a page
// refers to media, what a page may NOT contain, and the CSP the viewer wraps
// it in. Pure — shared by the `write_page` / `edit_page` tools (validation),
// the resolve handler and `export_site` (reference rewriting) and the
// `WebPageViewer` (the srcdoc), so the three can never disagree about what a
// reference looks like or what "reaches the network" means.
//
// SECURITY IS THE POINT. A page the model wrote runs as untrusted content:
// inside the app it lives in a sandboxed iframe with no `allow-same-origin`
// and the CSP below, which allows nothing but inline code and data: media;
// the validator rejects anything that would try to load from elsewhere so a
// page that passes it renders identically in the viewer, in the capture
// window and in the user's browser after export.

/** Hard cap on a page with every reference inlined as a data URI (§2.9). */
export const WEB_PAGE_INLINE_CAP_BYTES = 16 * 1024 * 1024;

/** The viewer's policy: no network, inline code, data:/blob: media only. */
export const WEB_PAGE_VIEWER_CSP =
  "default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:";

/** The exported site's policy: the same, plus its own `assets/` folder. */
export const WEB_PAGE_EXPORT_CSP =
  "default-src 'none'; img-src 'self' file: data: blob:; media-src 'self' file: data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src 'self' file: data:";

/** The three widths the viewer toggles between and `capture_page` shoots at. */
export const WEB_PAGE_VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
} as const;

export type WebPageViewport = keyof typeof WEB_PAGE_VIEWPORTS;

/** `artifact:<kind>-<n>` or `artifact:<kind>-<n>/<item>` (image-set items). */
const REF_PATTERN = /artifact:([a-z][a-z-]*-\d+)(?:\/(\d+))?/g;

export interface ArtifactRef {
  artifactId: string;
  item: number;
}

export function refToken(ref: ArtifactRef): string {
  return ref.item > 0 ? `artifact:${ref.artifactId}/${ref.item}` : `artifact:${ref.artifactId}`;
}

/** Every distinct reference in the document, in first-seen order. */
export function findArtifactRefs(html: string): ArtifactRef[] {
  const seen = new Set<string>();
  const refs: ArtifactRef[] = [];
  for (const match of html.matchAll(REF_PATTERN)) {
    const ref = { artifactId: match[1], item: match[2] ? Number(match[2]) : 0 };
    const key = refToken(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
  }
  return refs;
}

/** Replace every reference the resolver answers; unknown ones are left as is. */
export function rewriteArtifactRefs(
  html: string,
  resolve: (ref: ArtifactRef) => string | undefined,
): string {
  return html.replace(REF_PATTERN, (whole, id: string, item?: string) => {
    return resolve({ artifactId: id, item: item ? Number(item) : 0 }) ?? whole;
  });
}

/** The file name a reference gets under `assets/` at export. */
export function assetNameFor(ref: ArtifactRef, ext: string): string {
  return `${ref.artifactId}${ref.item > 0 ? `-${ref.item}` : ''}${ext}`;
}

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

export function mimeForExtension(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? 'application/octet-stream';
}

// ─── the validator ──────────────────────────────────────────────────────────

const NETWORK_URL = /^\s*(https?:|wss?:|ftp:|file:|\/\/)/i;
const SAFE_RESOURCE = /^\s*(artifact:|data:|blob:|#|$)/i;
/** Attributes whose value the browser LOADS (an `<a href>` only navigates). */
const RESOURCE_ATTRS = new Set([
  'src',
  'poster',
  'srcset',
  'data',
  'action',
  'formaction',
  'ping',
  'background',
  'manifest',
  'xlink:href',
  'href',
]);
const FORBIDDEN_TAGS = ['iframe', 'frame', 'frameset', 'embed', 'object', 'applet', 'base', 'portal'];
const NETWORK_APIS =
  /\b(fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|EventSource\s*\(|sendBeacon\s*\(|importScripts\s*\(|serviceWorker|SharedWorker\s*\(|new\s+Worker\s*\(|import\s*\()/;

function attributes(tagBody: string): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];
  const re = /([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const m of tagBody.matchAll(re)) {
    out.push({ name: m[1].toLowerCase(), value: m[2] ?? m[3] ?? m[4] ?? '' });
  }
  return out;
}

function checkResourceValue(tag: string, name: string, value: string, problems: string[]): void {
  const values = name === 'srcset' ? value.split(',').map((v) => v.trim().split(/\s+/)[0] ?? '') : [value];
  for (const v of values) {
    if (NETWORK_URL.test(v)) {
      problems.push(`<${tag} ${name}="${v.trim().slice(0, 80)}"> reaches the network — the page may only reference artifacts (artifact:<id>) or data: URIs`);
    } else if (!SAFE_RESOURCE.test(v)) {
      problems.push(`<${tag} ${name}="${v.trim().slice(0, 80)}"> is not an artifact reference — use artifact:<id> for media, or inline it`);
    }
  }
}

/**
 * Why a document is not an acceptable web page, as plain-words problems the
 * tool hands back to the model. Empty means it passes. The checks are
 * deliberately blunt (regexes over the markup, not a parser): a page that
 * needs a parser to prove it is harmless is not one this app shows.
 */
export function validateWebPageDocument(html: string): string[] {
  const problems: string[] = [];
  const trimmed = html.trim();
  if (!/^(<!doctype\s+html[^>]*>\s*)?<html[\s>]/i.test(trimmed)) {
    problems.push('The page must be ONE complete HTML document: start with <!doctype html> and <html>.');
  }
  if ((trimmed.match(/<html[\s>]/gi) ?? []).length > 1) {
    problems.push('More than one <html> element — write exactly one document.');
  }
  if (!/<\/html>\s*$/i.test(trimmed)) {
    problems.push('The document must end with </html>.');
  }
  if (/@import\b/i.test(html)) {
    problems.push('@import is not allowed — stylesheets go inline in a <style> block.');
  }
  if (/<meta[^>]*http-equiv\s*=\s*["']?refresh/i.test(html)) {
    problems.push('<meta http-equiv="refresh"> is not allowed.');
  }

  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    const body = m[2];
    if (FORBIDDEN_TAGS.includes(tag)) {
      problems.push(`<${tag}> is not allowed in a page.`);
      continue;
    }
    for (const { name, value } of attributes(body)) {
      if (name === 'href' && (tag === 'a' || tag === 'area')) {
        // A link only navigates when the user clicks it: allowed.
        if (/^\s*javascript:/i.test(value)) problems.push(`<a href="javascript:…"> is not allowed.`);
        continue;
      }
      if (tag === 'script' && name === 'src') {
        problems.push('<script src> is not allowed — scripts go inline.');
        continue;
      }
      if (tag === 'link' && name === 'href' && !/^\s*artifact:/i.test(value)) {
        problems.push(`<link href="${value.slice(0, 80)}"> is not allowed — fonts and stylesheets go inline; a favicon may reference an artifact.`);
        continue;
      }
      if (RESOURCE_ATTRS.has(name)) checkResourceValue(tag, name, value, problems);
      if (name.startsWith('on') && (NETWORK_APIS.test(value) || NETWORK_URL.test(value))) {
        problems.push(`<${tag} ${name}> handler reaches the network.`);
      }
    }
  }

  for (const m of html.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
    const v = m[2];
    if (NETWORK_URL.test(v)) problems.push(`CSS url(${v.trim().slice(0, 80)}) reaches the network.`);
    else if (!SAFE_RESOURCE.test(v)) problems.push(`CSS url(${v.trim().slice(0, 80)}) is not an artifact reference or a data: URI.`);
  }

  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = m[1];
    if (NETWORK_APIS.test(body)) {
      problems.push('A <script> uses a network API (fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, workers or dynamic import) — the page must not reach the network.');
    }
    if (/(https?|wss?):\/\//i.test(body)) {
      problems.push('A <script> contains an http(s)/ws URL — the page must not reach the network.');
    }
  }

  return [...new Set(problems)];
}

// ─── the CSP wrap ───────────────────────────────────────────────────────────

function cspMeta(csp: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
}

/** The policy goes FIRST in <head> so nothing loads before it applies. */
export function injectWebPageCsp(html: string, csp: string): string {
  const meta = cspMeta(csp);
  const head = html.match(/<head\b[^>]*>/i);
  if (head && head.index !== undefined) {
    const at = head.index + head[0].length;
    return `${html.slice(0, at)}\n${meta}${html.slice(at)}`;
  }
  const root = html.match(/<html\b[^>]*>/i);
  if (root && root.index !== undefined) {
    const at = root.index + root[0].length;
    return `${html.slice(0, at)}\n<head>${meta}</head>${html.slice(at)}`;
  }
  return `${meta}\n${html}`;
}

/** What the viewer puts in the sandboxed iframe's srcdoc: the inlined page
 *  under the no-network policy. */
export function buildWebPageSrcdoc(inlinedHtml: string): string {
  return injectWebPageCsp(inlinedHtml, WEB_PAGE_VIEWER_CSP);
}

/** Base64 grows a file by 4/3 — the size the data URI will weigh. */
export function inlinedWeight(htmlChars: number, fileBytes: number[]): number {
  return fileBytes.reduce((sum, bytes) => sum + Math.ceil((bytes * 4) / 3) + 40, htmlChars);
}
