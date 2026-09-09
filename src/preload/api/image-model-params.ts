import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  ImageModelParamsGetResponse,
  ImageModelParamsSaveRequest,
  ImageModelParamsSaveResponse,
} from '../../shared/ipc/types/image-model-params';

export const imageModelParamsApi = {
  imageModelParamsGet: (): Promise<ImageModelParamsGetResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_MODEL_PARAMS_GET),
  imageModelParamsSave: (data: ImageModelParamsSaveRequest): Promise<ImageModelParamsSaveResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_MODEL_PARAMS_SAVE, data),
};
