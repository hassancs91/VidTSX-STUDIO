// ─── Logging types ───
export interface LogWriteRequest {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  module: string;
  message: string;
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

export interface LogWriteResponse {
  success: boolean;
}
