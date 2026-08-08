import type {
  FileListRequest,
  FileListResponse,
  FileReadRequest,
  FileReadResponse,
  FileWriteRequest,
  FileWriteResponse,
  FileDeleteRequest,
  FileDeleteResponse,
  FileCreateFolderRequest,
  FileCreateFolderResponse,
  FileImportRequest,
  FileImportResponse,
  DialogOpenRequest,
  DialogOpenResponse,
  BundleCreateRequest,
  BundleCreateResponse,
  BundleInvalidateRequest,
  BundleInvalidateResponse,
  BundleProgressEvent,
  ModuleTranspileRequest,
  ModuleTranspileResponse,
  ModuleServerUrlResponse,
  TsxValidateRequest,
  TsxValidateResponse,
  ScreenshotCopyRequest,
  ScreenshotCopyResponse,
  ScreenshotSaveRequest,
  ScreenshotSaveResponse,
  ScreenshotSaveToPathRequest,
  ScreenshotSaveToPathResponse,
  RenderStartRequest,
  RenderStartResponse,
  RenderCancelRequest,
  RenderCancelResponse,
  RenderQueueGetResponse,
  RenderProgressEvent,
  RenderCompleteEvent,
  RenderEncoderResolvedEvent,
  RenderQueueSaveRequest,
  RenderQueueSaveResponse,
  RenderQueueLoadResponse,
  RenderOpenFileRequest,
  RenderOpenFileResponse,
  RenderOpenFolderRequest,
  RenderOpenFolderResponse,
  RenderGetVideosDirResponse,
  RenderHistoryLoadResponse,
  RenderHistoryAppendRequest,
  RenderHistoryAppendResponse,
  SettingsGetResponse,
  SettingsSetOutputFolderRequest,
  SettingsSetOutputFolderResponse,
  SettingsSetWhisperModelRequest,
  SettingsSetWhisperModelResponse,
  DialogOpenFolderResponse,
  LlmProvidersGetResponse,
  LlmProvidersSaveRequest,
  LlmProvidersSaveResponse,
  LlmProviderTestRequest,
  LlmProviderTestResponse,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmChatGenerateRequest,
  LlmChatGenerateResponse,
  LlmCancelResponse,
  SkillsListResponse,
  ImageStudioFolderCreateRequest,
  ImageStudioFolderCreateResponse,
  ImageStudioFolderRenameRequest,
  ImageStudioFolderRenameResponse,
  ImageStudioFolderDeleteRequest,
  ImageStudioFolderDeleteResponse,
  ImageStudioMoveToFolderRequest,
  ImageStudioMoveToFolderResponse,
  ImageProviderSwitchRequest,
  ImageProviderSwitchResponse,
  SettingsSetAiModelsFolderRequest,
  SettingsSetAiModelsFolderResponse,
  SettingsSetRenderTimeoutRequest,
  SettingsSetRenderTimeoutResponse,
  SettingsSetRenderDefaultCpuUsageRequest,
  SettingsSetRenderDefaultCpuUsageResponse,
  SettingsSetRenderDefaultGpuBackendRequest,
  SettingsSetRenderDefaultGpuBackendResponse,
  SettingsSetRenderDefaultHardwareAccelerationRequest,
  SettingsSetRenderDefaultHardwareAccelerationResponse,
  SystemInfoGetResponse,
  PyTorchPipInstallRequest,
  PyTorchPipInstallResponse,
  DownloadEnqueueRequest,
  DownloadEnqueueResponse,
  DownloadControlRequest,
  DownloadControlResponse,
  DownloadGetAllResponse,
  DownloadProgressEvent,
  AiUsageGetSummaryRequest,
  AiUsageGetSummaryResponse,
  AiUsageGetChartRequest,
  AiUsageGetChartResponse,
  AiUsageGetLogRequest,
  AiUsageGetLogResponse,
  AiUsageClearResponse,
  ModerationCheckRequest,
  ModerationCheckResponse,
} from '../../shared/ipc/types';

export interface ElectronAPI {
  // File operations
  fileList: (data?: FileListRequest) => Promise<FileListResponse>;
  fileRead: (data: FileReadRequest) => Promise<FileReadResponse>;
  fileWrite: (data: FileWriteRequest) => Promise<FileWriteResponse>;
  fileDelete: (data: FileDeleteRequest) => Promise<FileDeleteResponse>;
  fileCreateFolder: (data: FileCreateFolderRequest) => Promise<FileCreateFolderResponse>;
  fileImport: (data: FileImportRequest) => Promise<FileImportResponse>;
  fileRename: (data: import('../../shared/ipc/types').FileRenameRequest) => Promise<import('../../shared/ipc/types').FileRenameResponse>;
  fileMove: (data: import('../../shared/ipc/types').FileMoveRequest) => Promise<import('../../shared/ipc/types').FileMoveResponse>;
  fileGetProjectsDir: () => Promise<import('../../shared/ipc/types').FileGetProjectsDirResponse>;
  fileGetAssetsDir: () => Promise<import('../../shared/ipc/types').FileGetAssetsDirResponse>;

  // Dialog operations
  dialogOpen: (data?: DialogOpenRequest) => Promise<DialogOpenResponse>;
  dialogSave: (data: import('../../shared/ipc/types').DialogSaveRequest) => Promise<import('../../shared/ipc/types').DialogSaveResponse>;

  // Bundle operations
  bundleCreate: (data: BundleCreateRequest) => Promise<BundleCreateResponse>;
  bundleInvalidate: (data: BundleInvalidateRequest) => Promise<BundleInvalidateResponse>;
  onBundleProgress: (callback: (data: BundleProgressEvent) => void) => () => void;

  // Module operations (native player)
  moduleTranspile: (data: ModuleTranspileRequest) => Promise<ModuleTranspileResponse>;
  moduleServerUrl: () => Promise<ModuleServerUrlResponse>;

  // TSX validation
  tsxValidate: (data: TsxValidateRequest) => Promise<TsxValidateResponse>;

  // Screenshot operations
  screenshotCopy: (data: ScreenshotCopyRequest) => Promise<ScreenshotCopyResponse>;
  screenshotSave: (data: ScreenshotSaveRequest) => Promise<ScreenshotSaveResponse>;
  screenshotSaveToPath: (data: ScreenshotSaveToPathRequest) => Promise<ScreenshotSaveToPathResponse>;

  // Render operations
  renderStart: (data: RenderStartRequest) => Promise<RenderStartResponse>;
  renderCancel: (data: RenderCancelRequest) => Promise<RenderCancelResponse>;
  renderQueueGet: () => Promise<RenderQueueGetResponse>;
  renderQueueSave: (data: RenderQueueSaveRequest) => Promise<RenderQueueSaveResponse>;
  renderQueueLoad: () => Promise<RenderQueueLoadResponse>;
  renderOpenFile: (data: RenderOpenFileRequest) => Promise<RenderOpenFileResponse>;
  renderOpenFolder: (data: RenderOpenFolderRequest) => Promise<RenderOpenFolderResponse>;
  renderGetVideosDir: () => Promise<RenderGetVideosDirResponse>;
  renderHistoryLoad: () => Promise<RenderHistoryLoadResponse>;
  renderHistoryAppend: (data: RenderHistoryAppendRequest) => Promise<RenderHistoryAppendResponse>;
  onRenderProgress: (callback: (data: RenderProgressEvent) => void) => () => void;
  onRenderComplete: (callback: (data: RenderCompleteEvent) => void) => () => void;
  onRenderEncoderResolved: (callback: (data: RenderEncoderResolvedEvent) => void) => () => void;

  // App shell
  appGetInfo: () => Promise<import('../../shared/ipc/types').AppGetInfoResponse>;
  appOpenExternal: (data: import('../../shared/ipc/types').AppOpenExternalRequest) => Promise<import('../../shared/ipc/types').AppOpenExternalResponse>;

  // Shared provider API keys (BYOK)
  providerKeysGet: () => Promise<import('../../shared/ipc/types').ProviderKeysGetResponse>;
  providerKeysSave: (data: import('../../shared/ipc/types').ProviderKeysSaveRequest) => Promise<import('../../shared/ipc/types').ProviderKeysSaveResponse>;

  // Video generation (fal queue API)
  videoGenerate: (data: import('../../shared/ipc/types').VideoGenerateRequest) => Promise<import('../../shared/ipc/types').VideoGenerateResponse>;
  videoGetJob: (jobId: string) => Promise<import('../../shared/ipc/types').VideoJobResponse>;

  // Provider-agnostic transcription
  sttTranscribeRun: (req: import('../../shared/ipc/types').SttTranscribeRunRequest) => Promise<import('../../shared/ipc/types').SttTranscribeRunResponse>;
  sttTranscribeCancel: () => Promise<import('../../shared/ipc/types').SttTranscribeCancelResponse>;
  onSttTranscribeProgress: (callback: (data: import('../../shared/ipc/types').SttTranscribeProgressEvent) => void) => () => void;
  sttProvidersGet: () => Promise<import('../../shared/ipc/types').SttProvidersGetResponse>;
  sttProvidersSave: (req: import('../../shared/ipc/types').SttProvidersSaveRequest) => Promise<import('../../shared/ipc/types').SttProvidersSaveResponse>;

  // Video Studio
  videoStudioSave: (data: import('../../shared/ipc/types').VideoStudioSaveRequest) => Promise<import('../../shared/ipc/types').VideoStudioSaveResponse>;
  videoStudioList: () => Promise<import('../../shared/ipc/types').VideoStudioListResponse>;
  videoStudioDelete: (data: import('../../shared/ipc/types').VideoStudioDeleteRequest) => Promise<import('../../shared/ipc/types').VideoStudioDeleteResponse>;
  videoStudioSaveAs: (data: import('../../shared/ipc/types').VideoStudioSaveAsRequest) => Promise<import('../../shared/ipc/types').VideoStudioSaveAsResponse>;
  videoStudioReadPath: (data: import('../../shared/ipc/types').VideoStudioReadPathRequest) => Promise<import('../../shared/ipc/types').VideoStudioReadPathResponse>;
  videoStudioFolderCreate: (data: import('../../shared/ipc/types').VideoStudioFolderCreateRequest) => Promise<import('../../shared/ipc/types').VideoStudioFolderCreateResponse>;
  videoStudioFolderRename: (data: import('../../shared/ipc/types').VideoStudioFolderRenameRequest) => Promise<import('../../shared/ipc/types').VideoStudioFolderRenameResponse>;
  videoStudioFolderDelete: (data: import('../../shared/ipc/types').VideoStudioFolderDeleteRequest) => Promise<import('../../shared/ipc/types').VideoStudioFolderDeleteResponse>;
  videoStudioMoveToFolder: (data: import('../../shared/ipc/types').VideoStudioMoveToFolderRequest) => Promise<import('../../shared/ipc/types').VideoStudioMoveToFolderResponse>;

  // Settings operations
  settingsGet: () => Promise<SettingsGetResponse>;
  settingsSetOutputFolder: (data: SettingsSetOutputFolderRequest) => Promise<SettingsSetOutputFolderResponse>;
  settingsSetAiModelsFolder: (data: SettingsSetAiModelsFolderRequest) => Promise<SettingsSetAiModelsFolderResponse>;
  settingsSetWhisperModel: (data: SettingsSetWhisperModelRequest) => Promise<SettingsSetWhisperModelResponse>;
  settingsSetRenderTimeout: (data: SettingsSetRenderTimeoutRequest) => Promise<SettingsSetRenderTimeoutResponse>;
  settingsSetRenderDefaultCpuUsage: (data: SettingsSetRenderDefaultCpuUsageRequest) => Promise<SettingsSetRenderDefaultCpuUsageResponse>;
  settingsSetRenderDefaultGpuBackend: (data: SettingsSetRenderDefaultGpuBackendRequest) => Promise<SettingsSetRenderDefaultGpuBackendResponse>;
  settingsSetRenderDefaultHardwareAcceleration: (data: SettingsSetRenderDefaultHardwareAccelerationRequest) => Promise<SettingsSetRenderDefaultHardwareAccelerationResponse>;
  dialogOpenFolder: () => Promise<DialogOpenFolderResponse>;

  // Whisper operations
  whisperBinaryStatus: () => Promise<import('../../shared/ipc/types').WhisperBinaryStatusResponse>;
  whisperBinaryInstall: () => Promise<import('../../shared/ipc/types').WhisperBinaryInstallResponse>;
  whisperModelsList: () => Promise<import('../../shared/ipc/types').WhisperModelsListResponse>;
  whisperModelDownload: (data: import('../../shared/ipc/types').WhisperModelDownloadRequest) => Promise<import('../../shared/ipc/types').WhisperModelDownloadResponse>;
  whisperModelDelete: (data: import('../../shared/ipc/types').WhisperModelDeleteRequest) => Promise<import('../../shared/ipc/types').WhisperModelDeleteResponse>;
  whisperTranscribe: (data: import('../../shared/ipc/types').WhisperTranscribeRequest) => Promise<import('../../shared/ipc/types').WhisperTranscribeResponse>;
  whisperTranscribeCancel: () => Promise<import('../../shared/ipc/types').WhisperTranscribeCancelResponse>;
  onWhisperTranscribeProgress: (callback: (data: import('../../shared/ipc/types').WhisperTranscribeProgressEvent) => void) => () => void;
  onWhisperProgress: (callback: (data: import('../../shared/ipc/types').WhisperProgressEvent) => void) => () => void;

  // File read binary
  fileReadBinary: (data: FileReadBinaryRequest) => Promise<FileReadBinaryResponse>;

  // Prompt presets
  promptPresetsGet: () => Promise<import('../../shared/ipc/types').PromptPresetsGetResponse>;

  // Image generation operations
  imageProvidersGet: () => Promise<import('../../shared/ipc/types').ImageProvidersGetResponse>;
  imageProvidersSave: (data: import('../../shared/ipc/types').ImageProvidersSaveRequest) => Promise<import('../../shared/ipc/types').ImageProvidersSaveResponse>;
  imageProviderTest: (data: import('../../shared/ipc/types').ImageProviderTestRequest) => Promise<import('../../shared/ipc/types').ImageProviderTestResponse>;
  imageModelsGet: (data?: import('../../shared/ipc/types').ImageModelsGetRequest) => Promise<import('../../shared/ipc/types').ImageModelsGetResponse>;
  imageGenerate: (data: import('../../shared/ipc/types').ImageGenerateRequest) => Promise<import('../../shared/ipc/types').ImageGenerateResponse>;
  imageGenerateCancel: (data: import('../../shared/ipc/types').ImageGenerateCancelRequest) => Promise<import('../../shared/ipc/types').ImageGenerateCancelResponse>;

  // Image Studio operations
  imageStudioSave: (data: import('../../shared/ipc/types').ImageStudioSaveRequest) => Promise<import('../../shared/ipc/types').ImageStudioSaveResponse>;
  imageStudioList: () => Promise<import('../../shared/ipc/types').ImageStudioListResponse>;
  imageStudioDelete: (data: import('../../shared/ipc/types').ImageStudioDeleteRequest) => Promise<import('../../shared/ipc/types').ImageStudioDeleteResponse>;
  imageStudioSaveAs: (data: import('../../shared/ipc/types').ImageStudioSaveAsRequest) => Promise<import('../../shared/ipc/types').ImageStudioSaveAsResponse>;
  imageStudioCopy: (data: import('../../shared/ipc/types').ImageStudioCopyRequest) => Promise<import('../../shared/ipc/types').ImageStudioCopyResponse>;
  imageStudioRead: (data: import('../../shared/ipc/types').ImageStudioReadRequest) => Promise<import('../../shared/ipc/types').ImageStudioReadResponse>;

  // Image Studio folder operations
  imageStudioFolderCreate: (data: ImageStudioFolderCreateRequest) => Promise<ImageStudioFolderCreateResponse>;
  imageStudioFolderRename: (data: ImageStudioFolderRenameRequest) => Promise<ImageStudioFolderRenameResponse>;
  imageStudioFolderDelete: (data: ImageStudioFolderDeleteRequest) => Promise<ImageStudioFolderDeleteResponse>;
  imageStudioMoveToFolder: (data: ImageStudioMoveToFolderRequest) => Promise<ImageStudioMoveToFolderResponse>;

  // Image provider switch
  imageProviderSwitch: (data: ImageProviderSwitchRequest) => Promise<ImageProviderSwitchResponse>;

  // Reference image library
  refImageSave: (data: import('../../shared/ipc/types').RefImageSaveRequest) => Promise<import('../../shared/ipc/types').RefImageSaveResponse>;
  refImageList: () => Promise<import('../../shared/ipc/types').RefImageListResponse>;
  refImageDelete: (data: import('../../shared/ipc/types').RefImageDeleteRequest) => Promise<import('../../shared/ipc/types').RefImageDeleteResponse>;
  refImageToggle: (data: import('../../shared/ipc/types').RefImageToggleRequest) => Promise<import('../../shared/ipc/types').RefImageToggleResponse>;
  refImageRead: (data: import('../../shared/ipc/types').RefImageReadRequest) => Promise<import('../../shared/ipc/types').RefImageReadResponse>;

  // Logging
  logWrite: (data: import('../../shared/ipc/types').LogWriteRequest) => Promise<import('../../shared/ipc/types').LogWriteResponse>;

  // LLM operations
  llmProvidersGet: () => Promise<LlmProvidersGetResponse>;
  llmProvidersSave: (data: LlmProvidersSaveRequest) => Promise<LlmProvidersSaveResponse>;
  llmProviderTest: (data: LlmProviderTestRequest) => Promise<LlmProviderTestResponse>;
  llmGenerate: (data: LlmGenerateRequest) => Promise<LlmGenerateResponse>;
  llmChatGenerate: (data: LlmChatGenerateRequest) => Promise<LlmChatGenerateResponse>;
  llmCancel: () => Promise<LlmCancelResponse>;

  skillsList: () => Promise<SkillsListResponse>;

  // Local LLM engine operations
  localLlmStatus: () => Promise<import('../../shared/ipc/types').LocalLlmStatusResponse>;
  localLlmModelsList: () => Promise<import('../../shared/ipc/types').LocalLlmModelsListResponse>;
  localLlmModelDownload: (data: import('../../shared/ipc/types').LocalLlmModelDownloadRequest) => Promise<import('../../shared/ipc/types').LocalLlmModelDownloadResponse>;
  localLlmModelDelete: (data: import('../../shared/ipc/types').LocalLlmModelDeleteRequest) => Promise<import('../../shared/ipc/types').LocalLlmModelDeleteResponse>;
  onLocalLlmDownloadProgress: (callback: (data: import('../../shared/ipc/types').LocalLlmDownloadProgressEvent) => void) => () => void;
  localLlmLoadModel: (data: import('../../shared/ipc/types').LocalLlmLoadModelRequest) => Promise<import('../../shared/ipc/types').LocalLlmLoadModelResponse>;
  localLlmUnloadModel: () => Promise<import('../../shared/ipc/types').LocalLlmUnloadModelResponse>;
  localLlmGenerate: (data: import('../../shared/ipc/types').LocalLlmGenerateRequest) => Promise<import('../../shared/ipc/types').LocalLlmGenerateResponse>;
  localLlmChat: (data: import('../../shared/ipc/types').LocalLlmChatRequest) => Promise<import('../../shared/ipc/types').LocalLlmChatResponse>;
  onLocalLlmToken: (callback: (data: import('../../shared/ipc/types').LocalLlmTokenEvent) => void) => () => void;
  onLocalLlmComplete: (callback: (data: import('../../shared/ipc/types').LocalLlmCompleteEvent) => void) => () => void;
  localLlmCancel: () => Promise<import('../../shared/ipc/types').LocalLlmCancelResponse>;
  localLlmSessionClear: (data: import('../../shared/ipc/types').LocalLlmSessionClearRequest) => Promise<import('../../shared/ipc/types').LocalLlmSessionClearResponse>;
  localLlmGpuInfo: () => Promise<import('../../shared/ipc/types').LocalLlmGpuInfoResponse>;
  localLlmSettingsGet: () => Promise<import('../../shared/ipc/types').LocalLlmSettingsGetResponse>;
  localLlmSettingsSave: (data: import('../../shared/ipc/types').LocalLlmSettingsSaveRequest) => Promise<import('../../shared/ipc/types').LocalLlmSettingsSaveResponse>;

  // Audio engine operations
  audioStatus: () => Promise<import('../../shared/ipc/types').AudioStatusResponse>;
  audioModelsList: (data?: import('../../shared/ipc/types').AudioModelsListRequest) => Promise<import('../../shared/ipc/types').AudioModelsListResponse>;
  audioModelDownload: (data: import('../../shared/ipc/types').AudioModelDownloadRequest) => Promise<import('../../shared/ipc/types').AudioModelDownloadResponse>;
  audioModelDelete: (data: import('../../shared/ipc/types').AudioModelDeleteRequest) => Promise<import('../../shared/ipc/types').AudioModelDeleteResponse>;
  onAudioDownloadProgress: (callback: (data: import('../../shared/ipc/types').AudioDownloadProgressEvent) => void) => () => void;
  audioSttLoadModel: (data: import('../../shared/ipc/types').AudioSttLoadModelRequest) => Promise<import('../../shared/ipc/types').AudioSttLoadModelResponse>;
  audioSttTranscribe: (data: import('../../shared/ipc/types').AudioSttTranscribeRequest) => Promise<import('../../shared/ipc/types').AudioSttTranscribeResponse>;
  audioSttStreamStart: () => Promise<import('../../shared/ipc/types').AudioSttStreamStartResponse>;
  audioSttStreamFeed: (data: import('../../shared/ipc/types').AudioSttStreamFeedRequest) => Promise<import('../../shared/ipc/types').AudioSttStreamFeedResponse>;
  audioSttStreamStop: () => Promise<import('../../shared/ipc/types').AudioSttStreamStopResponse>;
  onAudioSttPartial: (callback: (data: import('../../shared/ipc/types').AudioSttPartialEvent) => void) => () => void;
  audioTtsLoadModel: (data: import('../../shared/ipc/types').AudioTtsLoadModelRequest) => Promise<import('../../shared/ipc/types').AudioTtsLoadModelResponse>;
  audioTtsGenerate: (data: import('../../shared/ipc/types').AudioTtsGenerateRequest) => Promise<import('../../shared/ipc/types').AudioTtsGenerateResponse>;
  audioSettingsGet: () => Promise<import('../../shared/ipc/types').AudioSettingsGetResponse>;
  audioSettingsSave: (data: import('../../shared/ipc/types').AudioSettingsSaveRequest) => Promise<import('../../shared/ipc/types').AudioSettingsSaveResponse>;
  onAudioSttTranscribeProgress: (callback: (data: { percent: number; message: string }) => void) => () => void;

  // Transcription project operations
  transcriptionProjectList: () => Promise<import('../../shared/ipc/types').TranscriptionProjectListResponse>;
  transcriptionProjectSave: (data: import('../../shared/ipc/types').TranscriptionProjectSaveRequest) => Promise<import('../../shared/ipc/types').TranscriptionProjectSaveResponse>;
  transcriptionProjectLoad: (data: import('../../shared/ipc/types').TranscriptionProjectLoadRequest) => Promise<import('../../shared/ipc/types').TranscriptionProjectLoadResponse>;
  transcriptionProjectDelete: (data: import('../../shared/ipc/types').TranscriptionProjectDeleteRequest) => Promise<import('../../shared/ipc/types').TranscriptionProjectDeleteResponse>;

  // System info
  systemInfoGet: () => Promise<SystemInfoGetResponse>;
  pytorchPipInstall: (data: PyTorchPipInstallRequest) => Promise<PyTorchPipInstallResponse>;

  // Download manager operations
  downloadEnqueue: (data: DownloadEnqueueRequest) => Promise<DownloadEnqueueResponse>;
  downloadPause: (data: DownloadControlRequest) => Promise<DownloadControlResponse>;
  downloadResume: (data: DownloadControlRequest) => Promise<DownloadControlResponse>;
  downloadCancel: (data: DownloadControlRequest) => Promise<DownloadControlResponse>;
  downloadGetAll: () => Promise<DownloadGetAllResponse>;
  onDownloadProgress: (callback: (data: DownloadProgressEvent) => void) => () => void;

  // Moderation engine
  moderationCheck: (data: ModerationCheckRequest) => Promise<ModerationCheckResponse>;

  // AI Usage tracking
  aiUsageGetSummary: (data: AiUsageGetSummaryRequest) => Promise<AiUsageGetSummaryResponse>;
  aiUsageGetChart: (data: AiUsageGetChartRequest) => Promise<AiUsageGetChartResponse>;
  aiUsageGetLog: (data: AiUsageGetLogRequest) => Promise<AiUsageGetLogResponse>;
  aiUsageClear: () => Promise<AiUsageClearResponse>;

  // Flows (node-graph builder) projects
  flowsProjectList: () => Promise<import('../../shared/ipc/types').FlowProjectListResponse>;
  flowsProjectCreate: (data: import('../../shared/ipc/types').FlowProjectCreateRequest) => Promise<import('../../shared/ipc/types').FlowProjectCreateResponse>;
  flowsProjectLoad: (data: import('../../shared/ipc/types').FlowProjectLoadRequest) => Promise<import('../../shared/ipc/types').FlowProjectLoadResponse>;
  flowsProjectUpdate: (data: import('../../shared/ipc/types').FlowProjectUpdateRequest) => Promise<import('../../shared/ipc/types').FlowProjectUpdateResponse>;
  flowsProjectDelete: (data: import('../../shared/ipc/types').FlowProjectDeleteRequest) => Promise<import('../../shared/ipc/types').FlowProjectDeleteResponse>;

  // Flows — run history (Phase 5)
  flowsRunPersist: (data: import('../../shared/ipc/types').FlowRunPersistRequest) => Promise<import('../../shared/ipc/types').FlowRunPersistResponse>;
  flowsRunList: (data: import('../../shared/ipc/types').FlowRunListRequest) => Promise<import('../../shared/ipc/types').FlowRunListResponse>;
  flowsRunLoad: (data: import('../../shared/ipc/types').FlowRunLoadRequest) => Promise<import('../../shared/ipc/types').FlowRunLoadResponse>;

  // Tools: Frame Extractor
  toolsVideoProbe: (data: import('../../shared/ipc/types').VideoProbeRequest) => Promise<import('../../shared/ipc/types').VideoProbeResponse>;
  toolsFrameExtract: (data: import('../../shared/ipc/types').FrameExtractRequest) => Promise<import('../../shared/ipc/types').FrameExtractResponse>;
  toolsFrameExtractCancel: () => Promise<import('../../shared/ipc/types').FrameExtractCancelResponse>;
  toolsFrameSaveZip: (data: import('../../shared/ipc/types').FrameSaveZipRequest) => Promise<import('../../shared/ipc/types').FrameSaveZipResponse>;
  toolsFrameSaveSingle: (data: import('../../shared/ipc/types').FrameSaveSingleRequest) => Promise<import('../../shared/ipc/types').FrameSaveSingleResponse>;
  onToolsFrameExtractProgress: (callback: (data: import('../../shared/ipc/types').FrameExtractProgressEvent) => void) => () => void;

  // App env
  appGetIsDev: () => Promise<import('../../shared/ipc/types').AppGetIsDevResponse>;

  // Model library (generic, category-agnostic) + local image surface used by the AI Models screen
  modelsScan: (data: import('../../shared/ipc/types').ModelsScanRequest) => Promise<import('../../shared/ipc/types').ModelsScanResponse>;
  modelsImport: (data: import('../../shared/ipc/types').ModelsImportRequest) => Promise<import('../../shared/ipc/types').ModelsImportResponse>;
  modelsConfigure: (data: import('../../shared/ipc/types').ModelsConfigureRequest) => Promise<import('../../shared/ipc/types').ModelsConfigureResponse>;
  modelsRemove: (data: import('../../shared/ipc/types').ModelsRemoveRequest) => Promise<import('../../shared/ipc/types').ModelsRemoveResponse>;
  modelsUsageGet: (data: import('../../shared/ipc/types').ModelsUsageGetRequest) => Promise<import('../../shared/ipc/types').ModelsUsageGetResponse>;
  modelsOpenFolder: (data: import('../../shared/ipc/types').ModelsOpenFolderRequest) => Promise<import('../../shared/ipc/types').ModelsOpenFolderResponse>;
  modelsSetFolder: (data: import('../../shared/ipc/types').ModelsSetFolderRequest) => Promise<import('../../shared/ipc/types').ModelsSetFolderResponse>;
  sdImageStatus: () => Promise<import('../../shared/ipc/types').SdImageStatusResponse>;
  sdImageSetActiveModel: (data: import('../../shared/ipc/types').SdImageSetActiveModelRequest) => Promise<import('../../shared/ipc/types').SdImageSetActiveModelResponse>;
  sdImageModelDownload: (data: import('../../shared/ipc/types').SdImageModelDownloadRequest) => Promise<import('../../shared/ipc/types').SdImageModelDownloadResponse>;
  sdImageDownloadCompanions: (data: import('../../shared/ipc/types').SdImageDownloadCompanionsRequest) => Promise<import('../../shared/ipc/types').SdImageDownloadCompanionsResponse>;
  sdVideoModelDownload: (data: import('../../shared/ipc/types').SdVideoModelDownloadRequest) => Promise<import('../../shared/ipc/types').SdVideoModelDownloadResponse>;
  sdVideoGenerate: (data: import('../../shared/ipc/types').SdVideoGenerateRequest) => Promise<import('../../shared/ipc/types').SdVideoGenerateResponse>;
  sdVideoCancel: (data: import('../../shared/ipc/types').SdVideoCancelRequest) => Promise<import('../../shared/ipc/types').SdVideoCancelResponse>;
  onSdVideoGenerateProgress: (callback: (data: import('../../shared/ipc/types').SdVideoGenerateProgressEvent) => void) => () => void;
  onSdVideoGenerateComplete: (callback: (data: import('../../shared/ipc/types').SdVideoGenerateCompleteEvent) => void) => () => void;
  onSdVideoGenerateError: (callback: (data: import('../../shared/ipc/types').SdVideoGenerateErrorEvent) => void) => () => void;
  appOpenExternal: (data: import('../../shared/ipc/types').AppOpenExternalRequest) => Promise<import('../../shared/ipc/types').AppOpenExternalResponse>;
  tsxJobStart: (data: import('../../shared/ipc/types').TsxJobStartRequest) => Promise<import('../../shared/ipc/types').TsxJobStartResponse>;
  tsxJobCancel: (data: import('../../shared/ipc/types').TsxJobCancelRequest) => Promise<import('../../shared/ipc/types').TsxJobCancelResponse>;
  tsxJobList: () => Promise<import('../../shared/ipc/types').TsxJobListResponse>;
  tsxJobClearCompleted: () => Promise<import('../../shared/ipc/types').TsxJobClearCompletedResponse>;
  tsxJobConfigure: (data: import('../../shared/ipc/types').TsxJobConfigureRequest) => Promise<import('../../shared/ipc/types').TsxJobConfigureResponse>;
  onTsxJobEvent: (callback: (data: import('../../shared/ipc/types').TsxJobEvent) => void) => () => void;
  onTsxJobStream: (callback: (data: import('../../shared/ipc/types').TsxJobStreamEvent) => void) => () => void;

  // Studio (AI video editor) — projects & media
  studioRootGet: () => Promise<import('../../shared/ipc/types').StudioRootGetResponse>;
  studioRootSet: (data: import('../../shared/ipc/types').StudioRootSetRequest) => Promise<import('../../shared/ipc/types').StudioRootSetResponse>;
  studioProjectList: () => Promise<import('../../shared/ipc/types').StudioProjectListResponse>;
  studioProjectCreate: (data: import('../../shared/ipc/types').StudioProjectCreateRequest) => Promise<import('../../shared/ipc/types').StudioProjectCreateResponse>;
  studioProjectLoad: (data: import('../../shared/ipc/types').StudioProjectLoadRequest) => Promise<import('../../shared/ipc/types').StudioProjectLoadResponse>;
  studioProjectSave: (data: import('../../shared/ipc/types').StudioProjectSaveRequest) => Promise<import('../../shared/ipc/types').StudioProjectSaveResponse>;
  studioProjectDelete: (data: import('../../shared/ipc/types').StudioProjectDeleteRequest) => Promise<import('../../shared/ipc/types').StudioProjectDeleteResponse>;
  studioMediaImport: (data: import('../../shared/ipc/types').StudioMediaImportRequest) => Promise<import('../../shared/ipc/types').StudioMediaImportResponse>;
  studioCacheRead: (data: import('../../shared/ipc/types').StudioCacheReadRequest) => Promise<import('../../shared/ipc/types').StudioCacheReadResponse>;
  studioMediaPrepare: (data: import('../../shared/ipc/types').StudioMediaPrepareRequest) => Promise<import('../../shared/ipc/types').StudioMediaPrepareResponse>;
  studioExportPrepare: (data: import('../../shared/ipc/types').StudioExportPrepareRequest) => Promise<import('../../shared/ipc/types').StudioExportPrepareResponse>;
  studioTranscribeStart: (data: import('../../shared/ipc/types').StudioTranscribeStartRequest) => Promise<import('../../shared/ipc/types').StudioTranscribeStartResponse>;
  studioTranscribeCancel: (data: import('../../shared/ipc/types').StudioTranscribeCancelRequest) => Promise<import('../../shared/ipc/types').StudioTranscribeCancelResponse>;
  studioCutPlanRun: (data: import('../../shared/ipc/types').StudioCutPlanRunRequest) => Promise<import('../../shared/ipc/types').StudioCutPlanRunResponse>;
  onStudioMediaJobEvent: (callback: (event: import('../../shared/ipc/types').StudioMediaJobEvent) => void) => () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
