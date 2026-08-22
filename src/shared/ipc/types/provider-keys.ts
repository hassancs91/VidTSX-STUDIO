/**
 * Shared bring-your-own-key provider credentials.
 * One key per external provider, entered once in Settings and consumed by
 * every engine (LLM, image, video, transcription). Raw keys never cross the
 * IPC boundary to the renderer — only hasKeys booleans do.
 */
export interface ProviderCredentials {
  fal?: string;
  openrouter?: string;
  assemblyai?: string;
  elevenlabs?: string;
  zai?: string;
  /** Cloudflare Workers AI API token. The account id half of the pair is not
   *  a secret and lives in a plain settings field (`cloudflareAccountId`). */
  cloudflare?: string;
}

export type ProviderKeyId = keyof ProviderCredentials;

export interface ProviderKeysGetResponse {
  success: boolean;
  hasKeys: Record<ProviderKeyId, boolean>;
  /** Cloudflare account id — plain (non-secret), safe to show in the UI. */
  cloudflareAccountId?: string;
  error?: string;
}

export interface ProviderKeysSaveRequest {
  /** Empty/undefined values keep the existing stored key. */
  keys: Partial<Record<ProviderKeyId, string>>;
  /** Keys listed here are deleted from storage. */
  clear?: ProviderKeyId[];
  /** Undefined keeps the stored Cloudflare account id; empty string clears it. */
  cloudflareAccountId?: string;
}

export interface ProviderKeysSaveResponse {
  success: boolean;
  hasKeys: Record<ProviderKeyId, boolean>;
  cloudflareAccountId?: string;
  error?: string;
}
