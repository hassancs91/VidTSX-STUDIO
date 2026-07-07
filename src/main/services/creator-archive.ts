import fs from 'fs/promises';
import { app } from 'electron';
import { logEngine } from '../../logging/log-engine';
import { loadLicense } from '../../license/license-store';
import { getDeviceId } from '../../license/device-id';
import { apiBaseUrl, vidtsxFetch } from './api-config';
import type { CreatorArchiveTsxRequest, CreatorArchiveTsxResponse } from '../../shared/ipc/types';

const log = logEngine.createLogger('CreatorArchive');

const ARCHIVE_TIMEOUT_MS = 15_000;

// Best-effort parse of the TSX `compositionConfig` export to derive video duration.
// Tolerant: returns null for any parse failure — archive is diagnostic, not authoritative.
function parseVideoDurationSeconds(tsxCode: string): number | null {
  const match = tsxCode.match(/export\s+const\s+compositionConfig\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return null;
  try {
    const objectLiteral = match[1]
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/(\s*)(\w+)(\s*:)/g, '$1"$2"$3')
      .replace(/'/g, '"');
    const parsed = JSON.parse(objectLiteral);
    const fps = typeof parsed.fps === 'number' && parsed.fps > 0 ? parsed.fps : 30;
    if (typeof parsed.durationInSeconds === 'number') return parsed.durationInSeconds;
    if (typeof parsed.durationInFrames === 'number') return parsed.durationInFrames / fps;
    return null;
  } catch {
    return null;
  }
}

export async function archiveTsx(input: CreatorArchiveTsxRequest): Promise<CreatorArchiveTsxResponse> {
  try {
    const license = await loadLicense();
    if (!license?.key) {
      log.info('Archive skipped: no license');
      return { success: false, skipped: 'no-license' };
    }

    const baseUrl = apiBaseUrl();
    if (!baseUrl) {
      log.info('Archive skipped: VITE_VIDTSX_API_URL not set');
      return { success: false, skipped: 'no-api-url' };
    }

    let tsxCode: string;
    try {
      tsxCode = await fs.readFile(input.tsxFilePath, 'utf-8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn('Archive skipped: TSX file unreadable', { tsxFilePath: input.tsxFilePath, error: msg });
      return { success: false, skipped: 'no-tsx' };
    }

    const endpoint = `${baseUrl}/api/v1/library/archive/`;
    // Prefer renderer-supplied duration (from the live composition config) — authoritative.
    // Fall back to regex parse of the TSX on disk for loaded-from-disk/imported cases.
    const videoDurationSeconds = typeof input.videoDurationSeconds === 'number'
      ? input.videoDurationSeconds
      : parseVideoDurationSeconds(tsxCode);
    const appVersion = app.getVersion();
    const deviceId = getDeviceId();

    const generationMs = input.generationTimeMs ?? 0;
    // The license key now authenticates via the Authorization header (the
    // backend resolves the user through the central bearer registry), so it
    // no longer travels in the body.
    const requestBody = {
      prompt: input.prompt,
      tsx_code: tsxCode,
      title: input.projectName ?? null,
      model_name: input.modelName,
      app_version: appVersion,
      device_id: deviceId,
      duration_seconds: videoDurationSeconds,
      generation_seconds: generationMs > 0 ? generationMs / 1000 : 0,
      prompt_tokens: input.inputTokens ?? 0,
      completion_tokens: input.outputTokens ?? 0,
      total_tokens: input.totalTokens,
    };

    log.info('Archiving TSX', {
      endpoint,
      tsxFilePath: input.tsxFilePath,
      tsxBytes: tsxCode.length,
      body: { ...requestBody, tsx_code: `[${tsxCode.length} bytes]` },
    });

    const res = await vidtsxFetch('/api/v1/library/archive/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${license.key}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS),
    });

    const text = await res.text();
    let body: unknown = null;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!res.ok) {
      const error = typeof body === 'object' && body !== null ? JSON.stringify(body) : String(body || `HTTP ${res.status}`);
      log.error('Archive failed', undefined, { status: res.status, endpoint, body: error });
      return { success: false, error: `Server responded ${res.status}: ${error}` };
    }

    const obj = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    const archiveId = typeof obj.id === 'string' || typeof obj.id === 'number'
      ? String(obj.id)
      : typeof obj.archive_id === 'string' || typeof obj.archive_id === 'number'
        ? String(obj.archive_id)
        : undefined;

    log.info('Archive succeeded', { status: res.status, archiveId });
    return { success: true, archiveId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('Archive failed', err, { message: msg, tsxFilePath: input.tsxFilePath });
    return { success: false, error: msg };
  }
}
