// ─── License types ───
export interface LicenseActivateRequest {
  licenseKey: string;
}

export interface LicenseActivateResponse {
  success: boolean;
  tier?: string;
  features?: string[];
  expiresAt?: string;
  error?: string;
}

export interface LicenseCheckResponse {
  status: 'not_activated' | 'valid' | 'expired';
  key?: string;
  tier?: string;
  features?: string[];
}

export interface LicenseDeactivateResponse {
  success: boolean;
  error?: string;
}

export interface LicenseGetStatusResponse {
  status: 'not_activated' | 'valid' | 'expired';
  key?: string;
  tier?: string;
  features?: string[];
  expiresAt?: string;
}

export interface LicenseStatusChangedEvent {
  status: 'revoked' | 'expired' | 'valid';
  tier?: string;
}

export interface LicenseWhoamiResponse {
  success: boolean;
  status: 'not_activated' | 'ok' | 'invalid_license' | 'error';
  email?: string;
  tier?: string;
  creditsAvailable?: number;
  error?: string;
}
