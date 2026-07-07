import fs from 'fs/promises';
import { openAsBlob } from 'node:fs';
import path from 'path';
import { logEngine } from '../../logging/log-engine';
import { apiBaseUrl, vidtsxFetch } from './api-config';

const log = logEngine.createLogger('TemplatePusher');

export interface PushTemplateInput {
  tsxFilePath: string;
  mp4Path: string;
  thumbnailPath: string;
  title: string;
  slug: string;
  description: string;
  tags: string[];
  isPremium: boolean;
  featured: boolean;
}

export interface PushTemplateResult {
  success: boolean;
  templateId?: string;
  url?: string;
  error?: string;
}

interface CompositionBasics {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

const DEFAULT_COMP: CompositionBasics = { width: 1920, height: 1080, fps: 30, durationInFrames: 300 };

function parseComposition(tsxCode: string): CompositionBasics {
  const match = tsxCode.match(/export\s+const\s+compositionConfig\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return { ...DEFAULT_COMP };
  try {
    const objectLiteral = match[1]
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/(\s*)(\w+)(\s*:)/g, '$1"$2"$3')
      .replace(/'/g, '"');
    const parsed = JSON.parse(objectLiteral);
    const fps = typeof parsed.fps === 'number' ? parsed.fps : DEFAULT_COMP.fps;
    let durationInFrames = parsed.durationInFrames;
    if (durationInFrames === undefined && parsed.durationInSeconds !== undefined) {
      durationInFrames = Math.round(parsed.durationInSeconds * fps);
    } else if (durationInFrames === undefined) {
      durationInFrames = DEFAULT_COMP.durationInFrames;
    }
    return {
      width: typeof parsed.width === 'number' ? parsed.width : DEFAULT_COMP.width,
      height: typeof parsed.height === 'number' ? parsed.height : DEFAULT_COMP.height,
      fps,
      durationInFrames,
    };
  } catch {
    return { ...DEFAULT_COMP };
  }
}

function apiKey(): string | null {
  // Unprefixed on purpose: we do NOT want this value inlined into the
  // production bundle. Reading only from process.env means it's available
  // during `npm run dev` (electron-vite loads .env into process.env) but
  // absent in packaged builds — which is correct, since the push flow is
  // dev-only and gated in creator-handlers.ts via app.isPackaged.
  const key = process.env.VIDTSX_DRAFT_API_KEY;
  if (typeof key === 'string' && key.trim()) return key.trim();
  return null;
}

function thumbnailMime(thumbPath: string): { mime: string; filename: string } {
  const ext = path.extname(thumbPath).toLowerCase();
  switch (ext) {
    case '.webp': return { mime: 'image/webp', filename: 'thumbnail.webp' };
    case '.png': return { mime: 'image/png', filename: 'thumbnail.png' };
    case '.jpg':
    case '.jpeg': return { mime: 'image/jpeg', filename: 'thumbnail.jpg' };
    case '.gif': return { mime: 'image/gif', filename: 'thumbnail.gif' };
    default: return { mime: 'application/octet-stream', filename: `thumbnail${ext || ''}` };
  }
}

export async function pushTemplate(input: PushTemplateInput): Promise<PushTemplateResult> {
  try {
    const key = apiKey();
    if (!key) {
      return { success: false, error: 'VIDTSX_DRAFT_API_KEY is not set in .env' };
    }
    const baseUrl = apiBaseUrl();
    if (!baseUrl) {
      return { success: false, error: 'VITE_VIDTSX_API_URL is not set in .env' };
    }

    const tsxCode = await fs.readFile(input.tsxFilePath, 'utf-8');
    const comp = parseComposition(tsxCode);
    const durationSeconds = comp.durationInFrames / comp.fps;

    try {
      await fs.access(input.mp4Path);
    } catch {
      return { success: false, error: `Rendered video not found at ${input.mp4Path}` };
    }

    try {
      await fs.access(input.thumbnailPath);
    } catch {
      return { success: false, error: `Thumbnail not found at ${input.thumbnailPath}` };
    }

    const { mime: thumbType, filename: thumbFileName } = thumbnailMime(input.thumbnailPath);

    // openAsBlob streams the file so large mp4 uploads don't hit memory/serialization quirks
    // that `new Blob([Buffer])` has with Node's undici FormData implementation.
    const mp4Blob = await openAsBlob(input.mp4Path, { type: 'video/mp4' });
    const thumbBlob = await openAsBlob(input.thumbnailPath, { type: thumbType });
    const mp4Size = (await fs.stat(input.mp4Path)).size;
    const thumbSize = (await fs.stat(input.thumbnailPath)).size;

    const form = new FormData();
    form.append('title', input.title);
    form.append('slug', input.slug);
    form.append('description', input.description);
    form.append('tsx_code', tsxCode);
    form.append('tags', input.tags.join(','));
    form.append('width', String(comp.width));
    form.append('height', String(comp.height));
    form.append('fps', String(comp.fps));
    form.append('duration_seconds', String(durationSeconds));
    form.append('is_premium', input.isPremium ? 'true' : 'false');
    form.append('featured', input.featured ? 'true' : 'false');
    form.append('thumbnail', thumbBlob, thumbFileName);
    form.append('preview_video', mp4Blob, 'preview.mp4');

    const endpoint = `${baseUrl}/api/v1/library/templates/draft/`;
    log.info('Pushing template', {
      endpoint,
      tsxFilePath: input.tsxFilePath,
      slug: input.slug,
      mp4Size,
      thumbSize,
      thumbKind: thumbType,
    });

    const res = await vidtsxFetch('/api/v1/library/templates/draft/', {
      method: 'POST',
      // New backend authenticates the draft upload with X-Publisher-Token
      // (checked against the server's LIBRARY_PUBLISHER_TOKEN). The value
      // still comes from the VIDTSX_DRAFT_API_KEY env var.
      headers: { 'X-Publisher-Token': key },
      body: form,
    });

    const text = await res.text();
    let body: unknown = null;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!res.ok) {
      const error = typeof body === 'object' && body !== null
        ? JSON.stringify(body)
        : String(body || `HTTP ${res.status}`);
      return { success: false, error: `Server responded ${res.status}: ${error}` };
    }

    const obj = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    return {
      success: true,
      templateId: typeof obj.id === 'string' || typeof obj.id === 'number' ? String(obj.id) : undefined,
      url: typeof obj.url === 'string' ? obj.url : undefined,
    };
  } catch (err) {
    // undici's `fetch failed` carries the real network reason on `.cause`;
    // surface it so the log/UI isn't just a generic message.
    const cause = err instanceof Error && err.cause != null
      ? (err.cause instanceof Error ? err.cause.message : String(err.cause))
      : '';
    const base = err instanceof Error ? err.message : String(err);
    const msg = cause ? `${base} (cause: ${cause})` : base;
    // Pass the Error as the logger's `error` arg (2nd slot) — not as a
    // context object, which normalizeError() stringifies to "[object Object]".
    log.error('Push failed', err, { slug: input.slug });
    return { success: false, error: msg };
  }
}
