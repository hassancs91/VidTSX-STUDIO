const FEATURE_FLAGS: Record<string, boolean> = {
  // Primary workflow — TSX → Image → Video
  home: true,
  studio: true,
  flows: true,
  'image-studio': true,
  transcribe: true,
  // Secondary (visible in production)
  creator: true,
  assets: true,
  render: true,
  settings: true,
  // Hidden in production until ready:
  'video-studio': false,
  whiteboard: false, // "Scribe" in the sidebar
  tools: false,
  prototyper: false,
  'audio-engine': false,
  // License UI kept dormant — the app is free (BYOK). The license shell stays
  // compiled for possible future reuse; flip this to resurface the section.
  'license-ui': false,
};

export function isFeatureEnabled(id: string): boolean {
  const flag = FEATURE_FLAGS[id];
  if (flag === undefined) return false;
  return import.meta.env.DEV ? true : flag;
}
