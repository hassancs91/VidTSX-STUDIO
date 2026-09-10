// Which artifact kind a media port carries (flows plan §1.2, W8 Stage 3).
// `image` / `images` carry an `image-set`, `video` / `videos` a `video`,
// `audio` an `audio`, `composition` a `composition`, and `transcript` a
// `document` whose payload carries the `transcript` variant — no eighth
// artifact kind exists for it. `text` and `number` are primitives and carry
// no artifact. Pure; the runner's output mapping and the tools that accept
// several kinds on sibling ports (`save_to_library`) both read this.

import type { ArtifactKind } from '../types/agents';
import type { DataType } from '../types/flows';

const KIND_FOR: Partial<Record<DataType, ArtifactKind>> = {
  image: 'image-set',
  images: 'image-set',
  video: 'video',
  videos: 'video',
  audio: 'audio',
  composition: 'composition',
  transcript: 'document',
};

/** The artifact kind a port of this type carries; undefined for primitives. */
export function artifactKindForPort(dataType: DataType): ArtifactKind | undefined {
  return KIND_FOR[dataType];
}

/** Whether an artifact of `kind` belongs on a port of `dataType`. */
export function portCarriesKind(dataType: DataType, kind: ArtifactKind): boolean {
  return KIND_FOR[dataType] === kind;
}
