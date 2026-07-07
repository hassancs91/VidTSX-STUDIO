import crypto from 'crypto';
import os from 'os';

function getFirstMacAddress(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name];
    if (!entries) continue;
    for (const entry of entries) {
      if (!entry.internal && entry.mac && entry.mac !== '00:00:00:00:00:00') {
        return entry.mac;
      }
    }
  }
  return null;
}

export function getDeviceId(): string {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  const mac = getFirstMacAddress() || '';

  const raw = `${hostname}${platform}${arch}${mac}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function getDeviceName(): string {
  return `${os.hostname()} (${os.platform()})`;
}
