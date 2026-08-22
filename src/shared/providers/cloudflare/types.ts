export interface CloudflareClientOptions {
  /** API token scoped to Workers AI (Bearer auth). */
  apiToken: string;
  /** Cloudflare account id — part of the run URL, not a secret. */
  accountId: string;
  baseUrl?: string;
}

/** One generated image, normalized to base64 regardless of response dialect. */
export interface CloudflareImageResult {
  base64: string;
  contentType: string;
}
