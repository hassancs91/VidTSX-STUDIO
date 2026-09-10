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
  LlmCancelRequest,
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
  ImageCliStatusRequest,
  ImageCliStatusResponse,
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
  SettingsSetCrashReportingRequest,
  SettingsSetCrashReportingResponse,
  SystemInfoGetResponse,
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
  AiUsageGetAgentsRequest,
  AiUsageGetAgentsResponse,
  AiUsageGetLogResponse,
  AiUsageClearResponse,
  ModerationCheckRequest,
  ModerationCheckResponse,
  ContentSafetyStatusResponse,
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

  // Editable per-provider model catalogs
  providerModelsGet: () => Promise<import('../../shared/ipc/types').ProviderModelsGetResponse>;
  providerModelsSave: (data: import('../../shared/ipc/types').ProviderModelsSaveRequest) => Promise<import('../../shared/ipc/types').ProviderModelsSaveResponse>;
  providerModelsReset: (data: import('../../shared/ipc/types').ProviderModelsResetRequest) => Promise<import('../../shared/ipc/types').ProviderModelsResetResponse>;

  // Per-model image parameter overrides (W2c)
  imageModelParamsGet: () => Promise<import('../../shared/ipc/types').ImageModelParamsGetResponse>;
  imageModelParamsSave: (data: import('../../shared/ipc/types').ImageModelParamsSaveRequest) => Promise<import('../../shared/ipc/types').ImageModelParamsSaveResponse>;

  // Video generation (fal queue API)
  videoGenerate: (data: import('../../shared/ipc/types').VideoGenerateRequest) => Promise<import('../../shared/ipc/types').VideoGenerateResponse>;
  videoGetJob: (jobId: string) => Promise<import('../../shared/ipc/types').VideoJobResponse>;
  videoCancel: (data: import('../../shared/ipc/types').VideoCancelRequest) => Promise<import('../../shared/ipc/types').VideoCancelResponse>;
  videoProvidersGet: () => Promise<import('../../shared/ipc/types').VideoProvidersGetResponse>;
  videoModelsGet: (data?: import('../../shared/ipc/types').VideoModelsGetRequest) => Promise<import('../../shared/ipc/types').VideoModelsGetResponse>;
  videoProviderTest: (data: import('../../shared/ipc/types').VideoProviderTestRequest) => Promise<import('../../shared/ipc/types').VideoProviderTestResponse>;
  onVideoJobProgress: (callback: (data: import('../../shared/ipc/types').VideoJobProgressEvent) => void) => () => void;

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
  settingsSetRenderDefaultExportEngine: (data: import('../../shared/ipc/types').SettingsSetRenderDefaultExportEngineRequest) => Promise<import('../../shared/ipc/types').SettingsSetRenderDefaultExportEngineResponse>;
  settingsSetCrashReporting: (data: SettingsSetCrashReportingRequest) => Promise<SettingsSetCrashReportingResponse>;
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

  // CLI-bridge image providers (agy today, mmx later): detect + auth probe
  imageCliStatus: (data?: ImageCliStatusRequest) => Promise<ImageCliStatusResponse>;

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
  llmCancel: (data?: LlmCancelRequest) => Promise<LlmCancelResponse>;

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

  // Cloud audio generation — sound effects + music (W2b)
  audioGenerate: (data: import('../../shared/ipc/types').AudioGenerateRequest) => Promise<import('../../shared/ipc/types').AudioGenerateResponse>;
  onAudioSttTranscribeProgress: (callback: (data: { percent: number; message: string }) => void) => () => void;

  // Transcription project operations
  transcriptionProjectList: () => Promise<import('../../shared/ipc/types').TranscriptionProjectListResponse>;
  transcriptionProjectSave: (data: import('../../shared/ipc/types').TranscriptionProjectSaveRequest) => Promise<import('../../shared/ipc/types').TranscriptionProjectSaveResponse>;
  transcriptionProjectLoad: (data: import('../../shared/ipc/types').TranscriptionProjectLoadRequest) => Promise<import('../../shared/ipc/types').TranscriptionProjectLoadResponse>;
  transcriptionProjectDelete: (data: import('../../shared/ipc/types').TranscriptionProjectDeleteRequest) => Promise<import('../../shared/ipc/types').TranscriptionProjectDeleteResponse>;

  // System info
  systemInfoGet: () => Promise<SystemInfoGetResponse>;

  // AI runtime (downloadable Python + PyTorch)
  aiRuntimeStatus: () => Promise<import('../../shared/ipc/types').AiRuntimeStatusResponse>;
  aiRuntimeInstall: (data?: import('../../shared/ipc/types').AiRuntimeInstallRequest) => Promise<import('../../shared/ipc/types').AiRuntimeInstallResponse>;
  aiRuntimeRepair: () => Promise<import('../../shared/ipc/types').AiRuntimeRepairResponse>;
  aiRuntimeRemove: (data?: import('../../shared/ipc/types').AiRuntimeRemoveRequest) => Promise<import('../../shared/ipc/types').AiRuntimeRemoveResponse>;
  onAiRuntimeStatusChanged: (callback: (status: import('../../shared/ipc/types').AiRuntimeStatusChangedEvent) => void) => () => void;

  // Runtime-backed Python models (catalogue status / download / preflight / install)
  pythonModelStatus: (data?: import('../../shared/ipc/types').PythonModelStatusRequest) => Promise<import('../../shared/ipc/types').PythonModelStatusResponse>;
  pythonModelDownload: (data: import('../../shared/ipc/types').PythonModelDownloadRequest) => Promise<import('../../shared/ipc/types').PythonModelDownloadResponse>;
  pythonModelCancelDownload: (data: import('../../shared/ipc/types').PythonModelCancelDownloadRequest) => Promise<import('../../shared/ipc/types').PythonModelCancelDownloadResponse>;
  pythonModelRemove: (data: import('../../shared/ipc/types').PythonModelRemoveRequest) => Promise<import('../../shared/ipc/types').PythonModelRemoveResponse>;
  pythonModelPreflight: (data: import('../../shared/ipc/types').PythonModelPreflightRequest) => Promise<import('../../shared/ipc/types').PythonModelPreflightResponse>;
  pythonModelInstall: (data: import('../../shared/ipc/types').PythonModelInstallRequest) => Promise<import('../../shared/ipc/types').PythonModelInstallResponse>;

  // Background removal (Image Studio)
  rembgRun: (data: import('../../shared/ipc/types').RembgRunRequest) => Promise<import('../../shared/ipc/types').RembgRunResponse>;
  rembgCancel: (data: import('../../shared/ipc/types').RembgCancelRequest) => Promise<import('../../shared/ipc/types').RembgCancelResponse>;
  onRembgProgress: (callback: (data: import('../../shared/ipc/types').RembgProgressEvent) => void) => () => void;
  onRembgComplete: (callback: (data: import('../../shared/ipc/types').RembgCompleteEvent) => void) => () => void;
  onRembgError: (callback: (data: import('../../shared/ipc/types').RembgErrorEvent) => void) => () => void;

  // Image → 3D (TripoSR) + 3D Studio storage
  sd3dGenerate: (data: import('../../shared/ipc/types').Sd3dGenerateRequest) => Promise<import('../../shared/ipc/types').Sd3dGenerateResponse>;
  sd3dCancel: (data: import('../../shared/ipc/types').Sd3dCancelRequest) => Promise<import('../../shared/ipc/types').Sd3dCancelResponse>;
  onSd3dGenerateProgress: (callback: (data: import('../../shared/ipc/types').Sd3dGenerateProgressEvent) => void) => () => void;
  onSd3dGenerateComplete: (callback: (data: import('../../shared/ipc/types').Sd3dGenerateCompleteEvent) => void) => () => void;
  onSd3dGenerateError: (callback: (data: import('../../shared/ipc/types').Sd3dGenerateErrorEvent) => void) => () => void;
  threedStudioList: () => Promise<import('../../shared/ipc/types').ThreedStudioListResponse>;
  threedStudioRead: (data: import('../../shared/ipc/types').ThreedStudioReadRequest) => Promise<import('../../shared/ipc/types').ThreedStudioReadResponse>;
  threedStudioDelete: (data: import('../../shared/ipc/types').ThreedStudioDeleteRequest) => Promise<import('../../shared/ipc/types').ThreedStudioDeleteResponse>;
  threedStudioSaveAs: (data: import('../../shared/ipc/types').ThreedStudioSaveAsRequest) => Promise<import('../../shared/ipc/types').ThreedStudioSaveAsResponse>;
  threedStudioSaveToLibrary: (data: import('../../shared/ipc/types').ThreedStudioSaveToLibraryRequest) => Promise<import('../../shared/ipc/types').ThreedStudioSaveToLibraryResponse>;
  threedStudioOpenFolder: (data?: import('../../shared/ipc/types').ThreedStudioOpenFolderRequest) => Promise<import('../../shared/ipc/types').ThreedStudioOpenFolderResponse>;

  // Download manager operations
  downloadEnqueue: (data: DownloadEnqueueRequest) => Promise<DownloadEnqueueResponse>;
  downloadPause: (data: DownloadControlRequest) => Promise<DownloadControlResponse>;
  downloadResume: (data: DownloadControlRequest) => Promise<DownloadControlResponse>;
  downloadCancel: (data: DownloadControlRequest) => Promise<DownloadControlResponse>;
  downloadGetAll: () => Promise<DownloadGetAllResponse>;
  onDownloadProgress: (callback: (data: DownloadProgressEvent) => void) => () => void;

  // Moderation engine
  moderationCheck: (data: ModerationCheckRequest) => Promise<ModerationCheckResponse>;

  // Content Safety
  contentSafetyStatus: () => Promise<ContentSafetyStatusResponse>;

  // AI Usage tracking
  aiUsageGetSummary: (data: AiUsageGetSummaryRequest) => Promise<AiUsageGetSummaryResponse>;
  aiUsageGetChart: (data: AiUsageGetChartRequest) => Promise<AiUsageGetChartResponse>;
  aiUsageGetLog: (data: AiUsageGetLogRequest) => Promise<AiUsageGetLogResponse>;
  aiUsageGetAgents: (data: AiUsageGetAgentsRequest) => Promise<AiUsageGetAgentsResponse>;
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

  // Flows — W8 Stage 1: nodes from the registry, runs in main
  flowsNodesList: () => Promise<import('../../shared/ipc/types').FlowsNodesListResponse>;
  flowsRunStart: (data: import('../../shared/ipc/types').FlowsRunStartRequest) => Promise<import('../../shared/ipc/types').FlowsRunStartResponse>;
  flowsRunCancel: (data: import('../../shared/ipc/types').FlowsRunCancelRequest) => Promise<import('../../shared/ipc/types').FlowsRunCancelResponse>;
  flowsRunResume: (data: import('../../shared/ipc/types').FlowsRunResumeRequest) => Promise<import('../../shared/ipc/types').FlowsRunResumeResponse>;
  flowsRunGet: (data: import('../../shared/ipc/types').FlowsRunGetRequest) => Promise<import('../../shared/ipc/types').FlowsRunGetResponse>;
  flowsRunReply: (data: import('../../shared/ipc/types').FlowsRunReplyRequest) => Promise<import('../../shared/ipc/types').FlowsRunReplyResponse>;
  flowsRunArtifactResolve: (data: import('../../shared/ipc/types').FlowsRunArtifactResolveRequest) => Promise<import('../../shared/ipc/types').FlowsRunArtifactResolveResponse>;
  flowsRunArtifactAction: (data: import('../../shared/ipc/types').FlowsRunArtifactActionRequest) => Promise<import('../../shared/ipc/types').FlowsRunArtifactActionResponse>;
  flowsImport: (data: import('../../shared/ipc/types').FlowsImportRequest) => Promise<import('../../shared/ipc/types').FlowsImportResponse>;
  flowsExport: (data: import('../../shared/ipc/types').FlowsExportRequest) => Promise<import('../../shared/ipc/types').FlowsExportResponse>;
  flowsPendingPackage: () => Promise<import('../../shared/ipc/types').FlowsPendingPackageResponse>;
  flowsProposalGet: (data: import('../../shared/ipc/types').FlowsProposalGetRequest) => Promise<import('../../shared/ipc/types').FlowsProposalGetResponse>;
  flowsProposalResolve: (data: import('../../shared/ipc/types').FlowsProposalResolveRequest) => Promise<import('../../shared/ipc/types').FlowsProposalResolveResponse>;
  flowsFreeze: (data: import('../../shared/ipc/types').FlowsFreezeRequest) => Promise<import('../../shared/ipc/types').FlowsFreezeResponse>;
  onFlowsRunEvent: (callback: (event: import('../../shared/types/flows').FlowRunEvent) => void) => () => void;

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
  sdImageCliInstall: () => Promise<import('../../shared/ipc/types').SdImageCliInstallResponse>;
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
  studioProjectClose: (data: import('../../shared/ipc/types').StudioProjectCloseRequest) => Promise<import('../../shared/ipc/types').StudioProjectCloseResponse>;
  studioProjectSnapshotList: (data: import('../../shared/ipc/types').StudioSnapshotListRequest) => Promise<import('../../shared/ipc/types').StudioSnapshotListResponse>;
  studioProjectSnapshotRestore: (data: import('../../shared/ipc/types').StudioSnapshotRestoreRequest) => Promise<import('../../shared/ipc/types').StudioSnapshotRestoreResponse>;
  studioFlushAck: () => Promise<import('../../shared/ipc/types').StudioFlushAckResponse>;
  onStudioFlushRequest: (callback: () => void) => () => void;
  studioMediaImport: (data: import('../../shared/ipc/types').StudioMediaImportRequest) => Promise<import('../../shared/ipc/types').StudioMediaImportResponse>;
  studioCacheRead: (data: import('../../shared/ipc/types').StudioCacheReadRequest) => Promise<import('../../shared/ipc/types').StudioCacheReadResponse>;
  studioCacheInfo: (data: import('../../shared/ipc/types').StudioCacheInfoRequest) => Promise<import('../../shared/ipc/types').StudioCacheInfoResponse>;
  studioCacheOpen: (data: import('../../shared/ipc/types').StudioCacheOpenRequest) => Promise<import('../../shared/ipc/types').StudioCacheOpenResponse>;
  studioCacheClear: (data: import('../../shared/ipc/types').StudioCacheClearRequest) => Promise<import('../../shared/ipc/types').StudioCacheClearResponse>;
  studioProxyEncoderStatus: () => Promise<import('../../shared/ipc/types').StudioProxyEncoderStatusResponse>;
  studioProxyEncoderInstall: () => Promise<import('../../shared/ipc/types').StudioProxyEncoderInstallResponse>;
  studioProxyEncoderSetEnabled: (data: import('../../shared/ipc/types').StudioProxyEncoderSetEnabledRequest) => Promise<import('../../shared/ipc/types').StudioProxyEncoderSetEnabledResponse>;
  studioMediaPrepare: (data: import('../../shared/ipc/types').StudioMediaPrepareRequest) => Promise<import('../../shared/ipc/types').StudioMediaPrepareResponse>;
  studioMediaRelink: (data: import('../../shared/ipc/types').StudioMediaRelinkRequest) => Promise<import('../../shared/ipc/types').StudioMediaRelinkResponse>;
  studioExportPrepare: (data: import('../../shared/ipc/types').StudioExportPrepareRequest) => Promise<import('../../shared/ipc/types').StudioExportPrepareResponse>;
  studioExportEnginesList: () => Promise<import('../../shared/ipc/types').StudioExportEnginesListResponse>;
  studioTranscribeStart: (data: import('../../shared/ipc/types').StudioTranscribeStartRequest) => Promise<import('../../shared/ipc/types').StudioTranscribeStartResponse>;
  studioTranscribeCancel: (data: import('../../shared/ipc/types').StudioTranscribeCancelRequest) => Promise<import('../../shared/ipc/types').StudioTranscribeCancelResponse>;
  studioCutPlanRun: (data: import('../../shared/ipc/types').StudioCutPlanRunRequest) => Promise<import('../../shared/ipc/types').StudioCutPlanRunResponse>;
  studioAgentSend: (data: import('../../shared/ipc/types').StudioAgentSendRequest) => Promise<import('../../shared/ipc/types').StudioAgentSendResponse>;
  studioShotsReconcile: (data: import('../../shared/ipc/types').StudioShotsReconcileRequest) => Promise<import('../../shared/ipc/types').StudioShotsReconcileResponse>;
  studioAgentChatLoad: (data: import('../../shared/ipc/types').StudioAgentChatLoadRequest) => Promise<import('../../shared/ipc/types').StudioAgentChatLoadResponse>;
  studioAgentChatSave: (data: import('../../shared/ipc/types').StudioAgentChatSaveRequest) => Promise<import('../../shared/ipc/types').StudioAgentChatSaveResponse>;
  studioAgentChatReset: (data: import('../../shared/ipc/types').StudioAgentChatResetRequest) => Promise<import('../../shared/ipc/types').StudioAgentChatResetResponse>;
  studioShotLibrary: () => Promise<import('../../shared/ipc/types').StudioShotLibraryResponse>;
  studioAgentCancel: (data: import('../../shared/ipc/types').StudioAgentCancelRequest) => Promise<import('../../shared/ipc/types').StudioAgentCancelResponse>;
  studioAgentActionResult: (data: import('../../shared/ipc/types').StudioAgentActionResultRequest) => Promise<import('../../shared/ipc/types').StudioAgentActionResultResponse>;
  studioShotModule: (data: import('../../shared/ipc/types').StudioShotModuleRequest) => Promise<import('../../shared/ipc/types').StudioShotModuleResponse>;
  studioShotGenerate: (data: import('../../shared/ipc/types').StudioShotGenerateRequest) => Promise<import('../../shared/ipc/types').StudioShotGenerateResponse>;
  studioShotVersions: (data: import('../../shared/ipc/types').StudioShotVersionsRequest) => Promise<import('../../shared/ipc/types').StudioShotVersionsResponse>;
  studioShotImport: (data: import('../../shared/ipc/types').StudioShotImportRequest) => Promise<import('../../shared/ipc/types').StudioShotImportResponse>;
  studioCreatorProjects: () => Promise<import('../../shared/ipc/types').StudioCreatorProjectsResponse>;
  studioCaptionTemplates: () => Promise<import('../../shared/ipc/types').StudioCaptionTemplatesResponse>;
  studioCaptionTemplateModule: (data: import('../../shared/ipc/types').StudioCaptionTemplateModuleRequest) => Promise<import('../../shared/ipc/types').StudioCaptionTemplateModuleResponse>;
  studioPackagePlan: (data: import('../../shared/ipc/types').StudioPackagePlanRequest) => Promise<import('../../shared/ipc/types').StudioPackagePlanResponse>;
  studioPackageExport: (data: import('../../shared/ipc/types').StudioPackageExportRequest) => Promise<import('../../shared/ipc/types').StudioPackageExportResponse>;
  studioPackagePending: () => Promise<import('../../shared/ipc/types').StudioPackagePendingResponse>;
  onStudioPackageOpenFile: (callback: (event: import('../../shared/ipc/types').StudioPackageOpenFileEvent) => void) => () => void;
  studioPackageInspect: (data: import('../../shared/ipc/types').StudioPackageInspectRequest) => Promise<import('../../shared/ipc/types').StudioPackageInspectResponse>;
  studioPackageImport: (data: import('../../shared/ipc/types').StudioPackageImportRequest) => Promise<import('../../shared/ipc/types').StudioPackageImportResponse>;
  // W5: learn from this video.
  studioPresetLearn: (data: import('../../shared/ipc/types').StudioPresetLearnRequest) => Promise<import('../../shared/ipc/types').StudioPresetLearnResponse>;
  studioPresetProposalsGet: (data: import('../../shared/ipc/types').StudioPresetProposalsGetRequest) => Promise<import('../../shared/ipc/types').StudioPresetProposalsGetResponse>;
  studioPresetProposalResolve: (data: import('../../shared/ipc/types').StudioPresetProposalResolveRequest) => Promise<import('../../shared/ipc/types').StudioPresetProposalResolveResponse>;
  studioShotConform: (data: import('../../shared/ipc/types').StudioShotConformRequest) => Promise<import('../../shared/ipc/types').StudioShotConformResponse>;
  onStudioPackageEvent: (callback: (event: import('../../shared/ipc/types').StudioPackageEvent) => void) => () => void;
  onStudioMediaJobEvent: (callback: (event: import('../../shared/ipc/types').StudioMediaJobEvent) => void) => () => void;
  onStudioShotJobEvent: (callback: (event: import('../../shared/ipc/types').StudioShotJobEvent) => void) => () => void;
  onStudioAgentEvent: (callback: (event: import('../../shared/ipc/types').StudioAgentEvent) => void) => () => void;

  // Studio — agent memory (G5)
  memoryList: () => Promise<import('../../shared/ipc/types').MemoryListResponse>;
  memorySave: (data: import('../../shared/ipc/types').MemorySaveRequest) => Promise<import('../../shared/ipc/types').MemorySaveResponse>;
  memorySetActive: (data: import('../../shared/ipc/types').MemorySetActiveRequest) => Promise<import('../../shared/ipc/types').MemorySetActiveResponse>;
  memoryDelete: (data: import('../../shared/ipc/types').MemoryDeleteRequest) => Promise<import('../../shared/ipc/types').MemoryDeleteResponse>;
  memoryProposalsGet: (data: import('../../shared/ipc/types').MemoryProposalsGetRequest) => Promise<import('../../shared/ipc/types').MemoryProposalsGetResponse>;
  memoryProposalResolve: (data: import('../../shared/ipc/types').MemoryProposalResolveRequest) => Promise<import('../../shared/ipc/types').MemoryProposalResolveResponse>;
  memoryPromotionsGet: (data: import('../../shared/ipc/types').MemoryPromotionsGetRequest) => Promise<import('../../shared/ipc/types').MemoryPromotionsGetResponse>;
  memoryPromotionResolve: (data: import('../../shared/ipc/types').MemoryPromotionResolveRequest) => Promise<import('../../shared/ipc/types').MemoryPromotionResolveResponse>;
  memoryVocabularyProposalsGet: (data: import('../../shared/ipc/types').MemoryVocabularyProposalsGetRequest) => Promise<import('../../shared/ipc/types').MemoryVocabularyProposalsGetResponse>;
  memoryVocabularyProposalResolve: (data: import('../../shared/ipc/types').MemoryVocabularyProposalResolveRequest) => Promise<import('../../shared/ipc/types').MemoryVocabularyProposalResolveResponse>;

  // Home (V1 completion plan §2.6) — one aggregate read
  homeSummary: () => Promise<import('../../shared/ipc/types').HomeSummaryResponse>;

  // Announcements feed (Phase I)
  newsGet: () => Promise<import('../../shared/ipc/types').NewsGetResponse>;
  newsDismiss: (data: import('../../shared/ipc/types').NewsDismissRequest) => Promise<import('../../shared/ipc/types').NewsDismissResponse>;
  newsSetEnabled: (data: import('../../shared/ipc/types').NewsSetEnabledRequest) => Promise<import('../../shared/ipc/types').NewsSetEnabledResponse>;

  // Auto-update
  updaterGetState: () => Promise<import('../../shared/ipc/types').UpdaterGetStateResponse>;
  updaterCheck: (data?: import('../../shared/ipc/types').UpdaterCheckRequest) => Promise<import('../../shared/ipc/types').UpdaterCheckResponse>;
  updaterDownload: () => Promise<import('../../shared/ipc/types').UpdaterDownloadResponse>;
  updaterCancel: () => Promise<import('../../shared/ipc/types').UpdaterCancelResponse>;
  updaterInstall: () => Promise<import('../../shared/ipc/types').UpdaterInstallResponse>;
  updaterSetPrefs: (data: import('../../shared/ipc/types').UpdaterSetPrefsRequest) => Promise<import('../../shared/ipc/types').UpdaterSetPrefsResponse>;
  onUpdaterState: (callback: (data: import('../../shared/ipc/types').UpdaterStateEvent) => void) => () => void;

  // Asset library — index overlay, sizes, root override
  libraryIndexGet: () => Promise<import('../../shared/ipc/types').LibraryIndexGetResponse>;
  libraryDescriptionSet: (data: import('../../shared/ipc/types').LibraryDescriptionSetRequest) => Promise<import('../../shared/ipc/types').LibraryDescriptionSetResponse>;
  librarySizesGet: () => Promise<import('../../shared/ipc/types').LibrarySizesGetResponse>;
  libraryRootGet: () => Promise<import('../../shared/ipc/types').LibraryRootGetResponse>;
  libraryRootSet: (data: import('../../shared/ipc/types').LibraryRootSetRequest) => Promise<import('../../shared/ipc/types').LibraryRootSetResponse>;

  // Asset library — brands (L3/D11)
  libraryBrandsGet: () => Promise<import('../../shared/ipc/types').LibraryBrandsGetResponse>;
  libraryBrandSave: (data: import('../../shared/ipc/types').LibraryBrandSaveRequest) => Promise<import('../../shared/ipc/types').LibraryBrandSaveResponse>;
  libraryBrandDelete: (data: import('../../shared/ipc/types').LibraryBrandDeleteRequest) => Promise<import('../../shared/ipc/types').LibraryBrandDeleteResponse>;
  libraryBrandDefaultSet: (data: import('../../shared/ipc/types').LibraryBrandDefaultSetRequest) => Promise<import('../../shared/ipc/types').LibraryBrandDefaultSetResponse>;
  // Asset library — editing presets (V1 completion plan §2.5)
  libraryPresetsGet: () => Promise<import('../../shared/ipc/types').LibraryPresetsGetResponse>;
  libraryPresetSave: (data: import('../../shared/ipc/types').LibraryPresetSaveRequest) => Promise<import('../../shared/ipc/types').LibraryPresetSaveResponse>;
  libraryPresetDelete: (data: import('../../shared/ipc/types').LibraryPresetDeleteRequest) => Promise<import('../../shared/ipc/types').LibraryPresetDeleteResponse>;

  // Asset library — AI descriptions (L2)
  libraryDescribeAvailability: () => Promise<import('../../shared/ipc/types').LibraryDescribeAvailabilityResponse>;
  libraryPrefsSet: (data: import('../../shared/ipc/types').LibraryPrefsSetRequest) => Promise<import('../../shared/ipc/types').LibraryPrefsSetResponse>;
  libraryDescribeStart: (data: import('../../shared/ipc/types').LibraryDescribeStartRequest) => Promise<import('../../shared/ipc/types').LibraryDescribeStartResponse>;
  libraryDescribeCancel: () => Promise<import('../../shared/ipc/types').LibraryDescribeCancelResponse>;
  onLibraryDescribeEvent: (callback: (event: import('../../shared/ipc/types').LibraryDescribeJobEvent) => void) => () => void;

  // Asset library — AI organize (L7)
  libraryOrganizeSuggest: (data: import('../../shared/ipc/types').LibraryOrganizeSuggestRequest) => Promise<import('../../shared/ipc/types').LibraryOrganizeSuggestResponse>;
  libraryOrganizeApply: (data: import('../../shared/ipc/types').LibraryOrganizeApplyRequest) => Promise<import('../../shared/ipc/types').LibraryOrganizeApplyResponse>;

  // Asset library — visible web capture handshake (L6/D12)
  libraryCaptureTrigger: (data: import('../../shared/ipc/types').LibraryCaptureTriggerRequest) => Promise<import('../../shared/ipc/types').LibraryCaptureTriggerResponse>;
  onLibraryCaptureEvent: (callback: (event: import('../../shared/ipc/types').LibraryCaptureEvent) => void) => () => void;

  // Agents — installed declarative agents, saved sessions, one run stream
  // (docs/agents-plan.md §6)
  agentsList: () => Promise<import('../../shared/ipc/types').AgentsListResponse>;
  agentsInspect: (data: import('../../shared/ipc/types').AgentsInspectRequest) => Promise<import('../../shared/ipc/types').AgentsInspectResponse>;
  agentsInstall: (data: import('../../shared/ipc/types').AgentsInstallRequest) => Promise<import('../../shared/ipc/types').AgentsInstallResponse>;
  agentsRemove: (data: import('../../shared/ipc/types').AgentsRemoveRequest) => Promise<import('../../shared/ipc/types').AgentsRemoveResponse>;
  agentsCheckUpdate: (data: import('../../shared/ipc/types').AgentsCheckUpdateRequest) => Promise<import('../../shared/ipc/types').AgentsCheckUpdateResponse>;
  agentsPendingPackage: () => Promise<import('../../shared/ipc/types').AgentsPendingPackageResponse>;
  onAgentsPackageOpenFile: (callback: (event: import('../../shared/ipc/types').AgentsPackageOpenFileEvent) => void) => () => void;
  agentSessionsList: (data: import('../../shared/ipc/types').AgentSessionsListRequest) => Promise<import('../../shared/ipc/types').AgentSessionsListResponse>;
  agentSessionCreate: (data: import('../../shared/ipc/types').AgentSessionCreateRequest) => Promise<import('../../shared/ipc/types').AgentSessionCreateResponse>;
  agentSessionLoad: (data: import('../../shared/ipc/types').AgentSessionLoadRequest) => Promise<import('../../shared/ipc/types').AgentSessionLoadResponse>;
  agentSessionDelete: (data: import('../../shared/ipc/types').AgentSessionDeleteRequest) => Promise<import('../../shared/ipc/types').AgentSessionDeleteResponse>;
  agentSessionRename: (data: import('../../shared/ipc/types').AgentSessionRenameRequest) => Promise<import('../../shared/ipc/types').AgentSessionRenameResponse>;
  agentSessionBrandSet: (data: import('../../shared/ipc/types').AgentSessionBrandSetRequest) => Promise<import('../../shared/ipc/types').AgentSessionBrandSetResponse>;
  agentRunSend: (data: import('../../shared/ipc/types').AgentRunSendRequest) => Promise<import('../../shared/ipc/types').AgentRunSendResponse>;
  agentRunCancel: (data: import('../../shared/ipc/types').AgentRunCancelRequest) => Promise<import('../../shared/ipc/types').AgentRunCancelResponse>;
  agentInteractionReply: (data: import('../../shared/ipc/types').AgentInteractionReplyRequest) => Promise<import('../../shared/ipc/types').AgentInteractionReplyResponse>;
  onAgentRunEvent: (callback: (event: import('../../shared/types/agents').AgentRunEvent) => void) => () => void;
  agentArtifactResolve: (data: import('../../shared/ipc/types').AgentArtifactResolveRequest) => Promise<import('../../shared/ipc/types').AgentArtifactResolveResponse>;
  agentArtifactAction: (data: import('../../shared/ipc/types').AgentArtifactActionRequest) => Promise<import('../../shared/ipc/types').AgentArtifactActionResponse>;
  agentJobUpdate: (data: import('../../shared/ipc/types').AgentJobUpdateRequest) => Promise<import('../../shared/ipc/types').AgentJobUpdateResponse>;
  agentMemoryProposalsGet: (data: import('../../shared/ipc/types').AgentMemoryProposalsGetRequest) => Promise<import('../../shared/ipc/types').AgentMemoryProposalsGetResponse>;
  agentMemoryProposalResolve: (data: import('../../shared/ipc/types').AgentMemoryProposalResolveRequest) => Promise<import('../../shared/ipc/types').AgentMemoryProposalResolveResponse>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
