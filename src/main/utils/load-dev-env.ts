import { app } from 'electron';
import fs from 'fs';
import path from 'path';

// electron-vite only exposes `VITE_*` / `MAIN_VITE_*` vars, and it does so by
// inlining them into the bundle at build time — they ship in the packaged JS.
// For dev-only secrets that must NEVER reach end users (e.g. the draft-push
// admin key), we keep them unprefixed in .env and load them into process.env
// at runtime, gated to unpackaged builds. Packaged apps never read the file.
export function loadDevEnv(): void {
  if (app.isPackaged) return;

  const envPath = path.join(app.getAppPath(), '.env');
  let raw: string;
  try {
    raw = fs.readFileSync(envPath, 'utf-8');
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
