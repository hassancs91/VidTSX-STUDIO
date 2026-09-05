/**
 * Shared bring-your-own-key provider credentials — IPC surface.
 * The id union and credentials shape derive from the provider registry
 * (`@shared/providers/registry`); this file only carries the request/response
 * types. Raw keys never cross the IPC boundary to the renderer — only hasKeys
 * booleans do.
 */
import type { ProviderKeyId } from '../../providers/registry';

export type { ProviderKeyId, ProviderCredentials } from '../../providers/registry';

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
