import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';

export interface LicenseData {
  key: string;
  token: string;
  tier: string;
  features: string[];
  activatedAt: string;
  lastValidated: string;
  expiresAt: string;
}

function getLicensePath(): string {
  return path.join(app.getPath('userData'), 'license.json');
}

export async function saveLicense(data: LicenseData): Promise<void> {
  const filePath = getLicensePath();
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function loadLicense(): Promise<LicenseData | null> {
  try {
    const raw = await fs.readFile(getLicensePath(), 'utf-8');
    const data = JSON.parse(raw) as LicenseData;
    if (!data.key || !data.token) return null;
    return data;
  } catch {
    return null;
  }
}

export async function clearLicense(): Promise<void> {
  try {
    await fs.unlink(getLicensePath());
  } catch {
    // File may not exist — ignore
  }
}

export function isLicenseValid(data: LicenseData): boolean {
  if (!data.token || !data.expiresAt) return false;
  return new Date(data.expiresAt).getTime() > Date.now();
}
