// Two shapes left from the one-shot pipeline's shot prompt (D8), deleted in
// P3 part 8 with the pipeline: the exemplar a shot kind is judged against
// (shot-exemplars.ts) and a media row of a shot's asset table
// (shot-asset-refs.ts). The builder's shot prompt is
// main/services/studio/shot-build-request.ts.

/** One exemplar shot (Q3a, SHOT_QUALITY_DESIGN.md): finished brand-scrubbed
 *  code, the quality bar for its shot kind. */
export interface ShotExemplar {
  name: string;
  description: string;
  code: string;
}

/** One row of a shot's asset table (D12) — everything known about a ref
 *  except the URL, which only exists at render time. */
export interface ShotPromptAsset {
  /** The `assets.<key>` name the code uses. */
  key: string;
  kind: 'video' | 'image';
  width?: number;
  height?: number;
  durationSeconds?: number;
  description?: string;
}
