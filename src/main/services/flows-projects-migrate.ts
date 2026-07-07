import fs from 'fs/promises';
import { logEngine } from '../../logging/log-engine';
import { getDb, getFlowsProjectsDir } from './flows-projects-db';

const log = logEngine.createLogger('flows-projects-migrate');

export async function migrateFlowsProjects(): Promise<void> {
  try {
    await fs.mkdir(getFlowsProjectsDir(), { recursive: true });
  } catch (err) {
    log.error('Failed to ensure flows-projects directory', err);
    return;
  }
  getDb();
}
