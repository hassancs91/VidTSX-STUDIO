import type { IpcMainInvokeEvent } from 'electron';
import type {
  ImageModelParamsGetResponse,
  ImageModelParamsSaveRequest,
  ImageModelParamsSaveResponse,
} from '../../shared/ipc/types/image-model-params';
import { getImageModelParamOverrides, saveImageModelParams } from '../services/image-model-params';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('ImageModelParams');

export async function handleImageModelParamsGet(): Promise<ImageModelParamsGetResponse> {
  try {
    return { success: true, overrides: getImageModelParamOverrides() };
  } catch (err) {
    return { success: false, overrides: {}, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function handleImageModelParamsSave(
  _event: IpcMainInvokeEvent,
  req: ImageModelParamsSaveRequest,
): Promise<ImageModelParamsSaveResponse> {
  try {
    if (!req?.providerId?.trim() || !req?.modelId?.trim()) {
      throw new Error('A provider id and a model id are required');
    }
    const overrides = saveImageModelParams(req.providerId.trim(), req.modelId.trim(), req.params);
    log.info(req.params ? 'Override saved' : 'Override reset', {
      providerId: req.providerId,
      modelId: req.modelId,
      fields: req.params ? Object.keys(req.params) : [],
    });
    // No engine re-registration: the override is read per request.
    return { success: true, overrides };
  } catch (err) {
    return {
      success: false,
      overrides: getImageModelParamOverrides(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
