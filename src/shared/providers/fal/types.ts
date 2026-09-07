export interface FalClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface FalDownloadResult {
  base64: string;
  contentType: string;
}

export type FalQueueStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED';

export interface FalQueueSubmitResult {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
  /** Cancel endpoint (PUT); absent when the queue response omits it. */
  cancelUrl?: string;
}

export interface FalQueueStatusResult {
  status: FalQueueStatus;
  error?: unknown;
}
