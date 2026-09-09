export const IPC = {
  // App operations
  APP_GET_INFO: 'app:get-info',
  APP_OPEN_EXTERNAL: 'app:open-external',
  APP_GET_IS_DEV: 'app:get-is-dev',

  // Auto-update operations
  UPDATER_GET_STATE: 'updater:get-state',
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_CANCEL: 'updater:cancel',
  UPDATER_INSTALL: 'updater:install',
  UPDATER_SET_PREFS: 'updater:set-prefs',
  /** Push: full UpdaterState on every transition. */
  UPDATER_STATE: 'updater:state',

  // File operations
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DELETE: 'file:delete',
  FILE_LIST: 'file:list',
  FILE_CREATE_FOLDER: 'file:create-folder',
  FILE_IMPORT: 'file:import',
  FILE_RENAME: 'file:rename',
  FILE_MOVE: 'file:move',
  FILE_GET_PROJECTS_DIR: 'file:get-projects-dir',
  FILE_GET_ASSETS_DIR: 'file:get-assets-dir',
  FILE_READ_BINARY: 'file:read:binary',

  // Dialog operations
  DIALOG_OPEN: 'dialog:open',
  DIALOG_SAVE: 'dialog:save',

  // Context menu operations
  CONTEXT_MENU_SHOW: 'context-menu:show',

  // Clipboard operations
  CLIPBOARD_READ_TEXT: 'clipboard:read-text',

  // Screenshot operations
  SCREENSHOT_COPY: 'screenshot:copy',
  SCREENSHOT_SAVE: 'screenshot:save',
  SCREENSHOT_SAVE_TO_PATH: 'screenshot:save-to-path',

  // Bundle operations
  BUNDLE_CREATE: 'bundle:create',
  BUNDLE_INVALIDATE: 'bundle:invalidate',
  BUNDLE_PROGRESS: 'bundle:progress',

  // Module operations (native player)
  MODULE_TRANSPILE: 'module:transpile',
  MODULE_SERVER_URL: 'module:server:url',

  // TSX validation
  TSX_VALIDATE: 'tsx:validate',

  // Render operations
  RENDER_START: 'render:start',
  RENDER_CANCEL: 'render:cancel',
  RENDER_PROGRESS: 'render:progress',
  RENDER_COMPLETE: 'render:complete',
  RENDER_ENCODER_RESOLVED: 'render:encoder:resolved',
  RENDER_QUEUE_GET: 'render:queue:get',
  RENDER_QUEUE_SAVE: 'render:queue:save',
  RENDER_QUEUE_LOAD: 'render:queue:load',
  RENDER_OPEN_FILE: 'render:open:file',
  RENDER_OPEN_FOLDER: 'render:open:folder',
  RENDER_GET_VIDEOS_DIR: 'render:get:videos:dir',
  RENDER_HISTORY_LOAD: 'render:history:load',
  RENDER_HISTORY_APPEND: 'render:history:append',

  // Shared provider API keys (BYOK: fal / openrouter / assemblyai)
  PROVIDER_KEYS_GET: 'provider-keys:get',
  PROVIDER_KEYS_SAVE: 'provider-keys:save',

  // Editable per-provider model catalogs (fal/OpenRouter image models)
  PROVIDER_MODELS_GET: 'provider-models:get',
  PROVIDER_MODELS_SAVE: 'provider-models:save',
  PROVIDER_MODELS_RESET: 'provider-models:reset',

  // Per-model image parameter overrides (steps, guidance, seed… — W2c)
  IMAGE_MODEL_PARAMS_GET: 'image-model-params:get',
  IMAGE_MODEL_PARAMS_SAVE: 'image-model-params:save',

  // Video generation (src/video-engine — cloud providers, BYOK)
  VIDEO_GENERATE: 'video:generate',
  VIDEO_GET_JOB: 'video:get-job',
  VIDEO_CANCEL: 'video:cancel',
  VIDEO_JOB_PROGRESS: 'video:job-progress',
  VIDEO_PROVIDERS_GET: 'video:providers:get',
  VIDEO_MODELS_GET: 'video:models:get',
  VIDEO_PROVIDER_TEST: 'video:provider:test',

  // Provider-agnostic transcription (local whisper / AssemblyAI / OpenRouter)
  STT_TRANSCRIBE_RUN: 'stt:transcribe:run',
  STT_TRANSCRIBE_PROGRESS: 'stt:transcribe:progress',
  STT_TRANSCRIBE_CANCEL: 'stt:transcribe:cancel',
  STT_PROVIDERS_GET: 'stt:providers:get',
  STT_PROVIDERS_SAVE: 'stt:providers:save',

  // Video Studio
  VIDEO_STUDIO_SAVE: 'video-studio:save',
  VIDEO_STUDIO_LIST: 'video-studio:list',
  VIDEO_STUDIO_DELETE: 'video-studio:delete',
  VIDEO_STUDIO_SAVE_AS: 'video-studio:save-as',
  VIDEO_STUDIO_READ_PATH: 'video-studio:read-path',
  VIDEO_STUDIO_FOLDER_CREATE: 'video-studio:folder:create',
  VIDEO_STUDIO_FOLDER_RENAME: 'video-studio:folder:rename',
  VIDEO_STUDIO_FOLDER_DELETE: 'video-studio:folder:delete',
  VIDEO_STUDIO_MOVE_TO_FOLDER: 'video-studio:move-to-folder',

  // Settings operations
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET_OUTPUT_FOLDER: 'settings:set:output-folder',
  SETTINGS_SET_WHISPER_MODEL: 'settings:set:whisper-model',
  SETTINGS_SET_AI_MODELS_FOLDER: 'settings:set:ai-models-folder',
  SETTINGS_SET_RENDER_TIMEOUT: 'settings:set:render-timeout',
  SETTINGS_SET_RENDER_DEFAULT_CPU_USAGE: 'settings:set:render-default-cpu-usage',
  SETTINGS_SET_RENDER_DEFAULT_GPU_BACKEND: 'settings:set:render-default-gpu-backend',
  SETTINGS_SET_RENDER_DEFAULT_HARDWARE_ACCELERATION: 'settings:set:render-default-hardware-acceleration',
  SETTINGS_SET_RENDER_DEFAULT_EXPORT_ENGINE: 'settings:set:render-default-export-engine',
  SETTINGS_SET_CRASH_REPORTING: 'settings:set:crash-reporting',

  // Dialog operations (folder picker)
  DIALOG_OPEN_FOLDER: 'dialog:open:folder',

  // Whisper operations
  WHISPER_BINARY_STATUS: 'whisper:binary:status',
  WHISPER_BINARY_INSTALL: 'whisper:binary:install',
  WHISPER_PROGRESS: 'whisper:progress',
  WHISPER_MODELS_LIST: 'whisper:models:list',
  WHISPER_MODEL_DOWNLOAD: 'whisper:model:download',
  WHISPER_MODEL_DELETE: 'whisper:model:delete',
  WHISPER_TRANSCRIBE: 'whisper:transcribe',
  WHISPER_TRANSCRIBE_PROGRESS: 'whisper:transcribe:progress',
  WHISPER_TRANSCRIBE_CANCEL: 'whisper:transcribe:cancel',

  // Transcription project operations
  TRANSCRIPTION_PROJECT_LIST: 'transcription:project:list',
  TRANSCRIPTION_PROJECT_SAVE: 'transcription:project:save',
  TRANSCRIPTION_PROJECT_LOAD: 'transcription:project:load',
  TRANSCRIPTION_PROJECT_DELETE: 'transcription:project:delete',

  // LLM operations
  LLM_PROVIDERS_GET: 'llm:providers:get',
  LLM_PROVIDERS_SAVE: 'llm:providers:save',
  LLM_PROVIDER_TEST: 'llm:provider:test',
  LLM_GENERATE: 'llm:generate',
  LLM_CHAT_GENERATE: 'llm:chat:generate',
  LLM_CANCEL: 'llm:cancel',

  // Skills registry
  SKILLS_LIST: 'skills:list',

  // Flows (node-graph builder) — projects
  FLOWS_PROJECT_LIST: 'flows:project:list',
  FLOWS_PROJECT_CREATE: 'flows:project:create',
  FLOWS_PROJECT_LOAD: 'flows:project:load',
  FLOWS_PROJECT_UPDATE: 'flows:project:update',
  FLOWS_PROJECT_DELETE: 'flows:project:delete',

  // Flows — run history (Phase 5)
  FLOWS_RUN_PERSIST: 'flows:run:persist',
  FLOWS_RUN_LIST: 'flows:run:list',
  FLOWS_RUN_LOAD: 'flows:run:load',

  // Image generation operations
  IMAGE_PROVIDERS_GET: 'image:providers:get',
  IMAGE_PROVIDERS_SAVE: 'image:providers:save',
  IMAGE_PROVIDER_TEST: 'image:provider:test',
  IMAGE_MODELS_GET: 'image:models:get',
  IMAGE_GENERATE: 'image:generate',
  IMAGE_GENERATE_CANCEL: 'image:generate:cancel',
  IMAGE_PROVIDER_SWITCH: 'image:provider:switch',
  IMAGE_CLI_STATUS: 'image:cli:status',

  // Image Studio operations
  IMAGE_STUDIO_SAVE: 'image-studio:save',
  IMAGE_STUDIO_LIST: 'image-studio:list',
  IMAGE_STUDIO_DELETE: 'image-studio:delete',
  IMAGE_STUDIO_SAVE_AS: 'image-studio:save-as',
  IMAGE_STUDIO_COPY: 'image-studio:copy',
  IMAGE_STUDIO_READ: 'image-studio:read',
  IMAGE_STUDIO_FOLDER_CREATE: 'image-studio:folder:create',
  IMAGE_STUDIO_FOLDER_RENAME: 'image-studio:folder:rename',
  IMAGE_STUDIO_FOLDER_DELETE: 'image-studio:folder:delete',
  IMAGE_STUDIO_MOVE_TO_FOLDER: 'image-studio:move-to-folder',

  // Reference image library
  REF_IMAGE_SAVE: 'ref-image:save',
  REF_IMAGE_LIST: 'ref-image:list',
  REF_IMAGE_DELETE: 'ref-image:delete',
  REF_IMAGE_TOGGLE: 'ref-image:toggle',
  REF_IMAGE_READ: 'ref-image:read',

  // Prompt preset settings
  PROMPT_PRESETS_GET: 'prompt-presets:get',
  PROMPT_PRESETS_SAVE: 'prompt-presets:save',
  PROMPT_PRESETS_RESET: 'prompt-presets:reset',

  // Thumbnail operations
  THUMBNAIL_READ: 'thumbnail:read',
  THUMBNAIL_READY: 'thumbnail:ready',

  // Logging
  LOG_WRITE: 'log:write',

  // Tools: Frame Extractor
  TOOLS_VIDEO_PROBE: 'tools:video:probe',
  TOOLS_FRAME_EXTRACT: 'tools:frame:extract',
  TOOLS_FRAME_EXTRACT_PROGRESS: 'tools:frame:extract:progress',
  TOOLS_FRAME_EXTRACT_CANCEL: 'tools:frame:extract:cancel',
  TOOLS_FRAME_SAVE_ZIP: 'tools:frame:save:zip',
  TOOLS_FRAME_SAVE_SINGLE: 'tools:frame:save:single',


  // Audio engine operations
  AUDIO_STATUS: 'audio:status',
  AUDIO_MODELS_LIST: 'audio:models:list',
  AUDIO_MODEL_DOWNLOAD: 'audio:model:download',
  AUDIO_MODEL_DELETE: 'audio:model:delete',
  AUDIO_DOWNLOAD_PROGRESS: 'audio:download:progress',

  // Audio STT
  AUDIO_STT_LOAD_MODEL: 'audio:stt:load-model',
  AUDIO_STT_TRANSCRIBE: 'audio:stt:transcribe',
  AUDIO_STT_TRANSCRIBE_PROGRESS: 'audio:stt:transcribe:progress',
  AUDIO_STT_STREAM_START: 'audio:stt:stream:start',
  AUDIO_STT_STREAM_FEED: 'audio:stt:stream:feed',
  AUDIO_STT_STREAM_STOP: 'audio:stt:stream:stop',
  AUDIO_STT_PARTIAL: 'audio:stt:partial',

  // Audio TTS
  AUDIO_TTS_LOAD_MODEL: 'audio:tts:load-model',
  AUDIO_TTS_GENERATE: 'audio:tts:generate',

  // Audio settings
  AUDIO_SETTINGS_GET: 'audio:settings:get',
  AUDIO_SETTINGS_SAVE: 'audio:settings:save',

  // Cloud audio generation — sound effects + music (W2b)
  AUDIO_GENERATE: 'audio:generate',

  // Local SD image engine operations
  SDIMAGE_STATUS: 'sdimage:status',
  SDIMAGE_MODELS_LIST: 'sdimage:models:list',
  SDIMAGE_MODEL_DOWNLOAD: 'sdimage:model:download',
  SDIMAGE_DOWNLOAD_COMPANIONS: 'sdimage:download:companions',
  SDIMAGE_MODEL_DELETE: 'sdimage:model:delete',
  SDIMAGE_DOWNLOAD_PROGRESS: 'sdimage:download:progress',
  SDIMAGE_CLI_STATUS: 'sdimage:cli:status',
  SDIMAGE_CLI_INSTALL: 'sdimage:cli:install',
  SDIMAGE_SET_ACTIVE_MODEL: 'sdimage:set-active-model',
  SDIMAGE_GENERATE: 'sdimage:generate',
  SDIMAGE_GENERATE_PROGRESS: 'sdimage:generate:progress',
  SDIMAGE_GENERATE_COMPLETE: 'sdimage:generate:complete',
  SDIMAGE_GENERATE_ERROR: 'sdimage:generate:error',
  SDIMAGE_CANCEL: 'sdimage:cancel',
  SDIMAGE_CANCEL_ALL: 'sdimage:cancel-all',
  SDIMAGE_QUEUE_GET: 'sdimage:queue:get',
  SDIMAGE_SETTINGS_GET: 'sdimage:settings:get',
  SDIMAGE_SETTINGS_SAVE: 'sdimage:settings:save',

  // Local video models (Wan/LTX/LingBot via sd-cli) — library uses the generic MODELS_* channels
  SDVIDEO_MODEL_DOWNLOAD: 'sdvideo:model:download',
  SDVIDEO_GENERATE: 'sdvideo:generate',
  SDVIDEO_GENERATE_PROGRESS: 'sdvideo:generate:progress',
  SDVIDEO_GENERATE_COMPLETE: 'sdvideo:generate:complete',
  SDVIDEO_GENERATE_ERROR: 'sdvideo:generate:error',
  SDVIDEO_CANCEL: 'sdvideo:cancel',

  // Generic model-library operations (category-agnostic; image implemented in v1)
  MODELS_SCAN: 'models:scan',
  MODELS_IMPORT: 'models:import',
  MODELS_CONFIGURE: 'models:configure',
  MODELS_REMOVE: 'models:remove',
  MODELS_USAGE_GET: 'models:usage:get',
  MODELS_OPEN_FOLDER: 'models:open-folder',
  MODELS_SET_FOLDER: 'models:set-folder',

  // Local LLM engine operations
  LOCAL_LLM_STATUS: 'local-llm:status',
  LOCAL_LLM_MODELS_LIST: 'local-llm:models:list',
  LOCAL_LLM_MODEL_DOWNLOAD: 'local-llm:model:download',
  LOCAL_LLM_MODEL_DELETE: 'local-llm:model:delete',
  LOCAL_LLM_DOWNLOAD_PROGRESS: 'local-llm:download:progress',
  LOCAL_LLM_LOAD_MODEL: 'local-llm:load-model',
  LOCAL_LLM_UNLOAD_MODEL: 'local-llm:unload-model',
  LOCAL_LLM_GENERATE: 'local-llm:generate',
  LOCAL_LLM_CHAT: 'local-llm:chat',
  LOCAL_LLM_TOKEN: 'local-llm:token',
  LOCAL_LLM_COMPLETE: 'local-llm:complete',
  LOCAL_LLM_CANCEL: 'local-llm:cancel',
  LOCAL_LLM_SESSION_CLEAR: 'local-llm:session:clear',
  LOCAL_LLM_GPU_INFO: 'local-llm:gpu-info',
  LOCAL_LLM_SETTINGS_GET: 'local-llm:settings:get',
  LOCAL_LLM_SETTINGS_SAVE: 'local-llm:settings:save',

  // Embedding engine operations
  EMBEDDING_MODELS_LIST: 'embedding:models:list',
  EMBEDDING_MODEL_DOWNLOAD: 'embedding:model:download',
  EMBEDDING_MODEL_DELETE: 'embedding:model:delete',
  EMBEDDING_DOWNLOAD_PROGRESS: 'embedding:download:progress',
  EMBEDDING_LOAD_MODEL: 'embedding:load-model',
  EMBEDDING_UNLOAD_MODEL: 'embedding:unload-model',
  EMBEDDING_EMBED: 'embedding:embed',

  // System info (one-shot dashboard snapshot)
  SYSTEM_INFO_GET: 'system:info:get',

  // AI runtime (downloadable Python + PyTorch stack — docs/ai-runtime-implementation-plan.md §3)
  AI_RUNTIME_STATUS: 'ai-runtime:status',
  AI_RUNTIME_INSTALL: 'ai-runtime:install',
  AI_RUNTIME_REPAIR: 'ai-runtime:repair',
  AI_RUNTIME_REMOVE: 'ai-runtime:remove',
  AI_RUNTIME_STATUS_CHANGED: 'ai-runtime:status-changed',

  // Runtime-backed Python models (catalogue status / download / preflight — plan §4 step 4, §7b)
  PYMODEL_STATUS: 'pymodel:status',
  PYMODEL_DOWNLOAD: 'pymodel:download',
  PYMODEL_CANCEL_DOWNLOAD: 'pymodel:cancel-download',
  PYMODEL_REMOVE: 'pymodel:remove',
  PYMODEL_PREFLIGHT: 'pymodel:preflight',
  PYMODEL_INSTALL: 'pymodel:install',

  // Background removal (rembg) in Image Studio
  REMBG_RUN: 'rembg:run',
  REMBG_PROGRESS: 'rembg:progress',
  REMBG_COMPLETE: 'rembg:complete',
  REMBG_ERROR: 'rembg:error',
  REMBG_CANCEL: 'rembg:cancel',

  // Image → 3D (TripoSR) + 3D Studio storage (plan §5 step 4)
  SD3D_GENERATE: 'sd3d:generate',
  SD3D_GENERATE_PROGRESS: 'sd3d:generate:progress',
  SD3D_GENERATE_COMPLETE: 'sd3d:generate:complete',
  SD3D_GENERATE_ERROR: 'sd3d:generate:error',
  SD3D_CANCEL: 'sd3d:cancel',
  THREED_STUDIO_LIST: 'threed-studio:list',
  THREED_STUDIO_READ: 'threed-studio:read',
  THREED_STUDIO_DELETE: 'threed-studio:delete',
  THREED_STUDIO_SAVE_AS: 'threed-studio:save-as',
  THREED_STUDIO_SAVE_TO_LIBRARY: 'threed-studio:save-to-library',
  THREED_STUDIO_OPEN_FOLDER: 'threed-studio:open-folder',

  // System resource monitor (push event only — always on)
  SYSTEM_MONITOR_DATA: 'system:monitor:data',

  // Download manager operations
  DOWNLOAD_ENQUEUE: 'download:enqueue',
  DOWNLOAD_PAUSE: 'download:pause',
  DOWNLOAD_RESUME: 'download:resume',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_GET_ALL: 'download:get-all',
  DOWNLOAD_PROGRESS: 'download:progress',

  // Moderation engine
  MODERATION_CHECK: 'moderation:check',

  // Content Safety (always-on visual-generation gate)
  CONTENT_SAFETY_STATUS: 'content-safety:status',

  // TSX generation jobs (Creator — concurrent generations in main)
  TSXJOB_START: 'tsxjob:start',
  TSXJOB_CANCEL: 'tsxjob:cancel',
  TSXJOB_LIST: 'tsxjob:list',
  TSXJOB_CLEAR_COMPLETED: 'tsxjob:clear-completed',
  TSXJOB_CONFIGURE: 'tsxjob:configure',
  TSXJOB_EVENT: 'tsxjob:event',
  TSXJOB_STREAM: 'tsxjob:stream',

  // AI Usage tracking
  AI_USAGE_GET_SUMMARY: 'ai-usage:get-summary',
  AI_USAGE_GET_CHART: 'ai-usage:get-chart',
  AI_USAGE_GET_LOG: 'ai-usage:get-log',
  AI_USAGE_GET_AGENTS: 'ai-usage:get-agents',
  AI_USAGE_CLEAR: 'ai-usage:clear',

  // Studio (AI video editor) — projects & media
  STUDIO_ROOT_GET: 'studio:root:get',
  STUDIO_ROOT_SET: 'studio:root:set',
  STUDIO_PROJECT_LIST: 'studio:project:list',
  STUDIO_PROJECT_CREATE: 'studio:project:create',
  STUDIO_PROJECT_LOAD: 'studio:project:load',
  STUDIO_PROJECT_SAVE: 'studio:project:save',
  STUDIO_PROJECT_DELETE: 'studio:project:delete',
  // Studio — rotating project snapshots + quit-flush handshake (Q10)
  STUDIO_PROJECT_SNAPSHOT_LIST: 'studio:project:snapshot:list',
  STUDIO_PROJECT_SNAPSHOT_RESTORE: 'studio:project:snapshot:restore',
  STUDIO_FLUSH_REQUEST: 'studio:flush:request',
  STUDIO_FLUSH_ACK: 'studio:flush:ack',
  STUDIO_MEDIA_IMPORT: 'studio:media:import',
  STUDIO_MEDIA_RELINK: 'studio:media:relink',
  STUDIO_CACHE_READ: 'studio:cache:read',
  STUDIO_CACHE_INFO: 'studio:cache:info',
  STUDIO_CACHE_OPEN: 'studio:cache:open',
  STUDIO_CACHE_CLEAR: 'studio:cache:clear',
  // Studio — optional GPU proxy encoder (downloaded full ffmpeg, off by default)
  STUDIO_PROXY_ENCODER_STATUS: 'studio:proxy-encoder:status',
  STUDIO_PROXY_ENCODER_INSTALL: 'studio:proxy-encoder:install',
  STUDIO_PROXY_ENCODER_SET_ENABLED: 'studio:proxy-encoder:set-enabled',
  // Studio — timeline preview, background media jobs, export
  STUDIO_MEDIA_PREPARE: 'studio:media:prepare',
  STUDIO_MEDIA_JOB_EVENT: 'studio:media:job-event',
  STUDIO_EXPORT_PREPARE: 'studio:export:prepare',
  STUDIO_EXPORT_ENGINES_LIST: 'studio:export:engines:list',
  // Studio — per-asset transcription (button-triggered) + auto-cut planning
  STUDIO_TRANSCRIBE_START: 'studio:transcribe:start',
  STUDIO_TRANSCRIBE_CANCEL: 'studio:transcribe:cancel',
  STUDIO_CUTPLAN_RUN: 'studio:cutplan:run',
  // Studio — editing agent (Assistant tab chat)
  STUDIO_AGENT_SEND: 'studio:agent:send',
  STUDIO_AGENT_CANCEL: 'studio:agent:cancel',
  STUDIO_AGENT_EVENT: 'studio:agent:event',
  // Studio — W3: the renderer answers an agent 'action' event (apply, export, captions)
  STUDIO_AGENT_ACTION_RESULT: 'studio:agent:action-result',
  // Studio — persisted Assistant transcript (SHOT_QUALITY Q1d)
  STUDIO_AGENT_CHAT_LOAD: 'studio:agent:chat:load',
  STUDIO_AGENT_CHAT_SAVE: 'studio:agent:chat:save',
  STUDIO_AGENT_CHAT_RESET: 'studio:agent:chat:reset',
  // Studio — TSX shots (S4): transpile a shot version for the preview Player
  STUDIO_SHOT_MODULE: 'studio:shot:module',
  // Studio — TSX shot generation (S4 D8): pipeline runs + push events
  STUDIO_SHOT_GENERATE: 'studio:shot:generate',
  STUDIO_SHOT_VERSIONS: 'studio:shot:versions',
  STUDIO_SHOT_JOB_EVENT: 'studio:shot:job-event',
  // Studio — TSX import (S4 D14): source-agnostic accept path + Creator list
  STUDIO_SHOT_IMPORT: 'studio:shot:import',
  STUDIO_SHOT_CONFORM: 'studio:shot:conform',
  STUDIO_CREATOR_PROJECTS: 'studio:creator:projects',
  // Studio — shots/ ↔ registry reconcile (SHOT_QUALITY Q1c): adopt orphan and
  // dropped-in shot folders on project open / window focus
  STUDIO_SHOTS_RECONCILE: 'studio:shots:reconcile',
  // Studio — linked folder (SHOT_QUALITY Q2): the Creator library's live view
  // of every Studio project's shot folders
  STUDIO_SHOT_LIBRARY: 'studio:shot:library',
  // Studio — caption templates (D13): pack listing + preview module URL
  STUDIO_PACKAGE_PLAN: 'studio:package:plan',
  STUDIO_PACKAGE_EXPORT: 'studio:package:export',
  STUDIO_PACKAGE_INSPECT: 'studio:package:inspect',
  STUDIO_PACKAGE_IMPORT: 'studio:package:import',

  // W5: editing presets — learn from this video (the card the user accepts).
  STUDIO_PRESET_LEARN: 'studio:preset:learn',
  STUDIO_PRESET_PROPOSALS_GET: 'studio:preset:proposals:get',
  STUDIO_PRESET_PROPOSAL_RESOLVE: 'studio:preset:proposal:resolve',
  STUDIO_PACKAGE_EVENT: 'studio:package:event',
  STUDIO_PACKAGE_PENDING: 'studio:package:pending',
  STUDIO_PACKAGE_OPEN_FILE: 'studio:package:open-file',

  STUDIO_CAPTION_TEMPLATES: 'studio:caption:templates',
  STUDIO_CAPTION_TEMPLATE_MODULE: 'studio:caption:template-module',

  // Announcements feed (Phase I) — static vidtsx.com/app/feed.json, validated
  // in main; the renderer only ever sees clamped plain-text messages.
  NEWS_GET: 'news:get',
  NEWS_DISMISS: 'news:dismiss',
  NEWS_SET_ENABLED: 'news:set-enabled',

  // Studio — agent memory (G5): manual entry + MemoryDialog. App-wide user
  // preference data read by the Studio editing agent; store lives in main
  // (userData/studio/memory.json), the renderer only sees the records.
  MEMORY_LIST: 'memory:list',
  MEMORY_SAVE: 'memory:save',
  MEMORY_DELETE: 'memory:delete',
  MEMORY_SET_ACTIVE: 'memory:set-active',
  // G3/G4: agent proposals pending the user's accept/edit/reject. New
  // proposals ride the STUDIO_AGENT_EVENT stream; GET re-fetches after
  // navigation.
  MEMORY_PROPOSALS_GET: 'memory:proposals:get',
  MEMORY_PROPOSAL_RESOLVE: 'memory:proposal:resolve',
  // Q6c: pending style promotions (brand styleNotes + memory retire on accept).
  MEMORY_PROMOTIONS_GET: 'memory:promotions:get',
  MEMORY_PROMOTION_RESOLVE: 'memory:promotion:resolve',
  // W4: vocabulary cards (accept writes the brand).
  MEMORY_VOCABULARY_PROPOSALS_GET: 'memory:vocabulary:proposals:get',
  MEMORY_VOCABULARY_PROPOSAL_RESOLVE: 'memory:vocabulary:proposal:resolve',

  // Asset library — index overlay (descriptions), sizes, root override
  LIBRARY_INDEX_GET: 'library:index:get',
  LIBRARY_DESCRIPTION_SET: 'library:description:set',
  LIBRARY_SIZES_GET: 'library:sizes:get',
  LIBRARY_ROOT_GET: 'library:root:get',
  LIBRARY_ROOT_SET: 'library:root:set',

  // Asset library — brands (L3/D11)
  LIBRARY_BRANDS_GET: 'library:brands:get',
  LIBRARY_BRAND_SAVE: 'library:brand:save',
  LIBRARY_BRAND_DELETE: 'library:brand:delete',
  LIBRARY_BRAND_DEFAULT_SET: 'library:brand:default:set',

  // Asset library — editing presets (V1 completion plan §2.5)
  LIBRARY_PRESETS_GET: 'library:presets:get',
  LIBRARY_PRESET_SAVE: 'library:preset:save',
  LIBRARY_PRESET_DELETE: 'library:preset:delete',

  // Asset library — AI descriptions (L2): availability + one-time consent,
  // and a batch describe job whose per-item results arrive on the event
  // channel (the media-job push pattern).
  LIBRARY_DESCRIBE_AVAILABILITY: 'library:describe:availability',
  LIBRARY_PREFS_SET: 'library:prefs:set',
  LIBRARY_DESCRIBE_START: 'library:describe:start',
  LIBRARY_DESCRIBE_CANCEL: 'library:describe:cancel',
  LIBRARY_DESCRIBE_EVENT: 'library:describe:event',

  // Asset library — AI organize (L7): suggest a move plan, then apply the
  // moves the user accepted. Assets the open project references are never
  // proposed, and the rule is re-checked at apply time.
  LIBRARY_ORGANIZE_SUGGEST: 'library:organize:suggest',
  LIBRARY_ORGANIZE_APPLY: 'library:organize:apply',

  // Asset library — visible web capture handshake (L6/D12): main pushes
  // 'pending' while a visible capture window waits; the renderer chip fires
  // the trigger (capture or cancel).
  LIBRARY_CAPTURE_TRIGGER: 'library:capture:trigger',
  LIBRARY_CAPTURE_EVENT: 'library:capture:event',
  // Agents (docs/agents-plan.md) — installed declarative agents, their saved
  // sessions, and one run stream. AGENT_RUN_EVENT is push-only (deltas, tool
  // chips, artifacts, interaction requests, render job requests).
  AGENTS_LIST: 'agents:list',
  AGENTS_INSPECT: 'agents:inspect',
  AGENTS_INSTALL: 'agents:install',
  AGENTS_REMOVE: 'agents:remove',
  AGENTS_CHECK_UPDATE: 'agents:check-update',
  AGENT_SESSIONS_LIST: 'agents:sessions:list',
  AGENT_SESSION_CREATE: 'agents:session:create',
  AGENT_SESSION_LOAD: 'agents:session:load',
  AGENT_SESSION_DELETE: 'agents:session:delete',
  AGENT_SESSION_RENAME: 'agents:session:rename',
  AGENT_SESSION_BRAND_SET: 'agents:session:brand:set',
  AGENT_RUN_SEND: 'agents:run:send',
  AGENT_RUN_CANCEL: 'agents:run:cancel',
  AGENT_RUN_EVENT: 'agents:run:event',
  AGENT_INTERACTION_REPLY: 'agents:interaction:reply',
  AGENT_ARTIFACT_ACTION: 'agents:artifact:action',
  // A viewer asks main for what it needs to SHOW an artifact: a re-served
  // module url for a composition (the module store is in-memory, §1.5), the
  // markdown for a document, asset urls for library media. Paths stay in main.
  AGENT_ARTIFACT_RESOLVE: 'agents:artifact:resolve',
  // The renderer owns the render queue (§1.5), so it is the only place that
  // knows a queued agent render moved on. It reports back here and main files
  // the output and appends the `video` artifact.
  AGENT_JOB_UPDATE: 'agents:job:update',
  // `propose_memory` cards (§1.10). The proposal itself rides AGENT_RUN_EVENT;
  // GET re-fetches after navigation, RESOLVE is the user's accept/reject and
  // carries the SCOPE they chose — this agent, or every agent.
  AGENT_MEMORY_PROPOSALS_GET: 'agents:memory:proposals:get',
  AGENT_MEMORY_PROPOSAL_RESOLVE: 'agents:memory:proposal:resolve',
  // A double-clicked `.vidtsxagent` (§1.6). Main parks the path — kind-scoped,
  // so Studio's browser cannot claim it — pushes OPEN_FILE to get the user to
  // the Agents screen, and the gallery claims the path with PENDING_PACKAGE.
  AGENTS_PACKAGE_OPEN_FILE: 'agents:package:open-file',
  AGENTS_PENDING_PACKAGE: 'agents:package:pending',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
