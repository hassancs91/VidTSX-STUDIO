// One-shot migration: split src/main/ipc/register.ts into per-feature
// registration modules under src/main/ipc/registrations/. Master register.ts
// becomes a thin orchestrator that calls each per-feature register function.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'src/main/ipc/registrations');

// Each feature: name, registration function, the handlers file to import from,
// and the list of (channel, handler) pairs to register. Channels with dead
// stub handlers (Templates*, ApiVerify, ApiSetKey) are intentionally dropped.
const features = [
  {
    name: 'app-shell',
    fn: 'registerAppShellIpc',
    blocks: [
      {
        from: './app-handlers',
        names: ['handleAppGetInfo', 'handleAppOpenExternal'],
      },
      {
        from: './creator-handlers',
        names: ['handleAppGetIsDev'],
      },
      {
        from: './menu-handlers',
        names: ['handleContextMenuShow'],
      },
      {
        from: './clipboard-handlers',
        names: ['handleClipboardReadText'],
      },
      {
        from: './screenshot-handlers',
        names: [
          'handleScreenshotCopy',
          'handleScreenshotSave',
          'handleScreenshotSaveToPath',
          'handleScreenshotCaptureHtml',
        ],
      },
      {
        from: './prototyper-handlers',
        names: ['handlePrototyperRecordStart', 'handlePrototyperRecordStop'],
      },
    ],
    pairs: [
      ['APP_GET_INFO', 'handleAppGetInfo'],
      ['APP_OPEN_EXTERNAL', 'handleAppOpenExternal'],
      ['APP_GET_IS_DEV', 'handleAppGetIsDev'],
      ['CONTEXT_MENU_SHOW', 'handleContextMenuShow'],
      ['CLIPBOARD_READ_TEXT', 'handleClipboardReadText'],
      ['SCREENSHOT_COPY', 'handleScreenshotCopy'],
      ['SCREENSHOT_SAVE', 'handleScreenshotSave'],
      ['SCREENSHOT_SAVE_TO_PATH', 'handleScreenshotSaveToPath'],
      ['SCREENSHOT_CAPTURE_HTML', 'handleScreenshotCaptureHtml'],
      ['PROTOTYPER_RECORD_START', 'handlePrototyperRecordStart'],
      ['PROTOTYPER_RECORD_STOP', 'handlePrototyperRecordStop'],
    ],
  },
  {
    name: 'creator',
    fn: 'registerCreatorIpc',
    blocks: [
      {
        from: './creator-handlers',
        names: [
          'handleCreatorPushTemplate',
          'handleCreatorGenerateThumbnail',
          'handleCreatorLoadPushDraft',
          'handleCreatorSavePushDraft',
          'handleCreatorArchiveTsx',
        ],
      },
    ],
    pairs: [
      ['CREATOR_PUSH_TEMPLATE', 'handleCreatorPushTemplate'],
      ['CREATOR_GENERATE_THUMBNAIL', 'handleCreatorGenerateThumbnail'],
      ['CREATOR_LOAD_PUSH_DRAFT', 'handleCreatorLoadPushDraft'],
      ['CREATOR_SAVE_PUSH_DRAFT', 'handleCreatorSavePushDraft'],
      ['CREATOR_ARCHIVE_TSX', 'handleCreatorArchiveTsx'],
    ],
  },
  {
    name: 'file',
    fn: 'registerFileIpc',
    blocks: [
      {
        from: './file-handlers',
        names: [
          'handleFileList',
          'handleFileRead',
          'handleFileWrite',
          'handleFileDelete',
          'handleFileCreateFolder',
          'handleFileImport',
          'handleFileReadBinary',
          'handleFileRename',
          'handleFileMove',
          'handleFileGetProjectsDir',
          'handleFileGetAssetsDir',
          'handleDialogOpen',
          'handleDialogSave',
        ],
      },
    ],
    pairs: [
      ['FILE_LIST', 'handleFileList'],
      ['FILE_READ', 'handleFileRead'],
      ['FILE_WRITE', 'handleFileWrite'],
      ['FILE_DELETE', 'handleFileDelete'],
      ['FILE_CREATE_FOLDER', 'handleFileCreateFolder'],
      ['FILE_IMPORT', 'handleFileImport'],
      ['FILE_READ_BINARY', 'handleFileReadBinary'],
      ['FILE_RENAME', 'handleFileRename'],
      ['FILE_MOVE', 'handleFileMove'],
      ['FILE_GET_PROJECTS_DIR', 'handleFileGetProjectsDir'],
      ['FILE_GET_ASSETS_DIR', 'handleFileGetAssetsDir'],
      ['DIALOG_OPEN', 'handleDialogOpen'],
      ['DIALOG_SAVE', 'handleDialogSave'],
    ],
  },
  {
    name: 'bundle',
    fn: 'registerBundleIpc',
    blocks: [
      {
        from: './bundle-handlers',
        names: ['handleBundleCreate', 'handleBundleInvalidate'],
      },
      {
        from: './tsx-handlers',
        names: ['handleTsxValidate'],
      },
    ],
    pairs: [
      ['BUNDLE_CREATE', 'handleBundleCreate'],
      ['BUNDLE_INVALIDATE', 'handleBundleInvalidate'],
      ['TSX_VALIDATE', 'handleTsxValidate'],
    ],
  },
  {
    name: 'render',
    fn: 'registerRenderIpc',
    blocks: [
      {
        from: './render-handlers',
        names: [
          'handleRenderStart',
          'handleRenderCancel',
          'handleRenderQueueGet',
          'handleRenderQueueSave',
          'handleRenderQueueLoad',
          'handleRenderOpenFile',
          'handleRenderOpenFolder',
          'handleRenderGetVideosDir',
          'handleRenderHistoryLoad',
          'handleRenderHistoryAppend',
        ],
      },
    ],
    pairs: [
      ['RENDER_START', 'handleRenderStart'],
      ['RENDER_CANCEL', 'handleRenderCancel'],
      ['RENDER_QUEUE_GET', 'handleRenderQueueGet'],
      ['RENDER_QUEUE_SAVE', 'handleRenderQueueSave'],
      ['RENDER_QUEUE_LOAD', 'handleRenderQueueLoad'],
      ['RENDER_OPEN_FILE', 'handleRenderOpenFile'],
      ['RENDER_OPEN_FOLDER', 'handleRenderOpenFolder'],
      ['RENDER_GET_VIDEOS_DIR', 'handleRenderGetVideosDir'],
      ['RENDER_HISTORY_LOAD', 'handleRenderHistoryLoad'],
      ['RENDER_HISTORY_APPEND', 'handleRenderHistoryAppend'],
    ],
  },
  {
    name: 'settings',
    fn: 'registerSettingsIpc',
    blocks: [
      {
        from: './settings-handlers',
        names: [
          'handleSettingsGet',
          'handleSettingsSetOutputFolder',
          'handleSettingsSetWhisperModel',
          'handleSettingsSetAiModelsFolder',
          'handleSettingsSetRenderTimeout',
          'handleSettingsSetRenderDefaultCpuUsage',
          'handleSettingsSetRenderDefaultGpuBackend',
          'handleSettingsSetRenderDefaultHardwareAcceleration',
          'handleDialogOpenFolder',
          'handlePromptPresetsGet',
          'handlePromptPresetsSave',
          'handlePromptPresetsReset',
        ],
      },
    ],
    pairs: [
      ['SETTINGS_GET', 'handleSettingsGet'],
      ['SETTINGS_SET_OUTPUT_FOLDER', 'handleSettingsSetOutputFolder'],
      ['SETTINGS_SET_WHISPER_MODEL', 'handleSettingsSetWhisperModel'],
      ['SETTINGS_SET_AI_MODELS_FOLDER', 'handleSettingsSetAiModelsFolder'],
      ['SETTINGS_SET_RENDER_TIMEOUT', 'handleSettingsSetRenderTimeout'],
      ['SETTINGS_SET_RENDER_DEFAULT_CPU_USAGE', 'handleSettingsSetRenderDefaultCpuUsage'],
      ['SETTINGS_SET_RENDER_DEFAULT_GPU_BACKEND', 'handleSettingsSetRenderDefaultGpuBackend'],
      ['SETTINGS_SET_RENDER_DEFAULT_HARDWARE_ACCELERATION', 'handleSettingsSetRenderDefaultHardwareAcceleration'],
      ['DIALOG_OPEN_FOLDER', 'handleDialogOpenFolder'],
      ['PROMPT_PRESETS_GET', 'handlePromptPresetsGet'],
      ['PROMPT_PRESETS_SAVE', 'handlePromptPresetsSave'],
      ['PROMPT_PRESETS_RESET', 'handlePromptPresetsReset'],
    ],
  },
  {
    name: 'whisper',
    fn: 'registerWhisperIpc',
    blocks: [
      {
        from: './whisper-handlers',
        names: [
          'handleWhisperBinaryStatus',
          'handleWhisperBinaryInstall',
          'handleWhisperModelsList',
          'handleWhisperModelDownload',
          'handleWhisperModelDelete',
          'handleWhisperTranscribe',
          'handleWhisperTranscribeCancel',
        ],
      },
      {
        from: './transcription-handlers',
        names: [
          'handleTranscriptionProjectList',
          'handleTranscriptionProjectSave',
          'handleTranscriptionProjectLoad',
          'handleTranscriptionProjectDelete',
        ],
      },
    ],
    pairs: [
      ['WHISPER_BINARY_STATUS', 'handleWhisperBinaryStatus'],
      ['WHISPER_BINARY_INSTALL', 'handleWhisperBinaryInstall'],
      ['WHISPER_MODELS_LIST', 'handleWhisperModelsList'],
      ['WHISPER_MODEL_DOWNLOAD', 'handleWhisperModelDownload'],
      ['WHISPER_MODEL_DELETE', 'handleWhisperModelDelete'],
      ['WHISPER_TRANSCRIBE', 'handleWhisperTranscribe'],
      ['WHISPER_TRANSCRIBE_CANCEL', 'handleWhisperTranscribeCancel'],
      ['TRANSCRIPTION_PROJECT_LIST', 'handleTranscriptionProjectList'],
      ['TRANSCRIPTION_PROJECT_SAVE', 'handleTranscriptionProjectSave'],
      ['TRANSCRIPTION_PROJECT_LOAD', 'handleTranscriptionProjectLoad'],
      ['TRANSCRIPTION_PROJECT_DELETE', 'handleTranscriptionProjectDelete'],
    ],
  },
  {
    name: 'studio',
    fn: 'registerStudioIpc',
    blocks: [
      {
        from: './studio-handlers',
        names: [
          'handleStudioFfprobe',
          'handleStudioProjectList',
          'handleStudioProjectSave',
          'handleStudioProjectLoad',
          'handleStudioProjectDelete',
          'handleStudioTsxSave',
          'handleStudioTsxGetPath',
        ],
      },
      {
        from: './llm-handlers',
        names: ['handleTsxAnalyze'],
      },
    ],
    pairs: [
      ['STUDIO_FFPROBE', 'handleStudioFfprobe'],
      ['STUDIO_PROJECT_LIST', 'handleStudioProjectList'],
      ['STUDIO_PROJECT_SAVE', 'handleStudioProjectSave'],
      ['STUDIO_PROJECT_LOAD', 'handleStudioProjectLoad'],
      ['STUDIO_PROJECT_DELETE', 'handleStudioProjectDelete'],
      ['STUDIO_TSX_ANALYZE', 'handleTsxAnalyze'],
      ['STUDIO_TSX_SAVE', 'handleStudioTsxSave'],
      ['STUDIO_TSX_GET_PATH', 'handleStudioTsxGetPath'],
    ],
  },
  {
    name: 'llm',
    fn: 'registerLlmIpc',
    blocks: [
      {
        from: './llm-handlers',
        names: [
          'handleLlmProvidersGet',
          'handleLlmProvidersSave',
          'handleLlmProviderTest',
          'handleLlmGenerate',
          'handleLlmChatGenerate',
          'handleLlmCancel',
        ],
      },
      {
        from: './skills-handlers',
        names: ['handleSkillsList'],
      },
    ],
    pairs: [
      ['LLM_PROVIDERS_GET', 'handleLlmProvidersGet'],
      ['LLM_PROVIDERS_SAVE', 'handleLlmProvidersSave'],
      ['LLM_PROVIDER_TEST', 'handleLlmProviderTest'],
      ['LLM_GENERATE', 'handleLlmGenerate'],
      ['LLM_CHAT_GENERATE', 'handleLlmChatGenerate'],
      ['LLM_CANCEL', 'handleLlmCancel'],
      ['SKILLS_LIST', 'handleSkillsList'],
    ],
  },
  {
    name: 'whiteboard',
    fn: 'registerWhiteboardIpc',
    blocks: [
      {
        from: './whiteboard-handlers',
        names: [
          'handleWhiteboardProjectList',
          'handleWhiteboardProjectSave',
          'handleWhiteboardProjectLoad',
          'handleWhiteboardProjectDelete',
          'handleWhiteboardUserSvgList',
          'handleWhiteboardUserSvgSave',
          'handleWhiteboardUserSvgDelete',
          'handleWhiteboardUserImageList',
          'handleWhiteboardUserImageUpload',
          'handleWhiteboardUserImageDelete',
        ],
      },
    ],
    pairs: [
      ['WHITEBOARD_PROJECT_LIST', 'handleWhiteboardProjectList'],
      ['WHITEBOARD_PROJECT_SAVE', 'handleWhiteboardProjectSave'],
      ['WHITEBOARD_PROJECT_LOAD', 'handleWhiteboardProjectLoad'],
      ['WHITEBOARD_PROJECT_DELETE', 'handleWhiteboardProjectDelete'],
      ['WHITEBOARD_USER_SVG_LIST', 'handleWhiteboardUserSvgList'],
      ['WHITEBOARD_USER_SVG_SAVE', 'handleWhiteboardUserSvgSave'],
      ['WHITEBOARD_USER_SVG_DELETE', 'handleWhiteboardUserSvgDelete'],
      ['WHITEBOARD_USER_IMAGE_LIST', 'handleWhiteboardUserImageList'],
      ['WHITEBOARD_USER_IMAGE_UPLOAD', 'handleWhiteboardUserImageUpload'],
      ['WHITEBOARD_USER_IMAGE_DELETE', 'handleWhiteboardUserImageDelete'],
    ],
  },
  {
    name: 'design',
    fn: 'registerDesignIpc',
    blocks: [
      {
        from: './design-handlers',
        names: [
          'handleDesignProjectList',
          'handleDesignProjectCreate',
          'handleDesignProjectLoad',
          'handleDesignProjectUpdate',
          'handleDesignProjectDelete',
          'handleDesignCreate',
          'handleDesignLoad',
          'handleDesignUpdate',
          'handleDesignDelete',
        ],
      },
    ],
    pairs: [
      ['DESIGN_PROJECT_LIST', 'handleDesignProjectList'],
      ['DESIGN_PROJECT_CREATE', 'handleDesignProjectCreate'],
      ['DESIGN_PROJECT_LOAD', 'handleDesignProjectLoad'],
      ['DESIGN_PROJECT_UPDATE', 'handleDesignProjectUpdate'],
      ['DESIGN_PROJECT_DELETE', 'handleDesignProjectDelete'],
      ['DESIGN_CREATE', 'handleDesignCreate'],
      ['DESIGN_LOAD', 'handleDesignLoad'],
      ['DESIGN_UPDATE', 'handleDesignUpdate'],
      ['DESIGN_DELETE', 'handleDesignDelete'],
    ],
  },
  {
    name: 'flows',
    fn: 'registerFlowsIpc',
    blocks: [
      {
        from: './flows-handlers',
        names: [
          'handleFlowsProjectList',
          'handleFlowsProjectCreate',
          'handleFlowsProjectLoad',
          'handleFlowsProjectUpdate',
          'handleFlowsProjectDelete',
        ],
      },
    ],
    pairs: [
      ['FLOWS_PROJECT_LIST', 'handleFlowsProjectList'],
      ['FLOWS_PROJECT_CREATE', 'handleFlowsProjectCreate'],
      ['FLOWS_PROJECT_LOAD', 'handleFlowsProjectLoad'],
      ['FLOWS_PROJECT_UPDATE', 'handleFlowsProjectUpdate'],
      ['FLOWS_PROJECT_DELETE', 'handleFlowsProjectDelete'],
    ],
  },
  {
    name: 'image-studio',
    fn: 'registerImageStudioIpc',
    blocks: [
      {
        from: './image-handlers',
        names: [
          'handleImageProvidersGet',
          'handleImageProvidersSave',
          'handleImageProviderTest',
          'handleImageModelsGet',
          'handleImageGenerate',
          'handleImageProviderSwitch',
        ],
      },
      {
        from: './image-studio-handlers',
        names: [
          'handleImageStudioSave',
          'handleImageStudioList',
          'handleImageStudioDelete',
          'handleImageStudioSaveAs',
          'handleImageStudioCopy',
          'handleImageStudioRead',
        ],
      },
      {
        from: './image-studio-folder-handlers',
        names: [
          'handleImageStudioFolderCreate',
          'handleImageStudioFolderRename',
          'handleImageStudioFolderDelete',
          'handleImageStudioMoveToFolder',
        ],
      },
      {
        from: './ref-image-handlers',
        names: [
          'handleRefImageSave',
          'handleRefImageList',
          'handleRefImageDelete',
          'handleRefImageToggle',
          'handleRefImageRead',
        ],
      },
    ],
    pairs: [
      ['IMAGE_PROVIDERS_GET', 'handleImageProvidersGet'],
      ['IMAGE_PROVIDERS_SAVE', 'handleImageProvidersSave'],
      ['IMAGE_PROVIDER_TEST', 'handleImageProviderTest'],
      ['IMAGE_MODELS_GET', 'handleImageModelsGet'],
      ['IMAGE_GENERATE', 'handleImageGenerate'],
      ['IMAGE_PROVIDER_SWITCH', 'handleImageProviderSwitch'],
      ['IMAGE_STUDIO_SAVE', 'handleImageStudioSave'],
      ['IMAGE_STUDIO_LIST', 'handleImageStudioList'],
      ['IMAGE_STUDIO_DELETE', 'handleImageStudioDelete'],
      ['IMAGE_STUDIO_SAVE_AS', 'handleImageStudioSaveAs'],
      ['IMAGE_STUDIO_COPY', 'handleImageStudioCopy'],
      ['IMAGE_STUDIO_READ', 'handleImageStudioRead'],
      ['IMAGE_STUDIO_FOLDER_CREATE', 'handleImageStudioFolderCreate'],
      ['IMAGE_STUDIO_FOLDER_RENAME', 'handleImageStudioFolderRename'],
      ['IMAGE_STUDIO_FOLDER_DELETE', 'handleImageStudioFolderDelete'],
      ['IMAGE_STUDIO_MOVE_TO_FOLDER', 'handleImageStudioMoveToFolder'],
      ['REF_IMAGE_SAVE', 'handleRefImageSave'],
      ['REF_IMAGE_LIST', 'handleRefImageList'],
      ['REF_IMAGE_DELETE', 'handleRefImageDelete'],
      ['REF_IMAGE_TOGGLE', 'handleRefImageToggle'],
      ['REF_IMAGE_READ', 'handleRefImageRead'],
    ],
  },
  {
    name: 'thumbnail',
    fn: 'registerThumbnailIpc',
    blocks: [
      { from: './thumbnail-handlers', names: ['handleThumbnailRead'] },
    ],
    pairs: [['THUMBNAIL_READ', 'handleThumbnailRead']],
  },
  {
    name: 'log',
    fn: 'registerLogIpc',
    blocks: [{ from: './log-handlers', names: ['handleLogWrite'] }],
    pairs: [['LOG_WRITE', 'handleLogWrite']],
  },
  {
    name: 'frame-extractor',
    fn: 'registerFrameExtractorIpc',
    blocks: [
      {
        from: './tools-handlers',
        names: [
          'handleFrameExtract',
          'handleFrameExtractCancel',
          'handleFrameSaveZip',
          'handleFrameSaveSingle',
        ],
      },
    ],
    pairs: [
      ['TOOLS_FRAME_EXTRACT', 'handleFrameExtract'],
      ['TOOLS_FRAME_EXTRACT_CANCEL', 'handleFrameExtractCancel'],
      ['TOOLS_FRAME_SAVE_ZIP', 'handleFrameSaveZip'],
      ['TOOLS_FRAME_SAVE_SINGLE', 'handleFrameSaveSingle'],
    ],
  },
  {
    name: 'audio',
    fn: 'registerAudioIpc',
    blocks: [
      {
        from: './audio-handlers',
        names: [
          'handleAudioStatus',
          'handleAudioModelsList',
          'handleAudioModelDownload',
          'handleAudioModelDelete',
          'handleAudioSttLoadModel',
          'handleAudioSttTranscribe',
          'handleAudioSttStreamStart',
          'handleAudioSttStreamFeed',
          'handleAudioSttStreamStop',
          'handleAudioTtsLoadModel',
          'handleAudioTtsGenerate',
          'handleAudioSettingsGet',
          'handleAudioSettingsSave',
        ],
      },
    ],
    pairs: [
      ['AUDIO_STATUS', 'handleAudioStatus'],
      ['AUDIO_MODELS_LIST', 'handleAudioModelsList'],
      ['AUDIO_MODEL_DOWNLOAD', 'handleAudioModelDownload'],
      ['AUDIO_MODEL_DELETE', 'handleAudioModelDelete'],
      ['AUDIO_STT_LOAD_MODEL', 'handleAudioSttLoadModel'],
      ['AUDIO_STT_TRANSCRIBE', 'handleAudioSttTranscribe'],
      ['AUDIO_STT_STREAM_START', 'handleAudioSttStreamStart'],
      ['AUDIO_STT_STREAM_FEED', 'handleAudioSttStreamFeed'],
      ['AUDIO_STT_STREAM_STOP', 'handleAudioSttStreamStop'],
      ['AUDIO_TTS_LOAD_MODEL', 'handleAudioTtsLoadModel'],
      ['AUDIO_TTS_GENERATE', 'handleAudioTtsGenerate'],
      ['AUDIO_SETTINGS_GET', 'handleAudioSettingsGet'],
      ['AUDIO_SETTINGS_SAVE', 'handleAudioSettingsSave'],
    ],
  },
  {
    name: 'embedding',
    fn: 'registerEmbeddingIpc',
    blocks: [
      {
        from: './embedding-handlers',
        names: [
          'handleEmbeddingModelsList',
          'handleEmbeddingModelDownload',
          'handleEmbeddingModelDelete',
          'handleEmbeddingLoadModel',
          'handleEmbeddingUnloadModel',
          'handleEmbeddingEmbed',
        ],
      },
    ],
    pairs: [
      ['EMBEDDING_MODELS_LIST', 'handleEmbeddingModelsList'],
      ['EMBEDDING_MODEL_DOWNLOAD', 'handleEmbeddingModelDownload'],
      ['EMBEDDING_MODEL_DELETE', 'handleEmbeddingModelDelete'],
      ['EMBEDDING_LOAD_MODEL', 'handleEmbeddingLoadModel'],
      ['EMBEDDING_UNLOAD_MODEL', 'handleEmbeddingUnloadModel'],
      ['EMBEDDING_EMBED', 'handleEmbeddingEmbed'],
    ],
  },
  {
    name: 'sd-image',
    fn: 'registerSdImageIpc',
    blocks: [
      {
        from: './sdimage-handlers',
        names: [
          'handleSdImageStatus',
          'handleSdImageModelsList',
          'handleSdImageModelDownload',
          'handleSdImageModelDelete',
          'handleSdImageCliStatus',
          'handleSdImageSetActiveModel',
          'handleSdImageGenerate',
          'handleSdImageCancel',
          'handleSdImageCancelAll',
          'handleSdImageQueueGet',
          'handleSdImageSettingsGet',
          'handleSdImageSettingsSave',
        ],
      },
    ],
    pairs: [
      ['SDIMAGE_STATUS', 'handleSdImageStatus'],
      ['SDIMAGE_MODELS_LIST', 'handleSdImageModelsList'],
      ['SDIMAGE_MODEL_DOWNLOAD', 'handleSdImageModelDownload'],
      ['SDIMAGE_MODEL_DELETE', 'handleSdImageModelDelete'],
      ['SDIMAGE_CLI_STATUS', 'handleSdImageCliStatus'],
      ['SDIMAGE_SET_ACTIVE_MODEL', 'handleSdImageSetActiveModel'],
      ['SDIMAGE_GENERATE', 'handleSdImageGenerate'],
      ['SDIMAGE_CANCEL', 'handleSdImageCancel'],
      ['SDIMAGE_CANCEL_ALL', 'handleSdImageCancelAll'],
      ['SDIMAGE_QUEUE_GET', 'handleSdImageQueueGet'],
      ['SDIMAGE_SETTINGS_GET', 'handleSdImageSettingsGet'],
      ['SDIMAGE_SETTINGS_SAVE', 'handleSdImageSettingsSave'],
    ],
  },
  {
    name: 'local-llm',
    fn: 'registerLocalLlmIpc',
    blocks: [
      {
        from: './llm-local-handlers',
        names: [
          'handleLocalLlmStatus',
          'handleLocalLlmModelsList',
          'handleLocalLlmModelDownload',
          'handleLocalLlmModelDelete',
          'handleLocalLlmLoadModel',
          'handleLocalLlmUnloadModel',
          'handleLocalLlmGenerate',
          'handleLocalLlmChat',
          'handleLocalLlmCancel',
          'handleLocalLlmSessionClear',
          'handleLocalLlmGpuInfo',
          'handleLocalLlmSettingsGet',
          'handleLocalLlmSettingsSave',
        ],
      },
    ],
    pairs: [
      ['LOCAL_LLM_STATUS', 'handleLocalLlmStatus'],
      ['LOCAL_LLM_MODELS_LIST', 'handleLocalLlmModelsList'],
      ['LOCAL_LLM_MODEL_DOWNLOAD', 'handleLocalLlmModelDownload'],
      ['LOCAL_LLM_MODEL_DELETE', 'handleLocalLlmModelDelete'],
      ['LOCAL_LLM_LOAD_MODEL', 'handleLocalLlmLoadModel'],
      ['LOCAL_LLM_UNLOAD_MODEL', 'handleLocalLlmUnloadModel'],
      ['LOCAL_LLM_GENERATE', 'handleLocalLlmGenerate'],
      ['LOCAL_LLM_CHAT', 'handleLocalLlmChat'],
      ['LOCAL_LLM_CANCEL', 'handleLocalLlmCancel'],
      ['LOCAL_LLM_SESSION_CLEAR', 'handleLocalLlmSessionClear'],
      ['LOCAL_LLM_GPU_INFO', 'handleLocalLlmGpuInfo'],
      ['LOCAL_LLM_SETTINGS_GET', 'handleLocalLlmSettingsGet'],
      ['LOCAL_LLM_SETTINGS_SAVE', 'handleLocalLlmSettingsSave'],
    ],
  },
  {
    name: 'system',
    fn: 'registerSystemIpc',
    blocks: [
      {
        from: './system-info-handlers',
        names: ['handleSystemInfoGet', 'handlePyTorchPipInstall'],
      },
    ],
    pairs: [
      ['SYSTEM_INFO_GET', 'handleSystemInfoGet'],
      ['PYTORCH_PIP_INSTALL', 'handlePyTorchPipInstall'],
    ],
  },
  {
    name: 'download',
    fn: 'registerDownloadIpc',
    blocks: [
      {
        from: './download-handlers',
        names: [
          'handleDownloadEnqueue',
          'handleDownloadPause',
          'handleDownloadResume',
          'handleDownloadCancel',
          'handleDownloadGetAll',
          'initDownloadProgressBroadcast',
        ],
      },
    ],
    pairs: [
      ['DOWNLOAD_ENQUEUE', 'handleDownloadEnqueue'],
      ['DOWNLOAD_PAUSE', 'handleDownloadPause'],
      ['DOWNLOAD_RESUME', 'handleDownloadResume'],
      ['DOWNLOAD_CANCEL', 'handleDownloadCancel'],
      ['DOWNLOAD_GET_ALL', 'handleDownloadGetAll'],
    ],
    extraTail: '  initDownloadProgressBroadcast();\n',
  },
  {
    name: 'moderation',
    fn: 'registerModerationIpc',
    blocks: [
      { from: './moderation-handlers', names: ['handleModerationCheck'] },
    ],
    pairs: [['MODERATION_CHECK', 'handleModerationCheck']],
  },
  {
    name: 'ai-usage',
    fn: 'registerAiUsageIpc',
    blocks: [
      {
        from: './ai-usage-handlers',
        names: [
          'handleAiUsageGetSummary',
          'handleAiUsageGetChart',
          'handleAiUsageGetLog',
          'handleAiUsageClear',
        ],
      },
    ],
    pairs: [
      ['AI_USAGE_GET_SUMMARY', 'handleAiUsageGetSummary'],
      ['AI_USAGE_GET_CHART', 'handleAiUsageGetChart'],
      ['AI_USAGE_GET_LOG', 'handleAiUsageGetLog'],
      ['AI_USAGE_CLEAR', 'handleAiUsageClear'],
    ],
  },
  {
    name: 'homepage',
    fn: 'registerHomepageIpc',
    blocks: [
      { from: './homepage-handlers', names: ['handleHomepageGet'] },
    ],
    pairs: [['HOMEPAGE_GET', 'handleHomepageGet']],
  },
];

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

for (const f of features) {
  const importLines = f.blocks
    .map((b) => `import {\n${b.names.map((n) => `  ${n},`).join('\n')}\n} from '.${b.from.replace(/^\./, '')}';`)
    .join('\n');
  // Each block import is from './<file>' but parent dir is registrations/, so prefix '../':
  const fixedImports = importLines.replace(/from '\.\.\//g, "from '../");
  // Now prefix every block import with '../' (since registrations/ is one folder deeper).
  const properImports = f.blocks
    .map(
      (b) =>
        `import {\n${b.names.map((n) => `  ${n},`).join('\n')}\n} from '../${b.from.replace(/^\.\//, '')}';`,
    )
    .join('\n');
  const handles = f.pairs
    .map(([channel, handler]) => `  ipcMain.handle(IPC.${channel}, ${handler});`)
    .join('\n');
  const tail = f.extraTail || '';
  const content =
    `import { ipcMain } from 'electron';\n` +
    `import { IPC } from '@shared/ipc/channels';\n` +
    `${properImports}\n\n` +
    `export function ${f.fn}(): void {\n` +
    `${handles}\n` +
    tail +
    `}\n`;
  fs.writeFileSync(path.join(outDir, `${f.name}.ts`), content);
}

// Write index.ts barrel
const indexContent =
  `// Auto-generated by scripts/split-register.mjs.\n` +
  features
    .map((f) => `export { ${f.fn} } from './${f.name}';`)
    .join('\n') +
  `\n`;
fs.writeFileSync(path.join(outDir, 'index.ts'), indexContent);

// Rewrite register.ts to call each feature register function in order.
const registerLines = features.map((f) => `  ${f.fn}();`).join('\n');
const importsList = features
  .map((f) => `import { ${f.fn} } from './registrations/${f.name}';`)
  .join('\n');
const registerContent =
  `import { registerModuleHandlers } from './module-handlers';\n` +
  `${importsList}\n` +
  `import { logEngine } from '../../logging/log-engine';\n\n` +
  `export function registerAllIPC(): void {\n` +
  `  // Module operations (native player) — registers its own handlers.\n` +
  `  registerModuleHandlers();\n\n` +
  `  // Per-feature handler registration.\n` +
  `${registerLines}\n\n` +
  `  logEngine.info('IPC', 'IPC handlers registered');\n` +
  `}\n`;
fs.writeFileSync(path.join(repoRoot, 'src/main/ipc/register.ts'), registerContent);

console.log(`Wrote ${features.length} registration modules + index.ts to ${outDir}`);
console.log(`Rewrote register.ts (${registerContent.split('\n').length} lines)`);
