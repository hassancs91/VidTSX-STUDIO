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
}

export type ProviderKeyId = keyof ProviderCredentials;

export interface ProviderKeysGetResponse {
  success: boolean;
  hasKeys: Record<ProviderKeyId, boolean>;
  error?: string;
}

export interface ProviderKeysSaveRequest {
  /** Empty/undefined values keep the existing stored key. */
  keys: Partial<Record<ProviderKeyId, string>>;
  /** Keys listed here are deleted from storage. */
  clear?: ProviderKeyId[];
}

export interface ProviderKeysSaveResponse {
  success: boolean;
  hasKeys: Record<ProviderKeyId, boolean>;
  error?: string;
}
