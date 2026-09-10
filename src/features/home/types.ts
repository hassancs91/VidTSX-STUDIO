import type { HomeSummaryResponse } from '@shared/ipc/types';

// Home (V1 completion plan §2.6) — renderer-side shapes. The wire types live
// in `src/shared/ipc/types/home.ts`; these are what the components draw.

/** One card in the Continue row, whatever store it came from. */
export type HomeContinueItem =
  | {
      kind: 'studio';
      key: string;
      title: string;
      updatedAtMs: number;
      projectId: string;
      width: number;
      height: number;
      posterPath?: string;
      updatedAt: string;
      brandId?: string;
    }
  | {
      kind: 'motion';
      key: string;
      title: string;
      updatedAtMs: number;
      folderPath: string;
      versionPath: string;
      versionCount: number;
    }
  | {
      kind: 'session';
      key: string;
      title: string;
      updatedAtMs: number;
      agentId: string;
      agentName: string;
      sessionId: string;
      artifactCount: number;
    };

/** A Start tile: where it goes and what it says. */
export interface HomeStartTile {
  id: string;
  /** The screen the tile needs — hidden when the feature is off. */
  screen: string;
  title: string;
  description: string;
}

export type HomeSummary = HomeSummaryResponse;
