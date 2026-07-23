import type { IpcMainInvokeEvent } from 'electron';
import type { TsxValidateRequest, TsxValidateResponse } from '@shared/ipc/types';
import { transpileTsxSource } from '../services/tsx-transpiler';
import { ensureModuleServer, getModuleServerBaseUrl } from '../services/module-server';

export async function handleTsxValidate(
  _event: IpcMainInvokeEvent,
  data: TsxValidateRequest
): Promise<TsxValidateResponse> {
  try {
    await ensureModuleServer();
    const baseUrl = getModuleServerBaseUrl();

    if (!baseUrl) {
      return { success: false, error: 'Module server not available' };
    }

    // Transpile straight from the string — no temp file, safe under
    // concurrent validations.
    const result = await transpileTsxSource(data.code, 'validate.tsx', baseUrl);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        errorLocation: result.location,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Validation failed',
    };
  }
}
