import { logEngine } from '../../logging/log-engine';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { rewriteFontUrls } from './font-proxy';
import {
  DEFAULT_CONFIG,
  hasCompositionConfigExport,
  parseCompositionConfig,
  type CompositionConfig,
} from './composition-config-parser';

const log = logEngine.createLogger('CompositionWrapper');

export type { CompositionConfig };

export interface WrapperResult {
  wrapperPath: string;
  config: CompositionConfig;
}

/**
 * Find the component export name from the file content
 */
function findComponentExport(content: string): string {
  // Pattern 1: export default function Name
  const defaultFuncMatch = content.match(/export\s+default\s+function\s+(\w+)/);
  if (defaultFuncMatch) {
    return defaultFuncMatch[1];
  }

  // Pattern 2: export default Name (where Name is defined elsewhere)
  const defaultNameMatch = content.match(/export\s+default\s+(\w+)\s*;/);
  if (defaultNameMatch) {
    return defaultNameMatch[1];
  }

  // Pattern 3: export function Name (named export, look for React component)
  const namedFuncMatch = content.match(/export\s+function\s+(\w+)\s*\(/);
  if (namedFuncMatch) {
    return namedFuncMatch[1];
  }

  // Pattern 4: const Name: React.FC = ... then export default Name
  // or const Name = () => ... then export default Name
  const componentMatch = content.match(/(?:const|let)\s+(\w+)(?:\s*:\s*React\.FC)?(?:<[^>]*>)?\s*=/);
  if (componentMatch) {
    // Check if this component is exported as default
    const exportDefaultPattern = new RegExp(`export\\s+default\\s+${componentMatch[1]}\\b`);
    if (exportDefaultPattern.test(content)) {
      return componentMatch[1];
    }
  }

  // Fallback: use a generic name
  return 'UserComponent';
}

/**
 * Check if the file has a default export
 */
function hasDefaultExport(content: string): boolean {
  return /export\s+default\s+/.test(content);
}

/**
 * Generate wrapper content for a user file with compositionConfig
 */
function generateWrapperWithConfig(
  userFileName: string,
  componentName: string,
  hasDefault: boolean
): string {
  const importStatement = hasDefault
    ? `import ${componentName}, { compositionConfig } from './${userFileName}.tsx';`
    : `import { ${componentName}, compositionConfig } from './${userFileName}.tsx';`;

  return `// Auto-generated wrapper for VidTSX bundling
import React from 'react';
import { registerRoot, Composition } from 'remotion';
${importStatement}

const durationInFrames = compositionConfig.durationInFrames
  ?? Math.round((compositionConfig.durationInSeconds ?? 10) * compositionConfig.fps);

const Root = () => (
  <Composition
    id={compositionConfig.id}
    component={${componentName}}
    durationInFrames={durationInFrames}
    fps={compositionConfig.fps}
    width={compositionConfig.width}
    height={compositionConfig.height}
  />
);

registerRoot(Root);
`;
}

/**
 * Generate wrapper content for a user file without compositionConfig
 */
function generateWrapperWithDefaults(
  userFileName: string,
  componentName: string,
  hasDefault: boolean
): string {
  const importStatement = hasDefault
    ? `import ${componentName} from './${userFileName}.tsx';`
    : `import { ${componentName} } from './${userFileName}.tsx';`;

  return `// Auto-generated wrapper for VidTSX bundling
import React from 'react';
import { registerRoot, Composition } from 'remotion';
${importStatement}

const Root = () => (
  <Composition
    id="main"
    component={${componentName}}
    durationInFrames={${DEFAULT_CONFIG.durationInFrames}}
    fps={${DEFAULT_CONFIG.fps}}
    width={${DEFAULT_CONFIG.width}}
    height={${DEFAULT_CONFIG.height}}
  />
);

registerRoot(Root);
`;
}

/**
 * Generate wrapper with Tone.js audio injected (with compositionConfig)
 */
function generateWrapperWithConfigAndAudio(
  userFileName: string,
  componentName: string,
  hasDefault: boolean,
  toneAudioUrl: string
): string {
  const importStatement = hasDefault
    ? `import ${componentName}, { compositionConfig } from './${userFileName}.tsx';`
    : `import { ${componentName}, compositionConfig } from './${userFileName}.tsx';`;

  return `// Auto-generated wrapper for VidTSX bundling (with Tone.js audio)
import React from 'react';
import { registerRoot, Composition, Audio } from 'remotion';
${importStatement}

const TONE_AUDIO_URL = ${JSON.stringify(toneAudioUrl)};

const ComponentWithAudio = (props) => (
  <>
    <${componentName} {...props} />
    <Audio src={TONE_AUDIO_URL} />
  </>
);

const durationInFrames = compositionConfig.durationInFrames
  ?? Math.round((compositionConfig.durationInSeconds ?? 10) * compositionConfig.fps);

const Root = () => (
  <Composition
    id={compositionConfig.id}
    component={ComponentWithAudio}
    durationInFrames={durationInFrames}
    fps={compositionConfig.fps}
    width={compositionConfig.width}
    height={compositionConfig.height}
  />
);

registerRoot(Root);
`;
}

/**
 * Generate wrapper with Tone.js audio injected (without compositionConfig)
 */
function generateWrapperWithDefaultsAndAudio(
  userFileName: string,
  componentName: string,
  hasDefault: boolean,
  toneAudioUrl: string
): string {
  const importStatement = hasDefault
    ? `import ${componentName} from './${userFileName}.tsx';`
    : `import { ${componentName} } from './${userFileName}.tsx';`;

  return `// Auto-generated wrapper for VidTSX bundling (with Tone.js audio)
import React from 'react';
import { registerRoot, Composition, Audio } from 'remotion';
${importStatement}

const TONE_AUDIO_URL = ${JSON.stringify(toneAudioUrl)};

const ComponentWithAudio = (props) => (
  <>
    <${componentName} {...props} />
    <Audio src={TONE_AUDIO_URL} />
  </>
);

const Root = () => (
  <Composition
    id="main"
    component={ComponentWithAudio}
    durationInFrames={${DEFAULT_CONFIG.durationInFrames}}
    fps={${DEFAULT_CONFIG.fps}}
    width={${DEFAULT_CONFIG.width}}
    height={${DEFAULT_CONFIG.height}}
  />
);

registerRoot(Root);
`;
}

export interface WrapperOptions {
  toneAudioUrl?: string;
  /**
   * Base URL of a server that hosts the font proxy (`/fonts?u=...`). When
   * provided, Google Fonts URLs in the user's TSX are rewritten to go through
   * the proxy, so headless renders work offline (after first cache fill) and
   * don't depend on direct gstatic.com reachability.
   */
  fontProxyBaseUrl?: string;
}

/**
 * Normalize user imports that webpack can't resolve correctly.
 * Currently handles: `import Tone from 'tone'` (default import) → `import * as Tone from 'tone'`
 * Tone.js v15+ is ESM-only with no default export. AI-generated code sometimes uses the
 * default import syntax which fails at runtime (Tone becomes undefined).
 */
function normalizeUserImports(code: string): string {
  return code.replace(
    /import\s+(\w+)\s+from\s*(['"])tone\2/g,
    'import * as $1 from $2tone$2'
  );
}

/**
 * Generate a Remotion root wrapper for a user TSX file
 *
 * Creates a temporary _vidtsx_root_{hash}.tsx file that:
 * 1. Imports the user's component
 * 2. Reads compositionConfig if available
 * 3. Registers the composition with Remotion
 * 4. Optionally injects a Tone.js <Audio> element if toneAudioUrl is provided
 */
export async function generateWrapper(
  userFilePath: string,
  options?: WrapperOptions
): Promise<WrapperResult> {
  // Read user file
  const content = await fs.readFile(userFilePath, 'utf-8');
  const userFileName = path.basename(userFilePath, '.tsx');
  const userDir = path.dirname(userFilePath);

  // Parse config and find component (using original content)
  const parsedConfig = parseCompositionConfig(content);
  const componentName = findComponentExport(content);
  const hasDefault = hasDefaultExport(content);
  const hasConfig = hasCompositionConfigExport(content);

  // Build the final config (parsed or defaults). parseCompositionConfig already
  // normalizes durationInFrames from durationInSeconds, so config is fully populated.
  const config: CompositionConfig = parsedConfig ?? { ...DEFAULT_CONFIG };

  // Normalize user imports (fixes e.g. `import Tone from 'tone'` which webpack
  // cannot resolve correctly for ESM-only packages without default export).
  // If the content changes, we write a normalized copy to the same directory
  // and have the wrapper import from that copy instead of the original file.
  let normalizedContent = normalizeUserImports(content);
  // Route Google Fonts URLs through the local proxy. Critical for renders
  // that may run with restricted/offline network — first run fills the cache,
  // subsequent runs serve from disk.
  if (options?.fontProxyBaseUrl) {
    normalizedContent = rewriteFontUrls(normalizedContent, options.fontProxyBaseUrl);
  }
  const needsNormalization = normalizedContent !== content;
  const hash = createHash('md5').update(content).digest('hex').slice(0, 8);

  let importedFileName = userFileName;
  if (needsNormalization) {
    importedFileName = `_vidtsx_user_${hash}`;
    const normalizedPath = path.join(userDir, `${importedFileName}.tsx`);
    await fs.writeFile(normalizedPath, normalizedContent, 'utf-8');
    log.debug('Wrote normalized user TSX copy', { normalizedPath });
  }

  // Generate wrapper content
  let wrapperContent: string;
  if (options?.toneAudioUrl) {
    wrapperContent = hasConfig
      ? generateWrapperWithConfigAndAudio(importedFileName, componentName, hasDefault, options.toneAudioUrl)
      : generateWrapperWithDefaultsAndAudio(importedFileName, componentName, hasDefault, options.toneAudioUrl);
  } else {
    wrapperContent = hasConfig
      ? generateWrapperWithConfig(importedFileName, componentName, hasDefault)
      : generateWrapperWithDefaults(importedFileName, componentName, hasDefault);
  }

  // Generate unique wrapper filename using content hash
  const wrapperFileName = `_vidtsx_root_${hash}.tsx`;
  const wrapperPath = path.join(userDir, wrapperFileName);

  // Write wrapper file
  await fs.writeFile(wrapperPath, wrapperContent, 'utf-8');

  log.debug('Generated wrapper', { wrapperPath, componentName, hasConfig, hasDefault, needsNormalization });

  return {
    wrapperPath,
    config,
  };
}

/**
 * Clean up a generated wrapper file and its associated normalized user copy (if any)
 */
export async function cleanupWrapper(wrapperPath: string): Promise<void> {
  try {
    await fs.unlink(wrapperPath);
  } catch (err) {
    // Log but don't throw - cleanup failure shouldn't break bundling
    log.warn('Failed to clean up wrapper file', { wrapperPath });
  }

  // Also clean up the normalized user copy if it exists (matching hash suffix)
  const wrapperFileName = path.basename(wrapperPath, '.tsx');
  const hashMatch = wrapperFileName.match(/^_vidtsx_root_([a-f0-9]+)$/);
  if (hashMatch) {
    const normalizedPath = path.join(path.dirname(wrapperPath), `_vidtsx_user_${hashMatch[1]}.tsx`);
    try {
      await fs.unlink(normalizedPath);
    } catch {
      // Normalized copy may not exist — that's fine
    }
  }
}

/**
 * Clean up all wrapper files in a directory
 */
export async function cleanupAllWrappers(directory: string): Promise<void> {
  try {
    const files = await fs.readdir(directory);
    const wrapperFiles = files.filter(
      (f) => (f.startsWith('_vidtsx_root_') || f.startsWith('_vidtsx_user_')) && f.endsWith('.tsx')
    );

    await Promise.all(
      wrapperFiles.map((f) => fs.unlink(path.join(directory, f)).catch(() => {}))
    );
  } catch (err) {
    log.warn('Failed to clean up wrappers', { directory });
  }
}
