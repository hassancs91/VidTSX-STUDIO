// The pool import (Media panel, a drop, automation): `importMediaFiles` plus the T6 `usedIn` landing — a file that
// lies under the library root lands in the project like a `library:` ref (E2). A seam of its own so it has a test
// (studio-handlers.ts only calls it). The mark is an index patch that never fails the import.
import type { StudioMediaAsset } from '../../../shared/types/studio';
import { markLibraryUsedInForPaths } from '../library/library-used-in';
import { importMediaFiles } from './media-import';

export async function importMediaFilesMarkingLibrary(
  projectId: string,
  filePaths: string[],
): Promise<{ assets: StudioMediaAsset[]; errors: string[] }> {
  const result = await importMediaFiles(projectId, filePaths);
  await markLibraryUsedInForPaths(projectId, result.assets.map((a) => a.path));
  return result;
}
