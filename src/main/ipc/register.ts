import { registerModuleHandlers } from './module-handlers';
import { registerAppShellIpc } from './registrations/app-shell';
import { registerFileIpc } from './registrations/file';
import { registerBundleIpc } from './registrations/bundle';
import { registerRenderIpc } from './registrations/render';
import { registerSettingsIpc } from './registrations/settings';
import { registerWhisperIpc } from './registrations/whisper';
import { registerLlmIpc } from './registrations/llm';
import { registerFlowsIpc } from './registrations/flows';
import { registerImageStudioIpc } from './registrations/image-studio';
import { registerThumbnailIpc } from './registrations/thumbnail';
import { registerLogIpc } from './registrations/log';
import { registerFrameExtractorIpc } from './registrations/frame-extractor';
import { registerAudioIpc } from './registrations/audio';
import { registerEmbeddingIpc } from './registrations/embedding';
import { registerSdImageIpc } from './registrations/sd-image';
import { registerSdVideoIpc } from './registrations/sd-video';
import { registerTsxJobsIpc } from './registrations/tsx-jobs';
import { registerModelLibraryIpc } from './registrations/model-library';
import { registerLocalLlmIpc } from './registrations/local-llm';
import { registerSystemIpc } from './registrations/system';
import { registerDownloadIpc } from './registrations/download';
import { registerModerationIpc } from './registrations/moderation';
import { registerAiUsageIpc } from './registrations/ai-usage';
import { registerProviderKeysIpc } from './registrations/provider-keys';
import { registerProviderModelsIpc } from './registrations/provider-models';
import { registerVideoIpc } from './registrations/video';
import { registerSttIpc } from './registrations/stt';
import { registerVideoStudioIpc } from './registrations/video-studio';
import { registerStudioIpc } from './registrations/studio';
import { logEngine } from '../../logging/log-engine';

export function registerAllIPC(): void {
  // Module operations (native player) — registers its own handlers.
  registerModuleHandlers();

  // Per-feature handler registration.
  registerAppShellIpc();
  registerFileIpc();
  registerBundleIpc();
  registerRenderIpc();
  registerSettingsIpc();
  registerWhisperIpc();
  registerLlmIpc();
  registerFlowsIpc();
  registerImageStudioIpc();
  registerThumbnailIpc();
  registerLogIpc();
  registerFrameExtractorIpc();
  registerAudioIpc();
  registerEmbeddingIpc();
  registerSdImageIpc();
  registerSdVideoIpc();
  registerTsxJobsIpc();
  registerModelLibraryIpc();
  registerLocalLlmIpc();
  registerSystemIpc();
  registerDownloadIpc();
  registerModerationIpc();
  registerAiUsageIpc();
  registerProviderKeysIpc();
  registerProviderModelsIpc();
  registerVideoIpc();
  registerSttIpc();
  registerVideoStudioIpc();
  registerStudioIpc();

  logEngine.info('IPC', 'IPC handlers registered');
}
