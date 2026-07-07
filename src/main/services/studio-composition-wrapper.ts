import { logEngine } from '../../logging/log-engine';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { rewriteFontUrls } from './font-proxy';
import { getAppRoot } from '../utils/paths';
import { getTsxFilePath } from './studio-tsx-files';
import type { StudioRenderInput } from '../../shared/ipc/types';

const log = logEngine.createLogger('StudioCompositionWrapper');

export interface StudioWrapperResult {
  entryPath: string;
  // Slot ids actually wired into the entry (ready slots whose file was found).
  includedSlotIds: string[];
  cleanup: () => Promise<void>;
}

// Temp dir for generated studio render entries. Kept under getAppRoot() (not
// userData) so webpack can resolve `remotion`/node_modules and the `@features`/
// `@shared` aliases relative to the app root — same constraint as the caption
// entry path. NOT under src/, so the dev file-watcher doesn't reload mid-render.
function getStudioTempDir(): string {
  return path.join(getAppRoot(), '.vidtsx-temp', 'studio');
}

// Tone.js default-import fix (mirrors composition-wrapper.normalizeUserImports).
// Tone v15+ is ESM-only with no default export; AI-generated slots sometimes
// use the default-import form which webpack can't resolve correctly.
function normalizeSlotImports(code: string): string {
  return code.replace(
    /import\s+(\w+)\s+from\s*(['"])tone\2/g,
    'import * as $1 from $2tone$2'
  );
}

function slotModuleName(slotId: string, index: number): string {
  const safe = slotId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `slot_${index}_${safe}`;
}

export interface GenerateStudioEntryOptions {
  input: StudioRenderInput;
  // The serializable StudioComposition props (clip asset URLs, captions,
  // overlay timings, dims). EMBEDDED into the entry rather than passed via
  // renderMedia's inputProps — when renderComposition hands renderMedia a
  // hand-built composition object (to skip selectComposition), inputProps do
  // NOT reach the component (same reason caption-composition embeds its data).
  inputProps: Record<string, unknown>;
  // Base URL of the bundler/asset server (http://127.0.0.1:<port>). Used to
  // route any Google Fonts URLs in slot TSX through the local font proxy, so
  // headless renders work offline (after first cache fill) — same treatment
  // Creator's wrapper applies to user TSX.
  fontProxyBaseUrl: string;
}

/**
 * Generate a self-registering Remotion entry for a Studio export.
 *
 * Writes a temp dir containing: a copy of each ready slot's TSX (import-
 * normalized + font-rewritten) and `_studio_root_<hash>.tsx`, which statically
 * imports each slot, the app's StudioComposition, builds the slotId→component
 * map, and registers a single `studio` composition. The serializable inputProps
 * (clip URLs, captions, overlay timings) are NOT embedded here — they're passed
 * at render time via renderComposition's inputProps (the bundler port isn't
 * relevant to the entry, and React components can't be serialized anyway).
 */
export async function generateStudioEntry(
  options: GenerateStudioEntryOptions
): Promise<StudioWrapperResult> {
  const { input, inputProps, fontProxyBaseUrl } = options;

  const hash = createHash('md5')
    .update(`${input.projectId}-${Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 8);
  const workDir = path.join(getStudioTempDir(), `studio-${hash}`);
  await fs.mkdir(workDir, { recursive: true });

  const importLines: string[] = [];
  const mapEntries: string[] = [];
  const includedSlotIds: string[] = [];

  for (let i = 0; i < input.slots.length; i++) {
    const slot = input.slots[i];
    const srcPath = getTsxFilePath(input.projectId, slot.fileName);
    let code: string;
    try {
      code = await fs.readFile(srcPath, 'utf-8');
    } catch {
      // A ready slot whose file vanished — skip it rather than fail the render.
      log.warn('Slot file missing, skipping', { slotId: slot.id, srcPath });
      continue;
    }
    code = normalizeSlotImports(code);
    code = rewriteFontUrls(code, fontProxyBaseUrl);

    const moduleName = slotModuleName(slot.id, i);
    const ident = `Slot${i}`;
    await fs.writeFile(path.join(workDir, `${moduleName}.tsx`), code, 'utf-8');
    importLines.push(`import ${ident} from './${moduleName}.tsx';`);
    mapEntries.push(`  ${JSON.stringify(slot.id)}: ${ident},`);
    includedSlotIds.push(slot.id);
  }

  const entryContent = `// Auto-generated VidTSX Studio render entry
import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { StudioComposition } from '@features/studio/components/StudioComposition';
${importLines.join('\n')}

const slotComponents = {
${mapEntries.join('\n')}
};

// Props embedded at generation time. renderMedia's inputProps don't reach the
// component when renderComposition passes a hand-built composition object, so
// we bake them in here (clip asset URLs, captions, overlay timings, dims).
const inputProps = ${JSON.stringify(inputProps)};

const StudioRenderComponent = () => (
  <StudioComposition {...inputProps} slotComponents={slotComponents} />
);

const Root = () => (
  <Composition
    id="studio"
    component={StudioRenderComponent}
    durationInFrames={${input.durationInFrames}}
    fps={${input.fps}}
    width={${input.width}}
    height={${input.height}}
    defaultProps={{}}
  />
);

registerRoot(Root);
`;

  const entryPath = path.join(workDir, `_studio_root_${hash}.tsx`);
  await fs.writeFile(entryPath, entryContent, 'utf-8');

  log.debug('Generated studio render entry', {
    entryPath,
    slots: includedSlotIds.length,
  });

  return {
    entryPath,
    includedSlotIds,
    cleanup: async () => {
      try {
        await fs.rm(workDir, { recursive: true, force: true });
      } catch {
        log.warn('Failed to clean up studio render temp dir', { workDir });
      }
    },
  };
}
