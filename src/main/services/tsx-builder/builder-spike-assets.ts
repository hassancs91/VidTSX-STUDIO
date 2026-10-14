// The assets probe for builder-spike.ts (P2 part 4, no model): each source is
// a folder (index.tsx + assets/) that goes through `check` and every look the
// builder has — stills, contact sheet, phone view, the loop seam (loops) and
// purity_check (3D) — rendered with the build's `assets` prop. A source that
// must fail `check` (a missing file, a Draco model) passes when the error says
// so. A passing source is then saved as a version (`vN.assets/`) and played the
// two other ways a saved version is: the Creator preview's files (the module
// server's asset-root URLs, fetched and compared byte for byte) and an export
// (renderTsxToMp4: the flows path, which maps vN.assets like the Render button).
// Everything stays in `<outDir>/assets/<name>/` to look at.

import fs from 'fs/promises';
import path from 'path';
import { checkBuild } from './build-check';
import { ASSETS_DIR, assetKeyMap } from './build-assets';
import { renderBuildStills } from './build-stills';
import { measureFramePurity, measureLoopSeam, renderContactSheet, renderPhoneView } from './build-looks';
import { describePurity } from './frame-purity';
import { isWebGlBuild } from './builder-tool-common';
import { createRunDirs, saveBuildVersion } from './build-store';
import { versionAssetFiles, versionAssetsProp } from './version-assets';
import { ensureModuleServer, getModuleServerBaseUrl } from '../module-server';
import { renderTsxToMp4 } from '../media/remotion-render';
import { renderStill } from '@remotion/renderer';
import { contactSheetSource } from './contact-sheet';
import { prepareBuildRender, type BuildAssetSource } from './build-stills';
import type { CompositionConfig } from '../composition-config-parser';
import { getRemotionBinariesDir } from '../../utils/paths';

export interface AssetsSource {
  name: string;
  /** A folder with index.tsx and assets/. */
  path: string;
  /** 'ok': passes check and renders; 'check-fails': check must fail with `error` in a message; 'observe': report only. */
  expect: 'ok' | 'check-fails' | 'observe';
  error?: string;
  frames?: number[];
  loop?: boolean;
  purity?: boolean;
  /** Export this many frames through the export path (default none). */
  exportFrames?: number;
  /** Debug: render the contact sheet once more with the page's console captured (30 s timeout). */
  debugSheet?: boolean;
  /** Debug: only that sheet, no other look, no version. */
  sheetOnly?: boolean;
  /** The contact sheet's tiles: default as the tool picks them (a WebGL piece: separate). P3 part 1 forces 'mounted' to show the old crash. */
  sheetTiles?: 'mounted' | 'separate';
}

/** The contact sheet of `frames`, one still, with every browser log line kept in `<dir>/browser.log`. */
async function debugSheet(code: string, config: CompositionConfig, dir: string, frames: number[], assets: BuildAssetSource): Promise<Record<string, unknown>> {
  await fs.mkdir(dir, { recursive: true });
  const sheet = contactSheetSource(code, config, frames);
  const prepared = await prepareBuildRender(sheet.code, sheet.config, dir, { entryName: 'contact-sheet.tsx', assets });
  const lines: string[] = [];
  const started = Date.now();
  try {
    await renderStill({
      composition: prepared.composition,
      serveUrl: prepared.serveUrl,
      output: path.join(dir, 'sheet-debug.png'),
      frame: 0,
      inputProps: prepared.inputProps,
      chromiumOptions: { disableWebSecurity: true, gl: prepared.gl },
      timeoutInMilliseconds: 30_000,
      binariesDirectory: getRemotionBinariesDir() ?? undefined,
      onBrowserLog: (log) => lines.push(`${Date.now() - started}ms [${log.type}] ${log.text}`),
    });
    return { ok: true, ms: Date.now() - started, logLines: lines.length };
  } catch (err) {
    return { ok: false, error: errorText(err), ms: Date.now() - started, logLines: lines.length };
  } finally {
    await fs.writeFile(path.join(dir, 'browser.log'), lines.join('\n'), 'utf-8');
  }
}

export interface AssetsRequest {
  mode: 'assets';
  outDir: string;
  sources: AssetsSource[];
  quit?: boolean;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: string; ms: number }> {
  const started = Date.now();
  try {
    return { value: await fn(), ms: Date.now() - started };
  } catch (err) {
    return { error: errorText(err), ms: Date.now() - started };
  }
}

/** The Creator preview's view of a saved version: every asset URL on the module server, fetched. */
async function previewFiles(tsxPath: string): Promise<Record<string, unknown>> {
  await ensureModuleServer();
  const base = getModuleServerBaseUrl();
  if (!base) return { ok: false, error: 'no module server' };
  const prop = (await versionAssetsProp(tsxPath, base)) ?? {};
  const files = await versionAssetFiles(tsxPath);
  const fetched: Array<Record<string, unknown>> = [];
  for (const f of files) {
    const url = prop[f.key];
    if (!url || !f.path) {
      fetched.push({ key: f.key, ok: false, error: 'not found on disk' });
      continue;
    }
    const res = await fetch(url);
    const bytes = Buffer.from(await res.arrayBuffer());
    const disk = await fs.readFile(f.path);
    fetched.push({ key: f.key, url, status: res.status, type: res.headers.get('content-type'), ok: res.ok && bytes.equals(disk), bytes: bytes.length });
  }
  return { ok: fetched.every((f) => f.ok === true), files: fetched };
}

export async function assetsProbe(outDir: string, sources: AssetsSource[]): Promise<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  for (const source of sources) {
    const dir = path.join(outDir, 'assets', source.name);
    const workDir = path.join(dir, 'work');
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    await fs.cp(source.path, workDir, { recursive: true });

    const check = await checkBuild(workDir);
    const record: Record<string, unknown> = {
      name: source.name,
      expect: source.expect,
      check: {
        ok: check.ok,
        errors: check.errors,
        ms: check.ms,
        bytes: check.code?.length ?? 0,
        inlinedPackages: check.inlinedPackages,
        assets: check.assets.map((a) => `${a.relPath} (${a.kind}, ${a.bytes} B)`),
      },
    };
    results.push(record);
    if (source.expect === 'check-fails') {
      record.pass = !check.ok && check.errors.some((e) => e.includes(source.error ?? ''));
      continue;
    }
    if (!check.ok || !check.code || !check.config) {
      record.pass = source.expect === 'observe';
      continue;
    }
    const { code, config } = check;
    const assets = { dir: path.join(workDir, ASSETS_DIR), keys: assetKeyMap(check.assets) };
    const last = config.durationInFrames - 1;
    const frames = source.frames ?? [0, Math.round(last / 3), Math.round((2 * last) / 3), last];
    const looks: Record<string, unknown> = {};
    if (source.sheetOnly) {
      looks.debugSheet = await debugSheet(code, config, path.join(dir, 'sheet-debug'), frames, assets);
      record.looks = looks;
      record.pass = (looks.debugSheet as { ok?: boolean }).ok === true;
      continue;
    }

    const stills = await timed(() => renderBuildStills(code, config, path.join(dir, 'stills'), frames, { label: 'still', assets }));
    looks.stills = stills.value
      ? { ms: stills.value.ms, gl: stills.value.gl, paths: stills.value.stills.map((s) => s.path) }
      : { error: stills.error };
    const separateTiles = source.sheetTiles ? source.sheetTiles === 'separate' : isWebGlBuild(check.inlinedPackages);
    const sheet = await timed(() => renderContactSheet(code, config, path.join(dir, 'sheet'), frames, { label: 'sheet', assets, separateTiles }));
    looks.sheet = sheet.value
      ? { ms: sheet.value.ms, tiles: sheet.value.tiles, grid: `${sheet.value.layout.cols}x${sheet.value.layout.rows}`, path: sheet.value.path }
      : { error: sheet.error, tiles: separateTiles ? 'separate' : 'mounted' };
    const phone = await timed(() => renderPhoneView(code, config, path.join(dir, 'phone'), frames[1] ?? 0, { label: 'phone', assets }));
    looks.phone = phone.value ? { ms: phone.value.ms, path: phone.value.path } : { error: phone.error };
    if (source.loop) {
      const seam = await timed(() => measureLoopSeam(code, config, path.join(dir, 'seam'), { label: 'seam', assets }));
      looks.seam = seam.value ? { jump: seam.value.jump, wrap: seam.value.wrap, neighbours: seam.value.neighbours, ms: seam.ms } : { error: seam.error };
    }
    if (source.purity) {
      const purity = await timed(() => measureFramePurity(code, config, path.join(dir, 'purity'), { label: 'purity', assets }));
      looks.purity = purity.value
        ? { pure: purity.value.pure, frames: purity.value.frames, ms: purity.value.ms, reply: describePurity(purity.value, purity.value.scale) }
        : { error: purity.error };
    }
    if (source.debugSheet) looks.debugSheet = await debugSheet(code, config, path.join(dir, 'sheet-debug'), frames, assets);
    record.looks = looks;

    // Saved as a version, then played the other two ways.
    const run = await createRunDirs(path.join(dir, 'runs'));
    await fs.cp(workDir, run.workDir, { recursive: true });
    const saved = await saveBuildVersion({
      target: { parentDir: path.join(dir, 'projects'), name: source.name },
      code,
      dirs: run,
      stills: [],
      debug: { kind: 'tsx-builder', probe: 'assets' },
    });
    record.version = { tsxPath: saved.version.tsxPath, assetsDir: saved.version.assetsDir ?? null };
    record.preview = await previewFiles(saved.version.tsxPath).catch((err: unknown) => ({ ok: false, error: errorText(err) }));
    if (source.exportFrames) {
      const outputPath = path.join(dir, `export-${source.exportFrames}f.mp4`);
      const exported = await timed(() =>
        renderTsxToMp4({ entryPath: saved.version.tsxPath, outputPath, compositionId: config.id, durationInFrames: source.exportFrames }),
      );
      record.export = exported.value ? { ok: true, outputPath, fileSize: exported.value.fileSize, ms: exported.ms } : { ok: false, error: exported.error, ms: exported.ms };
    }

    const looksOk =
      !stills.error &&
      !sheet.error &&
      !phone.error &&
      (!source.loop || (looks.seam as { jump?: boolean }).jump === false) &&
      (!source.purity || (looks.purity as { pure?: boolean }).pure === true);
    const previewOk = (record.preview as { ok?: boolean }).ok === true;
    const exportOk = !source.exportFrames || (record.export as { ok?: boolean }).ok === true;
    record.pass = source.expect === 'observe' ? true : looksOk && previewOk && exportOk;
  }
  return { mode: 'assets', pass: results.every((r) => r.pass === true), results };
}
