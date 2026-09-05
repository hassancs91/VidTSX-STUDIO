import { contextBridge } from 'electron';
import { appShellApi } from './api/app-shell';
import { fileApi } from './api/file';
import { bundleApi } from './api/bundle';
import { renderApi } from './api/render';
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
import { sdVideoApi } from './api/sd-video';
import { tsxJobsApi } from './api/tsx-jobs';
import { modelLibraryApi } from './api/model-library';
import { systemApi } from './api/system';
import { aiRuntimeApi } from './api/ai-runtime';
import { pythonModelsApi } from './api/python-models';
import { rembgApi } from './api/rembg';
import { localLlmApi } from './api/local-llm';
import { downloadApi } from './api/download';
import { embeddingApi } from './api/embedding';
import { moderationApi } from './api/moderation';
import { contentSafetyApi } from './api/content-safety';
import { aiUsageApi } from './api/ai-usage';
import { videoStudioApi } from './api/video-studio';
import { providerKeysApi } from './api/provider-keys';
import { providerModelsApi } from './api/provider-models';
import { videoApi } from './api/video';
import { sttApi } from './api/stt';
import { studioApi } from './api/studio';
import { updaterApi } from './api/updater';
import { libraryApi } from './api/library';
import { memoryApi } from './api/memory';
import { newsApi } from './api/news';

const api = {
  ...appShellApi,
  ...fileApi,
  ...bundleApi,
  ...renderApi,
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
  ...sdVideoApi,
  ...tsxJobsApi,
  ...modelLibraryApi,
  ...systemApi,
  ...aiRuntimeApi,
  ...pythonModelsApi,
  ...rembgApi,
  ...localLlmApi,
  ...downloadApi,
  ...embeddingApi,
  ...moderationApi,
  ...contentSafetyApi,
  ...aiUsageApi,
  ...videoStudioApi,
  ...providerKeysApi,
  ...providerModelsApi,
  ...videoApi,
  ...sttApi,
  ...studioApi,
  ...updaterApi,
  ...libraryApi,
  ...memoryApi,
  ...newsApi,
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;

console.log('Preload script loaded');
