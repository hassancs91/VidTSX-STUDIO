import { logEngine } from '../../logging/log-engine';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { app } from 'electron';
import { getAppRoot } from '../utils/paths';

const log = logEngine.createLogger('CaptionComposition');

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface CaptionCompositionConfig {
  styleId: string;
  mode: 'overlay' | 'burnin';
  compositionId: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  videoPath?: string; // Required for burn-in mode
  bundlerPort?: number; // Port for HTTP asset serving
  segments?: CaptionSegment[]; // Caption segments to embed
}

export interface CaptionEntryResult {
  entryPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Extract style ID from composition ID
 * e.g., "captions-bold-pop-burnin" -> "bold-pop"
 * e.g., "captions-karaoke" -> "karaoke"
 */
export function extractStyleIdFromCompositionId(compositionId: string): string {
  // Remove "captions-" prefix and "-burnin" suffix if present
  let styleId = compositionId.replace(/^captions-/, '');
  styleId = styleId.replace(/-burnin$/, '');
  return styleId;
}

/**
 * Check if a composition ID is a caption composition
 */
export function isCaptionComposition(compositionId: string): boolean {
  return compositionId.startsWith('captions-');
}

/**
 * Check if a caption composition is a burn-in composition
 */
export function isBurnInComposition(compositionId: string): boolean {
  return compositionId.endsWith('-burnin');
}

/**
 * Generate the caption template code based on style ID
 * This generates self-contained template code to avoid import path issues
 */
function generateCaptionTemplateCode(styleId: string): string {
  switch (styleId) {
    case 'bold-pop':
      return `
function CaptionTemplate({ segments }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime < seg.end
  );

  if (!activeSegment) {
    return React.createElement(AbsoluteFill, null);
  }

  const segmentStartFrame = Math.floor(activeSegment.start * fps);
  const segmentEndFrame = Math.floor(activeSegment.end * fps);
  const localFrame = frame - segmentStartFrame;
  const segmentDuration = segmentEndFrame - segmentStartFrame;

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
    from: 0.8,
    to: 1,
  });

  const fadeInOpacity = interpolate(localFrame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOutOpacity = interpolate(
    localFrame,
    [segmentDuration - 8, segmentDuration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);
  const strokeWidth = 4;
  const strokeColor = '#000000';
  const textShadow = \`
    \${strokeWidth}px \${strokeWidth}px 0 \${strokeColor},
    -\${strokeWidth}px \${strokeWidth}px 0 \${strokeColor},
    \${strokeWidth}px -\${strokeWidth}px 0 \${strokeColor},
    -\${strokeWidth}px -\${strokeWidth}px 0 \${strokeColor},
    \${strokeWidth}px 0 0 \${strokeColor},
    -\${strokeWidth}px 0 0 \${strokeColor},
    0 \${strokeWidth}px 0 \${strokeColor},
    0 -\${strokeWidth}px 0 \${strokeColor}
  \`;

  return React.createElement(
    AbsoluteFill,
    { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 } },
    React.createElement(
      'div',
      {
        style: {
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 72,
          fontWeight: 800,
          color: '#FFFFFF',
          textAlign: 'center',
          textShadow,
          transform: \`scale(\${scale})\`,
          opacity,
          maxWidth: '80%',
          wordWrap: 'break-word',
        },
      },
      activeSegment.text
    )
  );
}`;

    case 'karaoke':
      return `
function CaptionTemplate({ segments }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime < seg.end
  );

  if (!activeSegment) {
    return React.createElement(AbsoluteFill, null);
  }

  const segmentProgress = (currentTime - activeSegment.start) / (activeSegment.end - activeSegment.start);
  const words = activeSegment.text.split(' ');
  const activeWordIndex = Math.floor(segmentProgress * words.length);

  return React.createElement(
    AbsoluteFill,
    { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 80 } },
    React.createElement(
      'div',
      {
        style: {
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 48,
          fontWeight: 700,
          textAlign: 'center',
          maxWidth: '80%',
        },
      },
      words.map((word, i) =>
        React.createElement(
          'span',
          {
            key: i,
            style: {
              color: i <= activeWordIndex ? '#FFD700' : '#FFFFFF',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              marginRight: '0.3em',
              transition: 'color 0.1s',
            },
          },
          word
        )
      )
    )
  );
}`;

    case 'minimal':
    default:
      return `
function CaptionTemplate({ segments }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime < seg.end
  );

  if (!activeSegment) {
    return React.createElement(AbsoluteFill, null);
  }

  return React.createElement(
    AbsoluteFill,
    { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 60 } },
    React.createElement(
      'div',
      {
        style: {
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 36,
          fontWeight: 500,
          color: '#FFFFFF',
          textAlign: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '12px 24px',
          borderRadius: 8,
          maxWidth: '80%',
        },
      },
      activeSegment.text
    )
  );
}`;
  }
}

/**
 * Generate a self-contained Remotion entry file for caption composition
 */
function generateCaptionEntry(config: CaptionCompositionConfig): string {
  const templateCode = generateCaptionTemplateCode(config.styleId);

  if (config.mode === 'burnin') {
    // Serve video via HTTP (Remotion can't access local files directly)
    const videoUrl = config.videoPath && config.bundlerPort
      ? `http://127.0.0.1:${config.bundlerPort}/asset?path=${encodeURIComponent(config.videoPath)}`
      : '';

    // Serialize segments to embed in generated code
    const segmentsJson = JSON.stringify(config.segments || []);

    // Burn-in mode: overlay captions on video
    return `// Auto-generated caption burn-in composition
import React from 'react';
import {
  registerRoot,
  Composition,
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

${templateCode}

// Data embedded at generation time (inputProps doesn't work with manual composition objects)
const VIDEO_PATH = '${videoUrl}';
const SEGMENTS = ${segmentsJson};

function BurnInComposition() {
  // Handle missing video path
  if (!VIDEO_PATH) {
    return React.createElement(
      AbsoluteFill,
      { style: { backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      React.createElement('div', { style: { color: '#ff4444', fontSize: 24 } }, 'Error: No video path provided')
    );
  }

  return React.createElement(
    AbsoluteFill,
    null,
    React.createElement(OffthreadVideo, {
      src: VIDEO_PATH,
      style: { width: '100%', height: '100%', objectFit: 'contain' },
    }),
    React.createElement(CaptionTemplate, { segments: SEGMENTS })
  );
}

const Root = () => (
  React.createElement(
    Composition,
    {
      id: '${config.compositionId}',
      component: BurnInComposition,
      durationInFrames: ${config.durationInFrames},
      fps: ${config.fps},
      width: ${config.width},
      height: ${config.height},
      defaultProps: {},
    }
  )
);

registerRoot(Root);
`;
  } else {
    // Serialize segments to embed in generated code
    const segmentsJson = JSON.stringify(config.segments || []);

    // Overlay mode: transparent background with just captions
    return `// Auto-generated caption overlay composition
import React from 'react';
import {
  registerRoot,
  Composition,
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

${templateCode}

// Segments embedded at generation time (inputProps doesn't work with manual composition objects)
const SEGMENTS = ${segmentsJson};

function OverlayComposition() {
  return React.createElement(CaptionTemplate, { segments: SEGMENTS });
}

const Root = () => (
  React.createElement(
    Composition,
    {
      id: '${config.compositionId}',
      component: OverlayComposition,
      durationInFrames: ${config.durationInFrames},
      fps: ${config.fps},
      width: ${config.width},
      height: ${config.height},
      defaultProps: {},
    }
  )
);

registerRoot(Root);
`;
  }
}

/**
 * Get the project root directory for caption entries
 * The entry must be in a directory where node_modules/remotion can be resolved
 */
function getCaptionTempDir(): string {
  return path.join(getAppRoot(), '.vidtsx-temp', 'captions');
}

/**
 * Generate a temporary caption composition entry file
 */
export async function createCaptionEntry(
  config: CaptionCompositionConfig
): Promise<CaptionEntryResult> {
  // Use project directory so remotion imports can be resolved from node_modules
  const tempDir = getCaptionTempDir();
  await fs.mkdir(tempDir, { recursive: true });

  // Generate unique filename
  const hash = createHash('md5')
    .update(`${config.compositionId}-${config.mode}-${Date.now()}`)
    .digest('hex')
    .slice(0, 8);
  const entryFileName = `caption-entry-${hash}.tsx`;
  const entryPath = path.join(tempDir, entryFileName);

  // Generate and write entry content
  const entryContent = generateCaptionEntry(config);
  await fs.writeFile(entryPath, entryContent, 'utf-8');

  log.debug('Generated caption entry', { entryPath });

  return {
    entryPath,
    cleanup: async () => {
      try {
        await fs.unlink(entryPath);
      } catch (err) {
        log.warn('Failed to clean up caption entry', { entryPath });
      }
    },
  };
}
