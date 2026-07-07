import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('CompositionConfigParser');

export interface CompositionConfig {
  id: string;
  durationInSeconds?: number;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

export const DEFAULT_CONFIG: CompositionConfig = {
  id: 'main',
  durationInFrames: 300,
  fps: 30,
  width: 1920,
  height: 1080,
};

export function hasCompositionConfigExport(content: string): boolean {
  return /export\s+const\s+compositionConfig\s*=/.test(content);
}

// Parses `export const compositionConfig = { ... };` from user TSX.
// JSON.parse can't handle JS object literals, so we strip comments and
// massage the source into JSON before parsing. Expressions, template
// literals, and identifier references are still not supported — those
// would need a real AST parse.
export function parseCompositionConfig(content: string): CompositionConfig | null {
  const configMatch = content.match(
    /export\s+const\s+compositionConfig\s*=\s*(\{[\s\S]*?\})\s*(?:as\s+const|satisfies\s+[^;]+)?\s*;/
  );

  if (!configMatch) {
    return null;
  }

  try {
    const objectLiteral = configMatch[1]
      // Strip block comments first, then line comments. Inline `//` after a
      // value is the most common failure mode — JSON.parse throws on it and
      // the whole parse silently falls back to DEFAULT_CONFIG (id='main').
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/(\s*)(\w+)(\s*:)/g, '$1"$2"$3')
      .replace(/'/g, '"');

    const parsed = JSON.parse(objectLiteral);

    if (typeof parsed.id !== 'string') {
      return null;
    }

    const fps = typeof parsed.fps === 'number' ? parsed.fps : DEFAULT_CONFIG.fps;
    let durationInFrames = parsed.durationInFrames;

    if (durationInFrames === undefined && parsed.durationInSeconds !== undefined) {
      durationInFrames = Math.round(parsed.durationInSeconds * fps);
    } else if (durationInFrames === undefined) {
      durationInFrames = DEFAULT_CONFIG.durationInFrames;
    }

    return {
      id: parsed.id,
      durationInSeconds: parsed.durationInSeconds,
      durationInFrames,
      fps,
      width: typeof parsed.width === 'number' ? parsed.width : DEFAULT_CONFIG.width,
      height: typeof parsed.height === 'number' ? parsed.height : DEFAULT_CONFIG.height,
    };
  } catch {
    log.warn('Failed to parse compositionConfig, using defaults');
    return null;
  }
}
