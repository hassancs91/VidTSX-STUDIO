import { registerModuleHandlers } from './module-handlers';
import { registerAppShellIpc } from './registrations/app-shell';
import { registerCreatorIpc } from './registrations/creator';
import { registerFileIpc } from './registrations/file';
import { registerBundleIpc } from './registrations/bundle';
import { registerRenderIpc } from './registrations/render';
import { registerSettingsIpc } from './registrations/settings';
import { registerWhisperIpc } from './registrations/whisper';
import { registerStudioIpc } from './registrations/studio';
import { registerLlmIpc } from './registrations/llm';
import { registerWhiteboardIpc } from './registrations/whiteboard';
import { registerFlowsIpc } from './registrations/flows';
import { registerImageStudioIpc } from './registrations/image-studio';
import { registerThumbnailIpc } from './registrations/thumbnail';
import { registerLogIpc } from './registrations/log';
import { registerFrameExtractorIpc } from './registrations/frame-extractor';
import { registerAudioIpc } from './registrations/audio';
import { registerEmbeddingIpc } from './registrations/embedding';
import { registerSdImageIpc } from './registrations/sd-image';
import { registerLocalLlmIpc } from './registrations/local-llm';
import { registerSystemIpc } from './registrations/system';
import { registerDownloadIpc } from './registrations/download';
import { registerModerationIpc } from './registrations/moderation';
import { registerAiUsageIpc } from './registrations/ai-usage';
import { registerHomepageIpc } from './registrations/homepage';
import { registerProviderKeysIpc } from './registrations/provider-keys';
import { registerVideoIpc } from './registrations/video';
import { registerSttIpc } from './registrations/stt';
import { registerVideoStudioIpc } from './registrations/video-studio';
import { registerAutoCutIpc } from './registrations/auto-cut';
import { setupLicenseIPC } from '../../license/license-manager';
import { setupAutoUpdaterIPC } from '../../updater/auto-updater';
import { logEngine } from '../../logging/log-engine';

export function registerAllIPC(): void {
  // Module operations (native player) — registers its own handlers.
  registerModuleHandlers();

  // License + auto-updater own their IPC plumbing.
  setupLicenseIPC();
  setupAutoUpdaterIPC();

  // Per-feature handler registration.
  registerAppShellIpc();
  registerCreatorIpc();
  registerFileIpc();
  registerBundleIpc();
  registerRenderIpc();
  registerSettingsIpc();
  registerWhisperIpc();
  registerStudioIpc();
  registerLlmIpc();
  registerWhiteboardIpc();
  registerFlowsIpc();
  registerImageStudioIpc();
  registerThumbnailIpc();
  registerLogIpc();
  registerFrameExtractorIpc();
  registerAudioIpc();
  registerEmbeddingIpc();
  registerSdImageIpc();
  registerLocalLlmIpc();
  registerSystemIpc();
  registerDownloadIpc();
  registerModerationIpc();
  registerAiUsageIpc();
  registerHomepageIpc();
  registerProviderKeysIpc();
  registerVideoIpc();
  registerSttIpc();
  registerVideoStudioIpc();
  registerAutoCutIpc();

  logEngine.info('IPC', 'IPC handlers registered');
}
