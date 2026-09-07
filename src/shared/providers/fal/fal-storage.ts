import { logEngine } from '../../../logging/log-engine';
import { FalHttpError } from './errors';
import type { FalClientOptions } from './types';

const log = logEngine.createLogger('FalStorage');

const REST_BASE_URL = 'https://rest.fal.ai';

/**
 * Single-request uploads only. fal's own client switches to a multipart flow
 * past this size; reference clips for Seedance are far below it, and going
 * over returns a clear error instead of a silent truncation.
 */
export const FAL_MAX_UPLOAD_BYTES = 90 * 1024 * 1024;

interface InitiateUploadResponse {
  /** Short-lived signed URL the bytes are PUT to. */
  upload_url: string;
  /** The permanent CDN URL a model request references. */
  file_url: string;
}

const EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

/**
 * fal storage: turn local bytes into a URL a model can fetch. Reference
 * videos and audio are far too large for the data URIs images travel as, and
 * BytePlus refuses base64 for video outright — so both video providers hand
 * their reference media through here (docs/video-providers-plan.md §2.2).
 *
 * Two steps, verified against fal's own client: POST the content type and
 * file name to get a signed `upload_url` plus the final `file_url`, then PUT
 * the bytes to the signed URL (which carries its own auth).
 */
export class FalStorageClient {
  private readonly apiKey: string;

  constructor(opts: FalClientOptions) {
    this.apiKey = opts.apiKey;
  }

  /** Upload bytes, returning the CDN URL to pass as `video_url` / `audio_url`. */
  async upload(
    bytes: Uint8Array,
    contentType: string,
    fileName?: string,
    signal?: AbortSignal,
  ): Promise<string> {
    if (bytes.byteLength > FAL_MAX_UPLOAD_BYTES) {
      throw new FalHttpError(
        `File is ${Math.round(bytes.byteLength / 1024 / 1024)} MB — reference uploads are limited to ${FAL_MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      );
    }
    const name = fileName ?? `${Date.now()}.${EXTENSIONS[contentType] ?? 'bin'}`;
    const { upload_url: uploadUrl, file_url: fileUrl } = await this.initiate(
      contentType,
      name,
      signal,
    );

    let response: Response;
    try {
      response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        // Fresh copy so the request body is a plain ArrayBuffer, not a view
        // into a pooled Node Buffer.
        body: bytes.slice().buffer as ArrayBuffer,
        signal,
      });
    } catch (error) {
      log.error('Network error uploading to Fal storage', error);
      throw new FalHttpError('Network error uploading to Fal storage', undefined, error);
    }
    if (!response.ok) {
      throw new FalHttpError(`Fal storage upload returned ${response.status}`, response.status);
    }
    log.info('Uploaded reference media', { contentType, bytes: bytes.byteLength });
    return fileUrl;
  }

  private async initiate(
    contentType: string,
    fileName: string,
    signal?: AbortSignal,
  ): Promise<InitiateUploadResponse> {
    let response: Response;
    try {
      response = await fetch(
        `${REST_BASE_URL}/storage/upload/initiate?storage_type=fal-cdn-v3`,
        {
          method: 'POST',
          headers: {
            Authorization: `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content_type: contentType, file_name: fileName }),
          signal,
        },
      );
    } catch (error) {
      log.error('Network error connecting to Fal storage', error);
      throw new FalHttpError('Network error connecting to Fal storage', undefined, error);
    }
    if (!response.ok) {
      throw new FalHttpError(
        `Fal storage returned ${response.status} when starting the upload`,
        response.status,
      );
    }
    const data = (await response.json()) as Partial<InitiateUploadResponse>;
    if (!data.upload_url || !data.file_url) {
      throw new FalHttpError('Fal storage returned an unexpected upload response');
    }
    return { upload_url: data.upload_url, file_url: data.file_url };
  }
}
