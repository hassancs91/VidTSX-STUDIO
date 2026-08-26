// What a `.vidtsx` export would contain, decided BEFORE a byte is written
// (Q7b contents policy + Q7c media strategies).
//
// The plan is the single source of truth for both the dialog and the writer:
// the dialog shows per-asset sizes and a total, the writer just walks
// `files`. Nothing here writes — a plan can be recomputed on every strategy
// flip in the dialog without touching the destination.
//
// The policy, in one place:
//   always   project.json (rewritten), shots/, transcripts/, cut-plans/,
//            thumbs/, kit/ (the project's pin), brand.json snapshot
//   media    per the chosen strategy (full / proxies-only / none)
//   opt-in   agent-chat.json AND per-shot chat.json — both are private
//            conversations, so one checkbox governs both
//   never    proxies (except as the proxies-only stand-in), waveforms, renders

import fs from 'fs/promises';
import path from 'path';
import type { StudioAssetKind, StudioProject } from '../../../shared/types/studio';
import {
  PACKAGE_DIRS,
  packageMediaPath,
  type PackageMediaStrategy,
} from '../../../shared/studio/project-package';
import { parseTemplateId } from '../../../shared/studio/caption-pack';
import { getLibraryRoot } from '../library/library-paths';
import { INSTALLED_PACKS_DIR } from './caption-packs';
import { CUT_PLAN_DIR } from './cut-plan-runner';
import { TRANSCRIPT_DIR } from './asset-transcriber';
import { proxyRelPath } from './proxy-generator';
import { getProjectKitPin } from './shot-kit-pin';
import { getProjectCacheDir, getProjectDir } from './studio-paths';

const THUMB_DIR = 'thumbs';

export type PlannedGroup =
  | 'media'
  | 'shot'
  | 'transcript'
  | 'cut-plan'
  | 'thumb'
  | 'kit'
  | 'caption-pack'
  | 'chat'
  | 'extra';

export interface PlannedFile {
  /** Package-relative path (forward slashes). */
  path: string;
  /** Absolute path on this machine. */
  source: string;
  bytes: number;
  /** Already-compressed bytes — deflate would burn CPU for nothing. */
  store: boolean;
  group: PlannedGroup;
}

/** Why an asset's media is not travelling. */
export type PlannedAssetSkip = 'missing' | 'no-proxy' | 'by-strategy';

export interface PlannedAsset {
  assetId: string;
  kind: StudioAssetKind;
  /** Basename on this machine — what the relink prompt on the far side asks for. */
  originalName: string;
  /** Size of the file that would travel (0 when none does). */
  bytes: number;
  /** Size of the ORIGINAL on disk, recorded even when it stays behind. */
  originalBytes: number;
  hash?: string;
  /** Package-relative destination, absent when no media travels. */
  packagePath?: string;
  proxyOnly?: boolean;
  skip?: PlannedAssetSkip;
}

export interface PackagePlan {
  strategy: PackageMediaStrategy;
  includeChat: boolean;
  assets: PlannedAsset[];
  files: PlannedFile[];
  mediaBytes: number;
  /** Everything that is not media — shots, transcripts, plans, kit, thumbs. */
  extrasBytes: number;
  totalBytes: number;
  counts: { assets: number; media: number; shots: number; transcripts: number };
  kitVersion?: string;
  captionPacks: string[];
  /** Honest warnings the dialog shows before the user commits to a write. */
  warnings: string[];
}

async function statSize(filePath: string): Promise<number | null> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() ? stat.size : null;
  } catch {
    return null;
  }
}

/** Media strategy applied to one asset (Q7c). */
async function planAsset(
  asset: StudioProject['assets'][number],
  cacheDir: string,
  strategy: PackageMediaStrategy,
): Promise<{ planned: PlannedAsset; file?: PlannedFile }> {
  const originalName = path.basename(asset.path);
  const onDisk = await statSize(asset.path);
  const base: PlannedAsset = {
    assetId: asset.id,
    kind: asset.kind,
    originalName,
    bytes: 0,
    originalBytes: onDisk ?? 0,
    ...(asset.hash ? { hash: asset.hash } : {}),
  };

  if (strategy === 'none') {
    return { planned: { ...base, skip: 'by-strategy' } };
  }

  if (strategy === 'proxies-only') {
    // Images and audio have no proxy — the original IS the small file, so it
    // travels rather than leaving a hole the far side has to relink.
    if (asset.kind === 'video') {
      const proxyPath = path.join(cacheDir, proxyRelPath(asset.id));
      const proxyBytes = await statSize(proxyPath);
      if (proxyBytes === null) return { planned: { ...base, skip: 'no-proxy' } };
      const packagePath = `${PACKAGE_DIRS.media}/${asset.id}.mp4`;
      return {
        planned: { ...base, bytes: proxyBytes, packagePath, proxyOnly: true },
        file: { path: packagePath, source: proxyPath, bytes: proxyBytes, store: true, group: 'media' },
      };
    }
  }

  if (onDisk === null) return { planned: { ...base, skip: 'missing' } };
  const packagePath = packageMediaPath(asset.id, asset.path);
  return {
    planned: { ...base, bytes: onDisk, packagePath },
    file: { path: packagePath, source: asset.path, bytes: onDisk, store: true, group: 'media' },
  };
}

/** Every file under a folder, package-relative to `prefix`. */
async function planFolder(
  dir: string,
  prefix: string,
  group: PlannedGroup,
  keep?: (name: string) => boolean,
): Promise<PlannedFile[]> {
  const out: PlannedFile[] = [];
  const walk = async (current: string, rel: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      const relPath = rel === '' ? entry.name : `${rel}/${entry.name}`;
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(abs, relPath);
      } else if (entry.isFile() && (!keep || keep(relPath))) {
        const bytes = (await statSize(abs)) ?? 0;
        out.push({ path: `${prefix}/${relPath}`, source: abs, bytes, store: false, group });
      }
    }
  };
  await walk(dir, '');
  return out;
}

/** Shot sources: every version + the pre-conform original. Conversations
 *  (chat.json) ride the same opt-in as the project's agent chat. */
function shotFileFilter(includeChat: boolean): (relPath: string) => boolean {
  return (relPath) => {
    const name = relPath.split('/').pop() ?? '';
    if (/^v\d+\.tsx$/.test(name) || name === 'original.tsx') return true;
    return includeChat && name === 'chat.json';
  };
}

/** The non-core caption pack a project's caption layer references, if any. */
async function planCaptionPack(project: StudioProject): Promise<{ packId: string; dir: string } | null> {
  const templateId = project.captions?.templateId;
  if (!templateId) return null;
  const parsed = parseTemplateId(templateId);
  if (!parsed) return null;
  // Core packs always resolve on the far side — only user-installed packs
  // (library packs/ folder drops) need to travel.
  const dir = path.join(getLibraryRoot(), INSTALLED_PACKS_DIR, parsed.packId);
  try {
    await fs.access(path.join(dir, 'pack.json'));
    return { packId: parsed.packId, dir };
  } catch {
    return null;
  }
}

export interface PlanPackageOptions {
  strategy: PackageMediaStrategy;
  /** Q7b: the private conversations (project + per-shot). Default OFF. */
  includeChat?: boolean;
}

/**
 * Decide the whole package. Reads sizes off disk but writes nothing, so the
 * export dialog can recompute on every strategy flip.
 */
export async function planPackage(
  project: StudioProject,
  options: PlanPackageOptions,
): Promise<PackagePlan> {
  const strategy = options.strategy;
  const includeChat = options.includeChat === true;
  const projectDir = await getProjectDir(project.id);
  const cacheDir = await getProjectCacheDir(project.id);

  const assets: PlannedAsset[] = [];
  const files: PlannedFile[] = [];
  const warnings: string[] = [];

  for (const asset of project.assets) {
    const { planned, file } = await planAsset(asset, cacheDir, strategy);
    assets.push(planned);
    if (file) files.push(file);
  }

  const missing = assets.filter((a) => a.skip === 'missing');
  if (missing.length > 0) {
    warnings.push(
      `${missing.length} asset${missing.length === 1 ? ' is' : 's are'} missing on this machine — ${
        missing.length === 1 ? 'it' : 'they'
      } will need relinking after import.`,
    );
  }
  const noProxy = assets.filter((a) => a.skip === 'no-proxy');
  if (noProxy.length > 0) {
    warnings.push(
      `${noProxy.length} clip${noProxy.length === 1 ? ' has' : 's have'} no proxy yet — open the project and let proxies finish, or export full media.`,
    );
  }
  if (strategy === 'proxies-only') {
    warnings.push('Proxies are 720p stand-ins — the imported project is marked "needs full-res relink".');
  }
  if (strategy === 'none') {
    warnings.push('No media travels — the far side is prompted to locate each file, verified by hash.');
  }

  // Shots (the work) + their conversations under the chat opt-in.
  files.push(
    ...(await planFolder(
      path.join(projectDir, 'shots'),
      PACKAGE_DIRS.shots,
      'shot',
      shotFileFilter(includeChat),
    )),
  );

  // Transcripts cost credits to regenerate — they always ride (Q7b).
  let transcripts = 0;
  for (const asset of project.assets) {
    if (!asset.transcript) continue;
    const source = path.join(cacheDir, TRANSCRIPT_DIR, `${asset.id}.json`);
    const bytes = await statSize(source);
    if (bytes === null) continue;
    transcripts += 1;
    files.push({
      path: `${PACKAGE_DIRS.transcripts}/${asset.id}.json`,
      source,
      bytes,
      store: false,
      group: 'transcript',
    });
  }

  // Cut plans are tiny and cheap insurance; thumbnails are what keeps the
  // imported media pool from looking broken (nothing re-derives them).
  files.push(
    ...(await planFolder(path.join(cacheDir, CUT_PLAN_DIR), PACKAGE_DIRS.cutPlans, 'cut-plan')),
  );
  files.push(...(await planFolder(path.join(cacheDir, THUMB_DIR), PACKAGE_DIRS.thumbs, 'thumb')));

  // Q7f: the project's kit pin travels as-is — folder-as-truth, no new mechanism.
  const kitPin = await getProjectKitPin(project.id);
  if (kitPin) {
    files.push(
      ...(await planFolder(kitPin.dir, `${PACKAGE_DIRS.kit}/${kitPin.version}`, 'kit')),
    );
  }

  const captionPack = await planCaptionPack(project);
  if (captionPack) {
    files.push(
      ...(await planFolder(
        captionPack.dir,
        `${PACKAGE_DIRS.captionPacks}/${captionPack.packId}`,
        'caption-pack',
      )),
    );
  } else if (project.captions?.templateId && !parseTemplateId(project.captions.templateId)) {
    warnings.push('The caption template id is unreadable — captions may not resolve after import.');
  }

  if (includeChat) {
    const chatPath = path.join(projectDir, 'agent-chat.json');
    const bytes = await statSize(chatPath);
    if (bytes !== null) {
      files.push({ path: 'agent-chat.json', source: chatPath, bytes, store: false, group: 'chat' });
    }
  }

  const mediaBytes = files.filter((f) => f.group === 'media').reduce((sum, f) => sum + f.bytes, 0);
  const extrasBytes = files.filter((f) => f.group !== 'media').reduce((sum, f) => sum + f.bytes, 0);

  return {
    strategy,
    includeChat,
    assets,
    files,
    mediaBytes,
    extrasBytes,
    totalBytes: mediaBytes + extrasBytes,
    counts: {
      assets: project.assets.length,
      media: assets.filter((a) => a.packagePath).length,
      shots: project.shots.length,
      transcripts,
    },
    ...(kitPin ? { kitVersion: kitPin.version } : {}),
    captionPacks: captionPack ? [captionPack.packId] : [],
    warnings,
  };
}
