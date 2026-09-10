// Writing a web page artifact out as a site folder — `index.html` plus
// `assets/` — and optionally the same as a zip (W9, `export_site`).
//
// Two targets, one writer. The EXPORT lands in the session's library output
// folder (§1.11 — beside the media the session generated) as a fresh
// `site-<slug>` folder plus `site-<slug>.zip`; the BROWSER PREVIEW lands in
// the session workspace and is overwritten per page version. Both are inside
// folders the app owns; the destination is never a path from the model.

import fs from 'fs/promises';
import path from 'path';
import type { AgentArtifact, ArtifactOfKind } from '../../../shared/types/agents';
import { WEB_PAGE_EXPORT_CSP, injectWebPageCsp } from '../../../shared/agents/web-page';
import { ensureLibraryRoot, resolveLibraryPath } from '../library/library-paths';
import { GENERATED_FOLDER, sanitizeFolder, slugify } from '../library/library-filing';
import { PackageZipWriter } from '../studio/project-package-zip';
import { loadWebPage, rewriteRefsForExport, type ResolvedWebPageRef } from './web-page-refs';
import { agentWorkspaceDir } from './agent-sessions';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('WebPageExport');

export const SITE_INDEX = 'index.html';
export const SITE_ASSETS_DIR = 'assets';

export interface SiteExportResult {
  dir: string;
  indexPath: string;
  zipPath?: string;
  /** Files written, relative to `dir`. */
  files: string[];
  /** References that no longer resolved and were left as written. */
  problems: string[];
}

/** The exported document: references → `assets/<name>`, under the export CSP. */
export function buildSiteIndex(html: string, resolved: ResolvedWebPageRef[]): string {
  return injectWebPageCsp(rewriteRefsForExport(html, resolved), WEB_PAGE_EXPORT_CSP);
}

async function writeSiteFolder(dir: string, index: string, resolved: ResolvedWebPageRef[]): Promise<string[]> {
  await fs.mkdir(path.join(dir, SITE_ASSETS_DIR), { recursive: true });
  await fs.writeFile(path.join(dir, SITE_INDEX), index, 'utf-8');
  const files = [SITE_INDEX];
  for (const ref of resolved) {
    const rel = `${SITE_ASSETS_DIR}/${ref.assetName}`;
    await fs.copyFile(ref.absPath, path.join(dir, SITE_ASSETS_DIR, ref.assetName));
    files.push(rel);
  }
  return files;
}

/** Media is stored, not deflated — the `.vidtsx` writer's own rule. */
async function writeSiteZip(zipPath: string, index: string, resolved: ResolvedWebPageRef[]): Promise<void> {
  const zip = new PackageZipWriter(zipPath);
  try {
    await zip.addBuffer(SITE_INDEX, Buffer.from(index, 'utf-8'));
    for (const ref of resolved) {
      await zip.addFile(`${SITE_ASSETS_DIR}/${ref.assetName}`, ref.absPath, true);
    }
    await zip.finish();
  } catch (err) {
    zip.abort();
    await fs.unlink(zipPath).catch(() => {});
    throw err;
  }
}

/** Claim `<base>`, then `<base>-2`, … by `mkdir` failing, never by stat-then-create. */
async function reserveFolder(parent: string, base: string): Promise<string> {
  await fs.mkdir(parent, { recursive: true });
  let name = base;
  for (let n = 2; n < 1000; n += 1) {
    try {
      await fs.mkdir(path.join(parent, name), { recursive: false });
      return path.join(parent, name);
    } catch {
      name = `${base}-${n}`;
    }
  }
  throw new Error(`Could not find a free folder name for ${base}`);
}

export interface ExportSiteInput {
  agentId: string;
  sessionId: string;
  artifacts: AgentArtifact[];
  artifact: ArtifactOfKind<'web-page'>;
  /** Library-relative folder this session files into (§1.11). */
  libraryFolder?: string;
}

/** The real export: a fresh `site-<slug>` folder plus its zip, in the
 *  session's library output folder. */
export async function exportWebSite(input: ExportSiteInput): Promise<SiteExportResult> {
  const page = await loadWebPage(input.agentId, input.sessionId, input.artifacts, input.artifact);
  const index = buildSiteIndex(page.html, page.resolved);
  const root = await ensureLibraryRoot();
  const parent = resolveLibraryPath(root, sanitizeFolder(input.libraryFolder, GENERATED_FOLDER));
  const dir = await reserveFolder(parent, `site-${slugify(input.artifact.title, 'page')}`);
  const files = await writeSiteFolder(dir, index, page.resolved);
  const zipPath = `${dir}.zip`;
  await writeSiteZip(zipPath, index, page.resolved);
  log.info('Site exported', { dir, files: files.length, zipPath });
  return { dir, indexPath: path.join(dir, SITE_INDEX), zipPath, files, problems: page.problems };
}

/** The browser preview: `<workspace>/preview/<id>-v<n>/`, rewritten each time. */
export async function writeWebSitePreview(input: ExportSiteInput): Promise<SiteExportResult> {
  const page = await loadWebPage(input.agentId, input.sessionId, input.artifacts, input.artifact);
  const index = buildSiteIndex(page.html, page.resolved);
  const dir = path.join(
    agentWorkspaceDir(input.agentId, input.sessionId),
    'preview',
    `${input.artifact.id}-v${input.artifact.version ?? 1}`,
  );
  await fs.rm(dir, { recursive: true, force: true });
  const files = await writeSiteFolder(dir, index, page.resolved);
  return { dir, indexPath: path.join(dir, SITE_INDEX), files, problems: page.problems };
}
