import fs from 'fs/promises';
import { logEngine } from '../../logging/log-engine';
import { getDb, getWhiteboardSvgsDir } from './whiteboard-svgs-db';

const log = logEngine.createLogger('whiteboard-svgs-migrate');

/**
 * One-shot init. Safe to call on every launch. Ensures the user SVG library
 * directory exists and the SQLite schema is created. There is no legacy data
 * to migrate from — this stub exists for parity with other features and as a
 * home for future migrations (e.g. when AI-generated SVGs land).
 */
export async function migrateWhiteboardSvgs(): Promise<void> {
  try {
    await fs.mkdir(getWhiteboardSvgsDir(), { recursive: true });
  } catch (err) {
    log.error('Failed to ensure whiteboard-svgs directory', err);
    return;
  }

  // Touch the DB so the schema is created up front.
  getDb();
}
