import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc/channels';
import { VALIDATION_INTERVAL_MS } from './config';
import { vidtsxFetch } from '../main/services/api-config';
import { getDeviceId, getDeviceName } from './device-id';
import { saveLicense, loadLicense, clearLicense, isLicenseValid } from './license-store';
import { logEngine } from '../logging/log-engine';
import type {
  LicenseActivateRequest,
  LicenseActivateResponse,
  LicenseCheckResponse,
  LicenseDeactivateResponse,
  LicenseGetStatusResponse,
  LicenseWhoamiResponse,
} from '../shared/ipc/types';

let validationInterval: ReturnType<typeof setInterval> | null = null;

function maskKey(key: string): string {
  const parts = key.split('-');
  if (parts.length < 2) return key;
  const masked = parts.map((p, i) => (i === parts.length - 1 ? p : '****'));
  return masked.join('-');
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('fetch') || msg.includes('econnrefused') || msg.includes('enotfound')
    || msg.includes('network') || msg.includes('etimedout') || msg.includes('abort');
}

// Pull a human-readable message out of a server error body. The backend returns
// errors as either a bare string (`{error: "..."}`) or, on the new
// mcp.vidtsx.com routes, a nested object (`{error: {code, message}}`). Always
// return a string so an object never reaches the UI as a React child.
function serverErrorMessage(body: Record<string, unknown>): string | undefined {
  const err = body.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && typeof (err as Record<string, unknown>).message === 'string') {
    return (err as Record<string, string>).message;
  }
  if (typeof body.detail === 'string') return body.detail;
  if (typeof body.message === 'string') return body.message;
  return undefined;
}

function friendlyError(err: unknown, fallbackStatus?: number): string {
  if (isNetworkError(err)) {
    return 'Could not connect to the license server. Check your internet connection.';
  }
  if (err instanceof Error) {
    const msg = err.message;
    // If it looks like an HTML title from parseJsonResponse, it's a server comms issue
    if (msg.includes('Forbidden') || msg.includes('DOCTYPE') || msg.includes('unexpected response')) {
      return 'Could not reach the license server. Please try again later.';
    }
  }
  if (fallbackStatus) {
    if (fallbackStatus === 429) return 'Too many attempts. Please try again later.';
    if (fallbackStatus >= 500) return 'Server error. Please try again later.';
    if (fallbackStatus === 404) return 'License key not found.';
    if (fallbackStatus === 403) return 'Access denied.';
  }
  return 'Something went wrong. Please try again.';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const parseErr = new Error(`Non-JSON response (${res.status}) from ${res.url}`);
    logEngine.error('License', `Non-JSON response (${res.status})`, parseErr, { body: text.slice(0, 500) });
    if (!res.ok) {
      throw parseErr;
    }
    throw new Error('Server returned an invalid response');
  }
}

function broadcastStatusChanged(data: { status: string; tier?: string }): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.LICENSE_STATUS_CHANGED, data);
    }
  }
}

async function activate(licenseKey: string): Promise<LicenseActivateResponse> {
  try {
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();

    const res = await vidtsxFetch('/api/v1/licensing/activate/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        device_id: deviceId,
        device_name: deviceName,
      }),
    });

    let body: Record<string, unknown>;
    try {
      body = await parseJsonResponse(res);
    } catch (parseErr) {
      logEngine.error('License', 'Activation failed: non-JSON response', parseErr, { status: res.status });
      return { success: false, error: friendlyError(parseErr, res.status) };
    }

    if (!res.ok) {
      // Server returned a JSON error — use its message if friendly, otherwise map it
      const serverMsg = serverErrorMessage(body);
      logEngine.error('License', `Activation rejected (${res.status})`, new Error(serverMsg || `HTTP ${res.status}`), { status: res.status, body });
      return { success: false, error: serverMsg || friendlyError(null, res.status) };
    }

    await saveLicense({
      key: licenseKey,
      token: body.token as string || '',
      tier: body.tier as string || 'free',
      features: body.features as string[] || [],
      activatedAt: body.activated_at as string || new Date().toISOString(),
      lastValidated: new Date().toISOString(),
      expiresAt: body.expires_at as string || '',
    });

    logEngine.info('License', `License activated: ${maskKey(licenseKey)}`);

    return {
      success: true,
      tier: body.tier as string || 'free',
      features: body.features as string[] || [],
      expiresAt: body.expires_at as string,
    };
  } catch (err) {
    const actualErr = err instanceof Error ? err : new Error(String(err));
    logEngine.error('License', 'Activation failed', actualErr);
    return { success: false, error: friendlyError(err) };
  }
}

async function validateInBackground(): Promise<void> {
  const license = await loadLicense();
  if (!license) return;

  try {
    const deviceId = getDeviceId();

    const res = await vidtsxFetch('/api/v1/licensing/validate/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: license.key,
        device_id: deviceId,
      }),
    });

    if (res.ok) {
      const body = await parseJsonResponse(res);
      await saveLicense({
        ...license,
        token: body.token || license.token,
        tier: body.tier || license.tier,
        features: body.features || license.features,
        lastValidated: new Date().toISOString(),
        expiresAt: body.expires_at || license.expiresAt,
      });
      logEngine.info('License', 'Background validation succeeded');
    } else if (res.status === 403) {
      logEngine.warn('License', 'License revoked by server');
      await clearLicense();
      broadcastStatusChanged({ status: 'revoked' });
    } else {
      logEngine.warn('License', `Validation returned ${res.status}, ignoring`);
    }
  } catch (err) {
    const actualErr = err instanceof Error ? err : new Error(String(err));
    if (isNetworkError(err)) {
      logEngine.info('License', 'Background validation skipped (network error)');
    } else {
      logEngine.error('License', 'Background validation failed', actualErr);
    }
  }
}

async function checkLicenseOnStartup(): Promise<LicenseCheckResponse> {
  const license = await loadLicense();

  if (!license) {
    return { status: 'not_activated' };
  }

  if (isLicenseValid(license)) {
    // Kick off background validation (don't await)
    validateInBackground();
    return {
      status: 'valid',
      key: maskKey(license.key),
      tier: license.tier,
      features: license.features,
    };
  }

  // License expired locally — try to refresh synchronously
  try {
    const deviceId = getDeviceId();
    const res = await vidtsxFetch('/api/v1/licensing/validate/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: license.key,
        device_id: deviceId,
      }),
    });

    if (res.ok) {
      const body = await parseJsonResponse(res);
      await saveLicense({
        ...license,
        token: body.token || license.token,
        tier: body.tier || license.tier,
        features: body.features || license.features,
        lastValidated: new Date().toISOString(),
        expiresAt: body.expires_at || license.expiresAt,
      });
      return {
        status: 'valid',
        key: maskKey(license.key),
        tier: body.tier || license.tier,
        features: body.features || license.features,
      };
    }
  } catch (err) {
    const actualErr = err instanceof Error ? err : new Error(String(err));
    if (!isNetworkError(err)) {
      logEngine.error('License', 'Startup validation refresh failed', actualErr);
    }
  }

  return { status: 'expired' };
}

async function deactivate(): Promise<LicenseDeactivateResponse> {
  const license = await loadLicense();

  if (license) {
    try {
      const deviceId = getDeviceId();
      await vidtsxFetch('/api/v1/licensing/deactivate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: license.key,
          device_id: deviceId,
        }),
      });
    } catch (err) {
      // Clear locally regardless, but report non-network errors to Sentry
      const actualErr = err instanceof Error ? err : new Error(String(err));
      if (!isNetworkError(err)) {
        logEngine.error('License', 'Server deactivation failed', actualErr);
      }
    }
  }

  await clearLicense();
  logEngine.info('License', 'License deactivated');
  return { success: true };
}

async function whoami(): Promise<LicenseWhoamiResponse> {
  const license = await loadLicense();
  if (!license || !license.key) {
    return { success: false, status: 'not_activated' };
  }

  try {
    const res = await vidtsxFetch('/api/v1/whoami', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${license.key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (res.status === 401) {
      return {
        success: false,
        status: 'invalid_license',
        error: 'License invalid — please re-activate.',
      };
    }

    let body: Record<string, unknown>;
    try {
      body = await parseJsonResponse(res);
    } catch (parseErr) {
      logEngine.error('License', 'Whoami failed: non-JSON response', parseErr, { status: res.status });
      return { success: false, status: 'error', error: friendlyError(parseErr, res.status) };
    }

    if (!res.ok) {
      const serverMsg = serverErrorMessage(body);
      return { success: false, status: 'error', error: serverMsg || friendlyError(null, res.status) };
    }

    // whoami is a free endpoint, so an invalid/expired key returns 200 with
    // `authenticated: false` rather than a 401 — treat that as invalid_license.
    if (body.authenticated === false) {
      return {
        success: false,
        status: 'invalid_license',
        error: 'License invalid — please re-activate.',
      };
    }

    // New shape: { authenticated, email, plan, plan_slug, credits }.
    const credits = typeof body.credits === 'number' ? body.credits : undefined;
    return {
      success: true,
      status: 'ok',
      email: body.email as string | undefined,
      tier: (body.plan as string | undefined) ?? (body.plan_slug as string | undefined),
      creditsAvailable: credits,
    };
  } catch (err) {
    const actualErr = err instanceof Error ? err : new Error(String(err));
    if (!isNetworkError(err)) {
      logEngine.error('License', 'Whoami failed', actualErr);
    }
    return { success: false, status: 'error', error: friendlyError(err) };
  }
}

async function getStatus(): Promise<LicenseGetStatusResponse> {
  const license = await loadLicense();
  if (!license) {
    return { status: 'not_activated' };
  }

  const valid = isLicenseValid(license);
  return {
    status: valid ? 'valid' : 'expired',
    key: maskKey(license.key),
    tier: license.tier,
    features: license.features,
    expiresAt: license.expiresAt,
  };
}

export function setupLicenseIPC(): void {
  ipcMain.handle(
    IPC.LICENSE_ACTIVATE,
    async (_event, data: LicenseActivateRequest) => activate(data.licenseKey),
  );

  ipcMain.handle(IPC.LICENSE_CHECK, async () => checkLicenseOnStartup());

  ipcMain.handle(IPC.LICENSE_DEACTIVATE, async () => deactivate());

  ipcMain.handle(IPC.LICENSE_GET_STATUS, async () => getStatus());

  ipcMain.handle(IPC.LICENSE_WHOAMI, async () => whoami());

  logEngine.info('License', 'License IPC handlers registered');
}

export function startValidationLoop(): void {
  if (validationInterval) return;
  validationInterval = setInterval(() => {
    validateInBackground();
  }, VALIDATION_INTERVAL_MS);
}

export function stopValidationLoop(): void {
  if (validationInterval) {
    clearInterval(validationInterval);
    validationInterval = null;
  }
}

export { checkLicenseOnStartup };
