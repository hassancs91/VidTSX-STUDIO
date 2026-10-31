// The generic default cut style (plan T1, B2): reads
// <skills>/studio-clean-cut/cut-style.json once, and resolves a project's cut
// style — per-call style > the project's settings.cutStyle > its preset's
// cut / pacing > the file default — for every main-process consumer (the Auto
// Cut IPC, the agent's run_auto_cut, the editorial snap). The precedence lives
// in the pure resolver (shared/studio/cut-style-resolve.ts); this file only
// does the I/O around it.

import fs from 'fs/promises';
import path from 'path';
import type { StudioProjectSettings } from '../../../shared/types/studio';
import type {
  CutPlanStyleName,
  CutStyleFile,
  ResolvedCutStyle,
} from '../../../shared/types/studio-cut-plan';
import type { StudioPreset } from '../../../shared/types/studio-preset';
import { CUT_PLAN_STYLE_NAMES } from '../../../shared/types/studio-cut-plan';
import { isCutPlanStyleName, parseCutStyleFile } from '../../../shared/studio/cut-style-spec';
import { resolveCutStyle } from '../../../shared/studio/cut-style-resolve';
import { logEngine } from '../../../logging/log-engine';
import { getSkillsDir } from '../../utils/paths';
import { getLibraryRoot } from '../library/library-paths';
import { readPreset } from '../library/preset-store';
import { loadProject } from './project-store';

const log = logEngine.createLogger('CutStyle');

export const CUT_STYLE_SKILL_ID = 'studio-clean-cut';
export const CUT_STYLE_FILE_NAME = 'cut-style.json';

/** The project settings the resolver reads. */
export type CutStyleSettings = Pick<StudioProjectSettings, 'presetId' | 'cutStyle'>;

export interface ResolveProjectCutStyleOptions {
  /** An explicit style (the agent's `run_auto_cut({ style })`) — wins over everything. */
  callStyle?: CutPlanStyleName;
  /** The live document's settings; absent = the project.json on disk. */
  settings?: CutStyleSettings;
}

let cached: Promise<CutStyleFile> | null = null;

export function cutStyleFilePath(): string {
  return path.join(getSkillsDir(), CUT_STYLE_SKILL_ID, CUT_STYLE_FILE_NAME);
}

async function readCutStyleFile(): Promise<CutStyleFile> {
  const file = cutStyleFilePath();
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf-8');
  } catch (err) {
    throw new Error(`The default cut style is missing (${file}): ${String(err)}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`cut-style.json: not valid JSON (${file})`);
  }
  return parseCutStyleFile(json);
}

/** The shipped file, parsed once per run (read-only data). A failed read is retried next call. */
export function loadCutStyleFile(): Promise<CutStyleFile> {
  if (!cached) {
    const pending = readCutStyleFile();
    cached = pending;
    pending.catch((err: unknown) => {
      log.error('Default cut style unreadable', err);
      if (cached === pending) cached = null;
    });
  }
  return cached;
}

/** Tests only: forget the parsed file. */
export function resetCutStyleCache(): void {
  cached = null;
}

async function readSettings(projectId: string): Promise<CutStyleSettings | undefined> {
  try {
    return (await loadProject(projectId)).settings;
  } catch (err) {
    log.warn('Project unreadable — cut style resolves without it', { projectId, error: String(err) });
    return undefined;
  }
}

/** The project's preset, or null for none / a stale id / an unreadable one. */
async function readProjectPreset(presetId: string | undefined): Promise<StudioPreset | null> {
  if (!presetId) return null;
  try {
    return await readPreset(getLibraryRoot(), presetId);
  } catch (err) {
    log.warn('Project preset unreadable — cut style resolves without it', { presetId, error: String(err) });
    return null;
  }
}

/** What every main-process consumer snaps with for this project. */
export async function resolveProjectCutStyle(
  projectId: string,
  opts: ResolveProjectCutStyleOptions = {},
): Promise<ResolvedCutStyle> {
  const file = await loadCutStyleFile();
  if (opts.callStyle !== undefined) {
    // An explicit style is the top rung — a name the file does not have must
    // not quietly become the file default (verifier B2 round 1): refuse it.
    if (!isCutPlanStyleName(opts.callStyle)) {
      throw new Error(`Unknown cut style "${String(opts.callStyle)}" — use ${CUT_PLAN_STYLE_NAMES.join(', ')}, or omit it for the project's style.`);
    }
    return resolveCutStyle(file, { callStyle: opts.callStyle });
  }
  const settings = opts.settings ?? (await readSettings(projectId));
  const preset = await readProjectPreset(settings?.presetId);
  return resolveCutStyle(file, { project: settings ? { settings } : null, preset });
}
