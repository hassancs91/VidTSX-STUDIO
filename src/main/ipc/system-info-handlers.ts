import { execFile } from 'child_process';
import type { IpcMainInvokeEvent } from 'electron';
import type { SystemInfoGetResponse, PyTorchPipInstallRequest, PyTorchPipInstallResponse } from '../../shared/ipc/types';
import { getSystemInfo } from '../services/system-info';
import { getPythonExePath, getPythonPackagesDir } from '../utils/paths';

export async function handleSystemInfoGet(
  _event: IpcMainInvokeEvent,
): Promise<SystemInfoGetResponse> {
  return getSystemInfo();
}

export async function handlePyTorchPipInstall(
  _event: IpcMainInvokeEvent,
  data: PyTorchPipInstallRequest,
): Promise<PyTorchPipInstallResponse> {
  const pythonPath = getPythonExePath();
  const packagesDir = getPythonPackagesDir();

  return new Promise((resolve) => {
    execFile(pythonPath, [
      '-m', 'pip', 'install',
      '--target', packagesDir,
      '--no-warn-script-location',
      '--no-cache-dir',
      data.wheelPath,
    ], {
      timeout: 300000, // 5 min for large GPU wheel
      windowsHide: true,
    }, (err, _stdout, stderr) => {
      if (err) {
        const msg = stderr?.trim() || err.message;
        resolve({ success: false, error: msg });
        return;
      }
      resolve({ success: true });
    });
  });
}
