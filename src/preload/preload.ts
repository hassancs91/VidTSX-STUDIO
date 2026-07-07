import { contextBridge } from 'electron';
import { appShellApi } from './api/app-shell';
import { creatorApi } from './api/creator';
import { fileApi } from './api/file';
import { bundleApi } from './api/bundle';
import { renderApi } from './api/render';
import { licenseApi } from './api/license';
import { updaterApi } from './api/updater';
import { settingsApi } from './api/settings';
import { whisperApi } from './api/whisper';
import { llmApi } from './api/llm';
import { skillsApi } from './api/skills';
import { flowsApi } from './api/flows';
import { imageStudioApi } from './api/image-studio';
import { thumbnailApi } from './api/thumbnail';
import { frameExtractorApi } from './api/frame-extractor';
import { logApi } from './api/log';
import { audioApi } from './api/audio';
import { sdImageApi } from './api/sd-image';
import { systemApi } from './api/system';
import { localLlmApi } from './api/local-llm';
import { downloadApi } from './api/download';
import { embeddingApi } from './api/embedding';
import { moderationApi } from './api/moderation';
import { aiUsageApi } from './api/ai-usage';
import { videoStudioApi } from './api/video-studio';
import { providerKeysApi } from './api/provider-keys';
import { videoApi } from './api/video';
import { sttApi } from './api/stt';

const api = {
  ...appShellApi,
  ...creatorApi,
  ...fileApi,
  ...bundleApi,
  ...renderApi,
  ...licenseApi,
  ...updaterApi,
  ...settingsApi,
  ...whisperApi,
  ...llmApi,
  ...skillsApi,
  ...flowsApi,
  ...imageStudioApi,
  ...thumbnailApi,
  ...frameExtractorApi,
  ...logApi,
  ...audioApi,
  ...sdImageApi,
  ...systemApi,
  ...localLlmApi,
  ...downloadApi,
  ...embeddingApi,
  ...moderationApi,
  ...aiUsageApi,
  ...videoStudioApi,
  ...providerKeysApi,
  ...videoApi,
  ...sttApi,
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;

console.log('Preload script loaded');
