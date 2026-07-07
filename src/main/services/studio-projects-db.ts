import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import type {
  StudioProjectData,
  StudioProjectCaptions,
  StudioComposition,
  StudioImport,
  StudioVideoClip,
  StudioAudioClip,
  StudioImageClip,
  StudioTextClip,
  StudioAnalysisJson,
  StudioCutPlan,
  StudioTimelinePrefs,
  StudioPanelLayout,
  TsxSuggestion,
  TsxSlot,
  VideoMetadata,
} from '../../shared/ipc/types';
import { DEFAULT_STUDIO_COMPOSITION } from '../../shared/ipc/types';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('studio-projects-db');

let db: Database.Database | null = null;

export function getStudioProjectsDir(): string {
  return path.join(app.getPath('userData'), 'studio-projects');
}

function getDbPath(): string {
  return path.join(getStudioProjectsDir(), 'studio.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getStudioProjectsDir(), { recursive: true });
  } catch {
    // Best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      composition_width INTEGER NOT NULL,
      composition_height INTEGER NOT NULL,
      composition_fps REAL NOT NULL,
      composition_duration_in_frames INTEGER NOT NULL,
      composition_duration_in_seconds REAL NOT NULL,
      video_path TEXT,
      duration_in_seconds REAL,
      duration_in_frames INTEGER,
      width INTEGER,
      height INTEGER,
      fps REAL,
      codec TEXT,
      file_size INTEGER,
      file_name TEXT,
      file_path TEXT,
      captions TEXT,
      tsx_suggestions TEXT,
      tsx_slots TEXT,
      imports TEXT,
      video_clips TEXT,
      audio_clips TEXT,
      image_clips TEXT,
      text_clips TEXT,
      brand TEXT,
      analysis TEXT,
      cut_plan TEXT,
      brand_id TEXT,
      preset_ids TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_studio_projects_updated_at ON studio_projects(updated_at DESC);
  `);

  migrateSchemaIfNeeded(db);

  return db;
}

// Schema migrations keyed by PRAGMA user_version.
// v0 (unset) → original schema with required video columns
// v2         → composition columns + nullable video columns
// v3         → imports TEXT column
// v4         → video_clips TEXT column
// v5         → brand + analysis + cut_plan TEXT columns (auto-cut feature)
// v6         → brand_id + preset_ids TEXT columns (library-driven AI inputs)
// v7         → audio_clips + image_clips TEXT columns (SFX/Music + Image tracks)
// v8         → text_clips TEXT column (Text track)
// v9         → timeline_prefs TEXT column (per-project timeline view toggles)
// v10        → layout TEXT column (per-project saved panel sizes)
function migrateSchemaIfNeeded(database: Database.Database): void {
  const version = database.pragma('user_version', { simple: true }) as number;

  if (version >= 10) return;

  const cols = database
    .prepare(`PRAGMA table_info(studio_projects)`)
    .all() as { name: string; notnull: number }[];
  const colNames = new Set(cols.map((c) => c.name));
  const hasCompositionWidth = colNames.has('composition_width');
  const videoPathCol = cols.find((c) => c.name === 'video_path');
  const videoPathRequired = videoPathCol?.notnull === 1;
  const hasImports = colNames.has('imports');

  // ── v0 → v2 (composition + nullable video) ──
  if (!hasCompositionWidth || videoPathRequired) {
    log.info('Migrating studio_projects table to v2 (composition + optional video)');
    database.exec('BEGIN');
    try {
      database.exec(`
        CREATE TABLE studio_projects_v2 (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          composition_width INTEGER NOT NULL,
          composition_height INTEGER NOT NULL,
          composition_fps REAL NOT NULL,
          composition_duration_in_frames INTEGER NOT NULL,
          composition_duration_in_seconds REAL NOT NULL,
          video_path TEXT,
          duration_in_seconds REAL,
          duration_in_frames INTEGER,
          width INTEGER,
          height INTEGER,
          fps REAL,
          codec TEXT,
          file_size INTEGER,
          file_name TEXT,
          file_path TEXT,
          captions TEXT,
          tsx_suggestions TEXT,
          tsx_slots TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        INSERT INTO studio_projects_v2 (
          id, name,
          composition_width, composition_height, composition_fps,
          composition_duration_in_frames, composition_duration_in_seconds,
          video_path,
          duration_in_seconds, duration_in_frames,
          width, height, fps, codec,
          file_size, file_name, file_path,
          captions, tsx_suggestions, tsx_slots,
          created_at, updated_at
        )
        SELECT
          id, name,
          width, height, fps,
          duration_in_frames, duration_in_seconds,
          video_path,
          duration_in_seconds, duration_in_frames,
          width, height, fps, codec,
          file_size, file_name, file_path,
          captions, tsx_suggestions, tsx_slots,
          created_at, updated_at
        FROM studio_projects;

        DROP TABLE studio_projects;
        ALTER TABLE studio_projects_v2 RENAME TO studio_projects;
        CREATE INDEX IF NOT EXISTS idx_studio_projects_updated_at ON studio_projects(updated_at DESC);
      `);
      database.pragma('user_version = 2');
      database.exec('COMMIT');
      log.info('studio_projects migration to v2 complete');
    } catch (err) {
      database.exec('ROLLBACK');
      log.error('Failed to migrate studio_projects to v2', err);
      throw err;
    }
  }

  // ── v2 → v3 (add imports column) ──
  if (!hasImports) {
    // Re-check after potential v2 migration; safe to ALTER if missing.
    const colsAfter = database
      .prepare(`PRAGMA table_info(studio_projects)`)
      .all() as { name: string }[];
    if (!colsAfter.some((c) => c.name === 'imports')) {
      log.info('Migrating studio_projects table to v3 (imports column)');
      database.exec(`ALTER TABLE studio_projects ADD COLUMN imports TEXT`);
    }
  }

  // ── v3 → v4 (add video_clips column) ──
  const colsForV4 = database
    .prepare(`PRAGMA table_info(studio_projects)`)
    .all() as { name: string }[];
  if (!colsForV4.some((c) => c.name === 'video_clips')) {
    log.info('Migrating studio_projects table to v4 (video_clips column)');
    database.exec(`ALTER TABLE studio_projects ADD COLUMN video_clips TEXT`);
  }

  // ── v4 → v5 (add brand + analysis + cut_plan columns) ──
  const colsForV5 = database
    .prepare(`PRAGMA table_info(studio_projects)`)
    .all() as { name: string }[];
  const v5Names = new Set(colsForV5.map((c) => c.name));
  if (!v5Names.has('brand')) {
    log.info('Migrating studio_projects table to v5 (brand column)');
    database.exec(`ALTER TABLE studio_projects ADD COLUMN brand TEXT`);
  }
  if (!v5Names.has('analysis')) {
    log.info('Migrating studio_projects table to v5 (analysis column)');
    database.exec(`ALTER TABLE studio_projects ADD COLUMN analysis TEXT`);
  }
  if (!v5Names.has('cut_plan')) {
    log.info('Migrating studio_projects table to v5 (cut_plan column)');
    database.exec(`ALTER TABLE studio_projects ADD COLUMN cut_plan TEXT`);
  }

  // ── v5 → v6 (add brand_id + preset_ids columns) ──
  const colsForV6 = database
    .prepare(`PRAGMA table_info(studio_projects)`)
    .all() as { name: string }[];
  const v6Names = new Set(colsForV6.map((c) => c.name));
  if (!v6Names.has('brand_id')) {
    log.info('Migrating studio_projects table to v6 (brand_id column)');
    database.exec(`ALTER TABLE studio_projects ADD COLUMN brand_id TEXT`);
  }
  if (!v6Names.has('preset_ids')) {
    log.info('Migrating studio_projects table to v6 (preset_ids column)');
    database.exec(`ALTER TABLE studio_projects ADD COLUMN preset_ids TEXT`);
  }

  // ── v6 → v7 (add audio_clips + image_clips columns) ──
  const colsForV7 = database
    .prepare(`PRAGMA table_info(studio_projects)`)
    .all() as { name: string }[];
  const v7Names = new Set(colsForV7.map((c) => c.name));
  if (!v7Names.has('audio_clips')) {
    log.info('Migrating studio_projects table to v7 (audio_clips column)');
    database.exec(`ALTER TABLE studio_projects ADD COLUMN audio_clips TEXT`);
  }
  if (!v7Names.has('image_clips')) {
    log.info('Migrating studio_projects table to v7 (image_clips column)');
    database.exec(`ALTER TABLE studio_projects ADD COLUMN image_clips TEXT`);
  }

  // ── v7 → v8 (add text_clips column) ──
  const colsForV8 = database
    .prepare(`PRAGMA table_info(studio_projects)`)
    .all() as { name: string }[];
  if (!colsForV8.some((c) => c.name === 'text_clips')) {
    log.info('Migrating studio_projects table to v8 (text_clips column)');
    database.exec(`ALTER TABLE studio_projects ADD COLUMN text_clips TEXT`);
  }

  // ── v8 → v9 (add timeline_prefs column) ──
  const colsForV9 = database
    .prepare(`PRAGMA table_info(studio_projects)`)
    .all() as { name: string }[];
  if (!colsForV9.some((c) => c.name === 'timeline_prefs')) {
    log.info('Migrating studio_projects table to v9 (timeline_prefs column)');
    database.exec(`ALTER TABLE studio_projects ADD COLUMN timeline_prefs TEXT`);
  }

  // ── v9 → v10 (add layout column) ──
  const colsForV10 = database
    .prepare(`PRAGMA table_info(studio_projects)`)
    .all() as { name: string }[];
  if (!colsForV10.some((c) => c.name === 'layout')) {
    log.info('Migrating studio_projects table to v10 (layout column)');
    database.exec(`ALTER TABLE studio_projects ADD COLUMN layout TEXT`);
  }

  database.pragma('user_version = 10');
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close studio-projects DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

// --- Row mapper ---

interface ProjectRow {
  id: string;
  name: string;
  composition_width: number;
  composition_height: number;
  composition_fps: number;
  composition_duration_in_frames: number;
  composition_duration_in_seconds: number;
  video_path: string | null;
  duration_in_seconds: number | null;
  duration_in_frames: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  codec: string | null;
  file_size: number | null;
  file_name: string | null;
  file_path: string | null;
  captions: string | null;
  tsx_suggestions: string | null;
  tsx_slots: string | null;
  imports: string | null;
  video_clips: string | null;
  audio_clips: string | null;
  image_clips: string | null;
  text_clips: string | null;
  brand: string | null;
  analysis: string | null;
  cut_plan: string | null;
  brand_id: string | null;
  preset_ids: string | null;
  timeline_prefs: string | null;
  layout: string | null;
  created_at: number;
  updated_at: number;
}

function parseJsonOrUndefined<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function rowToProject(row: ProjectRow): StudioProjectData {
  const composition: StudioComposition = {
    width: row.composition_width,
    height: row.composition_height,
    fps: row.composition_fps,
    durationInFrames: row.composition_duration_in_frames,
    durationInSeconds: row.composition_duration_in_seconds,
  };

  const hasVideo =
    row.video_path !== null &&
    row.width !== null &&
    row.height !== null &&
    row.fps !== null &&
    row.duration_in_seconds !== null &&
    row.duration_in_frames !== null;

  const metadata: VideoMetadata | undefined = hasVideo
    ? {
        durationInSeconds: row.duration_in_seconds as number,
        durationInFrames: row.duration_in_frames as number,
        width: row.width as number,
        height: row.height as number,
        fps: row.fps as number,
        codec: row.codec ?? 'unknown',
        fileSize: row.file_size ?? 0,
        fileName: row.file_name ?? '',
        filePath: row.file_path ?? (row.video_path as string),
      }
    : undefined;

  return {
    id: row.id,
    name: row.name,
    composition,
    videoPath: row.video_path ?? undefined,
    metadata,
    captions: parseJsonOrUndefined<StudioProjectCaptions>(row.captions),
    tsxSuggestions: parseJsonOrUndefined<TsxSuggestion[]>(row.tsx_suggestions),
    tsxSlots: parseJsonOrUndefined<TsxSlot[]>(row.tsx_slots),
    imports: parseJsonOrUndefined<StudioImport[]>(row.imports),
    videoClips: parseJsonOrUndefined<StudioVideoClip[]>(row.video_clips),
    audioClips: parseJsonOrUndefined<StudioAudioClip[]>(row.audio_clips),
    imageClips: parseJsonOrUndefined<StudioImageClip[]>(row.image_clips),
    textClips: parseJsonOrUndefined<StudioTextClip[]>(row.text_clips),
    brand: row.brand ?? undefined,
    analysis: parseJsonOrUndefined<StudioAnalysisJson>(row.analysis),
    cutPlan: parseJsonOrUndefined<StudioCutPlan>(row.cut_plan),
    brandId: row.brand_id ?? undefined,
    presetIds: parseJsonOrUndefined<string[]>(row.preset_ids),
    timelinePrefs: parseJsonOrUndefined<StudioTimelinePrefs>(row.timeline_prefs),
    layout: parseJsonOrUndefined<StudioPanelLayout>(row.layout),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- CRUD ---

export async function listProjects(): Promise<StudioProjectData[]> {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM studio_projects ORDER BY updated_at DESC')
    .all() as ProjectRow[];
  return rows.map(rowToProject);
}

export async function saveProject(project: StudioProjectData): Promise<void> {
  const database = getDb();
  const composition = project.composition ?? DEFAULT_STUDIO_COMPOSITION;
  const m = project.metadata;
  database
    .prepare(
      `INSERT INTO studio_projects
         (id, name,
          composition_width, composition_height, composition_fps,
          composition_duration_in_frames, composition_duration_in_seconds,
          video_path,
          duration_in_seconds, duration_in_frames, width, height, fps, codec,
          file_size, file_name, file_path,
          captions, tsx_suggestions, tsx_slots, imports, video_clips,
          audio_clips, image_clips, text_clips,
          brand, analysis, cut_plan,
          brand_id, preset_ids, timeline_prefs, layout,
          created_at, updated_at)
       VALUES
         (@id, @name,
          @compositionWidth, @compositionHeight, @compositionFps,
          @compositionDurationInFrames, @compositionDurationInSeconds,
          @videoPath,
          @durationInSeconds, @durationInFrames, @width, @height, @fps, @codec,
          @fileSize, @fileName, @filePath,
          @captions, @tsxSuggestions, @tsxSlots, @imports, @videoClips,
          @audioClips, @imageClips, @textClips,
          @brand, @analysis, @cutPlan,
          @brandId, @presetIds, @timelinePrefs, @layout,
          @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         composition_width = excluded.composition_width,
         composition_height = excluded.composition_height,
         composition_fps = excluded.composition_fps,
         composition_duration_in_frames = excluded.composition_duration_in_frames,
         composition_duration_in_seconds = excluded.composition_duration_in_seconds,
         video_path = excluded.video_path,
         duration_in_seconds = excluded.duration_in_seconds,
         duration_in_frames = excluded.duration_in_frames,
         width = excluded.width,
         height = excluded.height,
         fps = excluded.fps,
         codec = excluded.codec,
         file_size = excluded.file_size,
         file_name = excluded.file_name,
         file_path = excluded.file_path,
         captions = excluded.captions,
         tsx_suggestions = excluded.tsx_suggestions,
         tsx_slots = excluded.tsx_slots,
         imports = excluded.imports,
         video_clips = excluded.video_clips,
         audio_clips = excluded.audio_clips,
         image_clips = excluded.image_clips,
         text_clips = excluded.text_clips,
         brand = excluded.brand,
         analysis = excluded.analysis,
         cut_plan = excluded.cut_plan,
         brand_id = excluded.brand_id,
         preset_ids = excluded.preset_ids,
         timeline_prefs = excluded.timeline_prefs,
         layout = excluded.layout,
         updated_at = excluded.updated_at`
    )
    .run({
      id: project.id,
      name: project.name,
      compositionWidth: composition.width,
      compositionHeight: composition.height,
      compositionFps: composition.fps,
      compositionDurationInFrames: composition.durationInFrames,
      compositionDurationInSeconds: composition.durationInSeconds,
      videoPath: project.videoPath ?? null,
      durationInSeconds: m?.durationInSeconds ?? null,
      durationInFrames: m?.durationInFrames ?? null,
      width: m?.width ?? null,
      height: m?.height ?? null,
      fps: m?.fps ?? null,
      codec: m?.codec ?? null,
      fileSize: m?.fileSize ?? null,
      fileName: m?.fileName ?? null,
      filePath: m?.filePath ?? null,
      captions: project.captions ? JSON.stringify(project.captions) : null,
      tsxSuggestions: project.tsxSuggestions ? JSON.stringify(project.tsxSuggestions) : null,
      tsxSlots: project.tsxSlots ? JSON.stringify(project.tsxSlots) : null,
      imports: project.imports ? JSON.stringify(project.imports) : null,
      videoClips: project.videoClips ? JSON.stringify(project.videoClips) : null,
      audioClips: project.audioClips ? JSON.stringify(project.audioClips) : null,
      imageClips: project.imageClips ? JSON.stringify(project.imageClips) : null,
      textClips: project.textClips ? JSON.stringify(project.textClips) : null,
      brand: project.brand ?? null,
      analysis: project.analysis ? JSON.stringify(project.analysis) : null,
      cutPlan: project.cutPlan ? JSON.stringify(project.cutPlan) : null,
      brandId: project.brandId ?? null,
      presetIds: project.presetIds && project.presetIds.length > 0 ? JSON.stringify(project.presetIds) : null,
      timelinePrefs: project.timelinePrefs ? JSON.stringify(project.timelinePrefs) : null,
      layout: project.layout ? JSON.stringify(project.layout) : null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
}

export async function loadProject(id: string): Promise<StudioProjectData | null> {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM studio_projects WHERE id = ?')
    .get(id) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export async function deleteProject(id: string): Promise<void> {
  const database = getDb();
  database.prepare('DELETE FROM studio_projects WHERE id = ?').run(id);
}
