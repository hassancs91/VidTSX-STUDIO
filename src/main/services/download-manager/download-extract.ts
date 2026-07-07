import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import fs from 'fs/promises';
// @ts-expect-error — unbzip2-stream has no type declarations
import unbzip2 from 'unbzip2-stream';
import type { ExtractionFormat } from './types';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('DownloadExtract');

/**
 * Extract an archive to a destination directory.
 * Supports zip, tar, tar.gz, and tar.bz2 formats.
 */
export async function extractArchive(
  archivePath: string,
  destDir: string,
  format: ExtractionFormat,
): Promise<void> {
  if (format === 'none') {
    return;
  }

  log.info('Extracting archive', { format, archivePath, destDir });

  // Ensure destination exists
  await fs.mkdir(destDir, { recursive: true });

  try {
    switch (format) {
      case 'zip':
        await extractZip(archivePath, destDir);
        break;
      case 'tar':
        await extractTar(archivePath, destDir);
        break;
      case 'tar.gz':
        await extractTarGz(archivePath, destDir);
        break;
      case 'tar.bz2':
        await extractTarBz2(archivePath, destDir);
        break;
    }
    log.info('Extraction successful', { format, destDir });
  } catch (err) {
    log.error('Extraction failed', err, { format, archivePath, destDir });
    throw err;
  }
}

async function extractZip(archivePath: string, destDir: string): Promise<void> {
  const unzipper = await import('unzipper');
  return new Promise((resolve, reject) => {
    createReadStream(archivePath)
      .pipe(unzipper.Extract({ path: destDir }))
      .on('close', resolve)
      .on('error', reject);
  });
}

async function extractTar(archivePath: string, destDir: string): Promise<void> {
  const tar = await import('tar');
  await tar.extract({ file: archivePath, cwd: destDir });
}

async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  const tar = await import('tar');
  return new Promise((resolve, reject) => {
    createReadStream(archivePath)
      .pipe(createGunzip())
      .pipe(tar.extract({ cwd: destDir }))
      .on('close', resolve)
      .on('error', reject);
  });
}

async function extractTarBz2(archivePath: string, destDir: string): Promise<void> {
  const tar = await import('tar');
  return new Promise((resolve, reject) => {
    createReadStream(archivePath)
      .pipe(unbzip2())
      .pipe(tar.extract({ cwd: destDir }))
      .on('close', resolve)
      .on('error', reject);
  });
}
