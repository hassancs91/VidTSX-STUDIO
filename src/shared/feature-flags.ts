const FEATURE_FLAGS: Record<string, boolean> = {
  // Primary workflow — TSX → Image → Video
  creator: true,
  flows: true,
  'image-studio': true,
  transcribe: true,
  // Secondary (visible in production)
  assets: true,
  render: true,
  // Local AI model management screen — also hosts AI provider config and
  // whisper.cpp install (moved here when the Settings screen was retired),
  // so it must stay visible in production.
  'ai-models': true,
  // Hidden in production until ready:
  'video-studio': false,
  tools: false,
  'audio-engine': false,
  // AI Models sub-tabs still in development — "Coming soon" placeholders in
  // production (the tabs stay visible so users see what's ahead).
  'ai-video-models': false,
  'ai-embedding-models': false,
  // Flows nav entry stays visible ("flows" above), but the editor itself ships
  // later — production renders a Coming Soon screen instead.
  'flows-editor': false,
  // License UI kept dormant — the app is free (BYOK). The license shell stays
  // compiled for possible future reuse; flip this to resurface the section.
  'license-ui': false,
};

export function isFeatureEnabled(id: string): boolean {
  const flag = FEATURE_FLAGS[id];
  if (flag === undefined) return false;
  return import.meta.env.DEV ? true : flag;
}
