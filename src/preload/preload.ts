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
import { audioGenerationApi } from './api/audio-generation';
import { sdImageApi } from './api/sd-image';
import { sdVideoApi } from './api/sd-video';
import { tsxJobsApi } from './api/tsx-jobs';
import { templatesApi } from './api/templates';
import { modelLibraryApi } from './api/model-library';
import { systemApi } from './api/system';
import { aiRuntimeApi } from './api/ai-runtime';
import { pythonModelsApi } from './api/python-models';
import { rembgApi } from './api/rembg';
import { sd3dApi } from './api/sd3d';
import { threedStudioApi } from './api/threed-studio';
import { localLlmApi } from './api/local-llm';
import { downloadApi } from './api/download';
import { embeddingApi } from './api/embedding';
import { moderationApi } from './api/moderation';
import { contentSafetyApi } from './api/content-safety';
import { aiUsageApi } from './api/ai-usage';
import { videoStudioApi } from './api/video-studio';
import { providerKeysApi } from './api/provider-keys';
import { providerModelsApi } from './api/provider-models';
import { imageModelParamsApi } from './api/image-model-params';
import { videoApi } from './api/video';
import { sttApi } from './api/stt';
import { studioApi } from './api/studio';
import { updaterApi } from './api/updater';
import { libraryApi } from './api/library';
import { memoryApi } from './api/memory';
import { newsApi } from './api/news';
import { agentsApi } from './api/agents';
import { homeApi } from './api/home';

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
  ...audioGenerationApi,
  ...sdImageApi,
  ...sdVideoApi,
  ...tsxJobsApi,
  ...templatesApi,
  ...modelLibraryApi,
  ...systemApi,
  ...aiRuntimeApi,
  ...pythonModelsApi,
  ...rembgApi,
  ...sd3dApi,
  ...threedStudioApi,
  ...localLlmApi,
  ...downloadApi,
  ...embeddingApi,
  ...moderationApi,
  ...contentSafetyApi,
  ...aiUsageApi,
  ...videoStudioApi,
  ...providerKeysApi,
  ...providerModelsApi,
  ...imageModelParamsApi,
  ...videoApi,
  ...sttApi,
  ...studioApi,
  ...updaterApi,
  ...libraryApi,
  ...memoryApi,
  ...newsApi,
  ...agentsApi,
  ...homeApi,
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;

console.log('Preload script loaded');
