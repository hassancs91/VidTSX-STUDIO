import type { IpcMainInvokeEvent } from 'electron';
import type {
  ProviderKeyId,
  ProviderKeysGetResponse,
  ProviderKeysSaveRequest,
  ProviderKeysSaveResponse,
} from '../../shared/ipc/types/provider-keys';
import { PROVIDER_KEY_IDS } from '../../shared/providers/registry';
import {
  getProviderCredentials,
  saveProviderCredentials,
  getCloudflareAccountId,
  setCloudflareAccountId,
} from '../services/settings';
import { initImageEngine } from '../services/image-init';
import { initVideoEngine } from '../services/video-init';
import { initLLMEngine } from '../services/llm-init';
import { initSttEngine } from '../services/stt/stt-init';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('ProviderKeys');

// Every registry id gets a boolean, so a new provider entry surfaces here
// without a hand-edit.
function toHasKeys(credentials: Partial<Record<ProviderKeyId, string>>): Record<ProviderKeyId, boolean> {
  const out = {} as Record<ProviderKeyId, boolean>;
  for (const id of PROVIDER_KEY_IDS) out[id] = !!credentials[id];
  return out;
}

const NO_KEYS: Record<ProviderKeyId, boolean> = toHasKeys({});

export async function handleProviderKeysGet(): Promise<ProviderKeysGetResponse> {
  try {
    const credentials = await getProviderCredentials();
    return {
      success: true,
      hasKeys: toHasKeys(credentials),
      cloudflareAccountId: await getCloudflareAccountId(),
    };
  } catch (err) {
    return {
      success: false,
      hasKeys: { ...NO_KEYS },
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
    // The Cloudflare account id rides along with the key save but is a plain
    // settings value (not a secret) — undefined keeps the stored value.
    if (req.cloudflareAccountId !== undefined) {
      await setCloudflareAccountId(req.cloudflareAccountId);
    }

    // Re-register engine providers so new keys take effect immediately.
    await initImageEngine();
    await initVideoEngine();
    await initLLMEngine();
    await initSttEngine();

    log.info('Provider credentials updated', toHasKeys(next));
    return {
      success: true,
      hasKeys: toHasKeys(next),
      cloudflareAccountId: await getCloudflareAccountId(),
    };
  } catch (err) {
    return {
      success: false,
      hasKeys: { ...NO_KEYS },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
