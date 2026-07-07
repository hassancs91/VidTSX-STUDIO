import fs from 'fs/promises';
import { logEngine } from '../../logging/log-engine';
import {
  getDb,
  getWhiteboardImagesDir,
  getWhiteboardImagesFilesDir,
} from './whiteboard-images-db';

const log = logEngine.createLogger('whiteboard-images-migrate');

/**
 * One-shot init. Safe to call on every launch. Ensures the user image
 * library directory exists and the SQLite schema is created. There is no
 * legacy data to migrate from — this stub exists for parity with other
 * features and as a home for future migrations.
 */
export async function migrateWhiteboardImages(): Promise<void> {
  try {
    await fs.mkdir(getWhiteboardImagesDir(), { recursive: true });
    await fs.mkdir(getWhiteboardImagesFilesDir(), { recursive: true });
  } catch (err) {
    log.error('Failed to ensure whiteboard-images directory', err);
    return;
  }

  // Touch the DB so the schema is created up front.
  getDb();
}
