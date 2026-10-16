// What the `/asset?path=` routes may serve — ONE list for the preview's module
// server and the export's bundler server, so a file a shot loads previews and
// renders alike. They had drifted: the preview refused fonts and data the
// export served, so a shot loading a font file through `staticFile` (video-14's
// Claude Code mock, `codicon.ttf`) rendered in export and lost its glyphs in the
// preview (CAPABILITY_GAPS.md "Fifth project: video-14").
//
// Kept as an explicit allowlist (never wildcard) so executables and scripts can
// never be served even if a malformed user TSX builds a path. Covers the asset
// library's full surface: video / audio / images / 3D / fonts / data.
export const ASSET_ROUTE_EXTENSIONS: ReadonlySet<string> = new Set([
  // video
  '.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.mts', '.m2ts',
  // audio
  '.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.opus',
  // images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif',
  // 3D
  '.glb', '.gltf', '.obj', '.fbx',
  // fonts
  '.woff', '.woff2', '.ttf', '.otf',
  // data
  '.json', '.txt', '.csv', '.xml', '.md',
  // subject-mask blobs the render host reads by range (FILTER_PACKS_DESIGN.md
  // "As built (masks track)")
  '.bin',
]);
