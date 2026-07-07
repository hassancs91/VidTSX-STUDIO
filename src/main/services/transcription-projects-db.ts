import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import type {
  TranscriptionProjectData,
  TranscriptionProjectListEntry,
  TranscriptSegment,
} from '../../shared/ipc/types';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('transcription-projects-db');

let db: Database.Database | null = null;

export function getProjectsDir(): string {
  return path.join(app.getPath('userData'), 'transcription-projects');
}

function getDbPath(): string {
  return path.join(getProjectsDir(), 'transcription.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getProjectsDir(), { recursive: true });
  } catch {
    // mkdir is best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS transcription_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_file_path TEXT NOT NULL,
      source_file_name TEXT NOT NULL,
      source_file_type TEXT NOT NULL,
      model_id TEXT NOT NULL,
      language TEXT NOT NULL,
      result_language TEXT NOT NULL,
      result_duration REAL NOT NULL,
      result_text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_transcription_projects_updated_at
      ON transcription_projects(updated_at DESC);

    CREATE TABLE IF NOT EXISTS transcription_segments (
      project_id TEXT NOT NULL REFERENCES transcription_projects(id) ON DELETE CASCADE,
      segment_id INTEGER NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (project_id, segment_id)
    );
  `);

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close transcription-projects DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

// --- Row mappers ---

interface ProjectRow {
  id: string;
  name: string;
  source_file_path: string;
  source_file_name: string;
  source_file_type: string;
  model_id: string;
  language: string;
  result_language: string;
  result_duration: number;
  result_text: string;
  created_at: number;
  updated_at: number;
}

interface ListRow extends ProjectRow {
  segment_count: number;
}

interface SegmentRow {
  segment_id: number;
  start_time: number;
  end_time: number;
  text: string;
}

function rowToListEntry(row: ListRow): TranscriptionProjectListEntry {
  return {
    id: row.id,
    name: row.name,
    sourceFileName: row.source_file_name,
    sourceFileType: row.source_file_type as 'video' | 'audio',
    language: row.language,
    duration: row.result_duration,
    segmentCount: row.segment_count,
    updatedAt: row.updated_at,
  };
}

function rowToSegment(row: SegmentRow): TranscriptSegment {
  return {
    id: row.segment_id,
    start: row.start_time,
    end: row.end_time,
    text: row.text,
  };
}

function rowToProject(row: ProjectRow, segments: TranscriptSegment[]): TranscriptionProjectData {
  return {
    id: row.id,
    name: row.name,
    sourceFilePath: row.source_file_path,
    sourceFileName: row.source_file_name,
    sourceFileType: row.source_file_type as 'video' | 'audio',
    modelId: row.model_id,
    language: row.language,
    result: {
      language: row.result_language,
      duration: row.result_duration,
      segments,
      text: row.result_text,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- CRUD operations ---

export async function listTranscriptionProjects(): Promise<TranscriptionProjectListEntry[]> {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT p.*, COALESCE(s.n, 0) AS segment_count
       FROM transcription_projects p
       LEFT JOIN (
         SELECT project_id, COUNT(*) AS n
         FROM transcription_segments
         GROUP BY project_id
       ) s ON s.project_id = p.id
       ORDER BY p.updated_at DESC`
    )
    .all() as ListRow[];
  return rows.map(rowToListEntry);
}

export async function saveTranscriptionProject(project: TranscriptionProjectData): Promise<void> {
  const database = getDb();

  const upsertProject = database.prepare(
    `INSERT INTO transcription_projects
       (id, name, source_file_path, source_file_name, source_file_type,
        model_id, language, result_language, result_duration, result_text,
        created_at, updated_at)
     VALUES
       (@id, @name, @sourceFilePath, @sourceFileName, @sourceFileType,
        @modelId, @language, @resultLanguage, @resultDuration, @resultText,
        @createdAt, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       source_file_path = excluded.source_file_path,
       source_file_name = excluded.source_file_name,
       source_file_type = excluded.source_file_type,
       model_id = excluded.model_id,
       language = excluded.language,
       result_language = excluded.result_language,
       result_duration = excluded.result_duration,
       result_text = excluded.result_text,
       updated_at = excluded.updated_at`
  );

  const deleteSegments = database.prepare(
    'DELETE FROM transcription_segments WHERE project_id = ?'
  );

  const insertSegment = database.prepare(
    `INSERT INTO transcription_segments
       (project_id, segment_id, start_time, end_time, text)
     VALUES (?, ?, ?, ?, ?)`
  );

  const txn = database.transaction(() => {
    upsertProject.run({
      id: project.id,
      name: project.name,
      sourceFilePath: project.sourceFilePath,
      sourceFileName: project.sourceFileName,
      sourceFileType: project.sourceFileType,
      modelId: project.modelId,
      language: project.language,
      resultLanguage: project.result.language,
      resultDuration: project.result.duration,
      resultText: project.result.text,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });

    // Replace segments wholesale — simpler than diffing and segment ids can shift
    // if the user re-runs transcription with a different model.
    deleteSegments.run(project.id);
    for (const seg of project.result.segments) {
      insertSegment.run(project.id, seg.id, seg.start, seg.end, seg.text);
    }
  });
  txn();
}

export async function loadTranscriptionProject(
  id: string
): Promise<TranscriptionProjectData | null> {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM transcription_projects WHERE id = ?')
    .get(id) as ProjectRow | undefined;
  if (!row) return null;

  const segmentRows = database
    .prepare(
      `SELECT segment_id, start_time, end_time, text
       FROM transcription_segments
       WHERE project_id = ?
       ORDER BY segment_id ASC`
    )
    .all(id) as SegmentRow[];

  return rowToProject(row, segmentRows.map(rowToSegment));
}

export async function deleteTranscriptionProject(id: string): Promise<void> {
  const database = getDb();
  // ON DELETE CASCADE removes segments automatically.
  database.prepare('DELETE FROM transcription_projects WHERE id = ?').run(id);
}
