import type { IpcMainInvokeEvent } from 'electron';
import type {
  ProviderKeyId,
  ProviderKeysGetResponse,
  ProviderKeysSaveRequest,
  ProviderKeysSaveResponse,
} from '../../shared/ipc/types/provider-keys';
import { getProviderCredentials, saveProviderCredentials } from '../services/settings';
import { initImageEngine } from '../services/image-init';
import { initLLMEngine } from '../services/llm-init';
import { initSttEngine } from '../services/stt/stt-init';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('ProviderKeys');

function toHasKeys(credentials: Partial<Record<ProviderKeyId, string>>): Record<ProviderKeyId, boolean> {
  return {
    fal: !!credentials.fal,
    openrouter: !!credentials.openrouter,
    assemblyai: !!credentials.assemblyai,
  };
}

export async function handleProviderKeysGet(): Promise<ProviderKeysGetResponse> {
  try {
    const credentials = await getProviderCredentials();
    return { success: true, hasKeys: toHasKeys(credentials) };
  } catch (err) {
    return {
      success: false,
      hasKeys: { fal: false, openrouter: false, assemblyai: false },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleProviderKeysSave(
  _event: IpcMainInvokeEvent,
  req: ProviderKeysSaveRequest,
): Promise<ProviderKeysSaveResponse> {
  try {
    const next = await saveProviderCredentials(req.keys ?? {}, req.clear);

    // Re-register engine providers so new keys take effect immediately.
    await initImageEngine();
    await initLLMEngine();
    await initSttEngine();

    log.info('Provider credentials updated', toHasKeys(next));
    return { success: true, hasKeys: toHasKeys(next) };
  } catch (err) {
    return {
      success: false,
      hasKeys: { fal: false, openrouter: false, assemblyai: false },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
