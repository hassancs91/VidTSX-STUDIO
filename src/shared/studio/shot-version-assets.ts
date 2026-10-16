// A TSX builder shot's own files under its runtime props (TSX_BUILDER_DESIGN.md
// P3 part 6, D8). A builder version loads files from its shot folder
// (`vN.assets/`, or an earlier `vK.assets/`): a 3D model, an environment map, a
// font, as well as the images / video / audio part 5 also registers as project
// media. The preview (the shot module response) and the export entry (the
// serialized timeline) both put those URLs under the props the serializer made
// from the shot's `assetRefs`, and the `assetRefs` win for the same key: an
// Inspector media swap keeps working, and for registered media both name the
// same file anyway.

import type { ShotRuntimeProps } from '../types/studio';

/** `props` with `files` (key → URL) merged under its `assets`; `props` itself when there are no files. */
export function mergeVersionAssets(
  props: ShotRuntimeProps | undefined,
  files: Record<string, string> | null | undefined,
): ShotRuntimeProps | undefined {
  if (!files || Object.keys(files).length === 0) return props;
  return { ...(props ?? {}), assets: { ...files, ...(props?.assets ?? {}) } };
}
