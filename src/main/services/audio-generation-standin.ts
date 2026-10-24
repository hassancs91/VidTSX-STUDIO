// The dev-only seam that puts the stand-in audio provider on the engine
// (E2, E-d6). Inert when the app is packaged; otherwise active only when
// `VIDTSX_AUDIO_STANDIN_FILE` names an existing mp3. It registers AFTER the
// BYOK providers (audio-generation-init.ts calls it last), so a real key —
// registered first — stays the active provider and the stand-in only fills
// an empty engine. Logged at warn level when it registers: a running app
// with this seam open is a test rig, never a user's session.

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { audioGenerationEngine, StandinAudioProvider, STANDIN_AUDIO_PROVIDER_ID } from '../../audio-engine/generation';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('AudioGenerationStandin');

/** The env var naming the stand-in mp3. */
export const STANDIN_AUDIO_FILE_ENV = 'VIDTSX_AUDIO_STANDIN_FILE';

/** True when the stand-in was registered. Never throws. */
export function registerDevStandinProvider(): boolean {
  try {
    if (!app || app.isPackaged) return false;
    const file = process.env[STANDIN_AUDIO_FILE_ENV]?.trim();
    if (!file) return false;
    const abs = path.resolve(file);
    let isFile = false;
    try {
      isFile = fs.statSync(abs).isFile();
    } catch {
      isFile = false;
    }
    if (!isFile) {
      log.warn(`${STANDIN_AUDIO_FILE_ENV} is set but names no file — stand-in NOT registered`, { file: abs });
      return false;
    }
    audioGenerationEngine.registerInstance(new StandinAudioProvider(abs));
    log.warn(`DEV stand-in audio provider "${STANDIN_AUDIO_PROVIDER_ID}" registered (${STANDIN_AUDIO_FILE_ENV})`, {
      file: abs,
      active: audioGenerationEngine.getActiveProvider() ?? 'none',
    });
    return true;
  } catch (err) {
    log.warn('Stand-in audio provider registration failed (ignored)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
