import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

function getTsxDir(projectId: string): string {
  return path.join(app.getPath('userData'), 'studio-projects', projectId, 'tsx');
}

export async function saveTsxFile(
  projectId: string,
  fileName: string,
  content: string
): Promise<string> {
  const dir = getTsxDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

export function getTsxFilePath(projectId: string, fileName: string): string {
  return path.join(getTsxDir(projectId), fileName);
}
