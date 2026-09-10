// `capture_page` — a web page artifact rendered to a PNG, for the agent's own
// review (W9). The PNG is filed in the session's library folder as an
// `image-set` artifact (so the user sees what the agent looked at), and a
// reduced JPEG rides back in the tool result so the model can see it too.

import fs from 'fs/promises';
import { nativeImage } from 'electron';
import { z } from 'zod';
import { buildWebPageSrcdoc, WEB_PAGE_VIEWPORTS, type WebPageViewport } from '../../../../shared/agents/web-page';
import { checkImageBuffer } from '../../content-safety/image-safety';
import { ensureLibraryRoot } from '../../library/library-paths';
import { upsertEntry } from '../../library/library-store';
import { GENERATED_FOLDER, reserveLibraryFile, sanitizeFolder, slugify } from '../../library/library-filing';
import { inlineWebPage, loadWebPage } from '../web-page-refs';
import { captureWebPageHtml } from '../web-page-capture';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const VIEWPORTS = Object.keys(WEB_PAGE_VIEWPORTS) as WebPageViewport[];
/** The model sees a reduced copy: wide enough to judge layout, cheap in tokens. */
const REVIEW_MAX_WIDTH = 1024;
const REVIEW_JPEG_QUALITY = 80;

const schema = {
  artifactId: z.string().describe('Web page artifact to render (e.g. "web-page-1").'),
  viewport: z
    .enum(['desktop', 'tablet', 'phone'])
    .optional()
    .describe('Width to render at: desktop 1280, tablet 820, phone 390 CSS px. Default desktop.'),
  fullPage: z.boolean().optional().describe('Capture the whole scroll height (capped) instead of the first screen. Default true.'),
};

interface CapturePageArgs {
  artifactId: string;
  viewport?: WebPageViewport;
  fullPage?: boolean;
}

export const capturePageTool: AgentToolDef<CapturePageArgs> = {
  id: 'capture_page',
  description:
    'Render a web page artifact exactly as the preview shows it and return the picture so you can review the layout yourself. Files the PNG as an "image-set" artifact. Use it after write_page and after edits that change layout; pick the phone viewport to check the responsive version.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    const artifacts = ctx.readArtifacts();
    const artifact = artifacts.find((a) => a.id === args.artifactId);
    if (!artifact) {
      return toolText(`No artifact "${args.artifactId}" in this session — call list_artifacts for the ids.`, true);
    }
    if (artifact.kind !== 'web-page') {
      return toolText(`Artifact "${args.artifactId}" is a ${artifact.kind}, not a web page.`, true);
    }
    const viewport: WebPageViewport = args.viewport && VIEWPORTS.includes(args.viewport) ? args.viewport : 'desktop';
    ctx.emitProgress(`${artifact.title} · ${viewport}`);

    try {
      const page = await loadWebPage(ctx.agentId, ctx.sessionId, artifacts, artifact);
      const html = buildWebPageSrcdoc(await inlineWebPage(page.html, page.resolved));
      const shot = await captureWebPageHtml({
        html,
        tempDir: ctx.workspaceDir,
        viewport,
        fullPage: args.fullPage ?? true,
        signal: ctx.signal,
      });

      // Content Safety Gate B: pixels are checked before they land in the library.
      await checkImageBuffer(shot.png);

      const root = await ensureLibraryRoot();
      const folder = sanitizeFolder(ctx.libraryFolder, GENERATED_FOLDER);
      const base = `capture-${slugify(artifact.title, 'page')}-${viewport}`;
      const { relPath, absPath } = await reserveLibraryFile(root, folder, base, '.png');
      await fs.writeFile(absPath, shot.png);
      await upsertEntry(root, relPath, {
        origin: 'captured',
        description: `Capture of the page "${artifact.title}" (${viewport}, ${shot.width}×${shot.height})`,
        ...(ctx.brandId ? { brandId: ctx.brandId } : {}),
      });

      let review = nativeImage.createFromBuffer(shot.png);
      if (review.getSize().width > REVIEW_MAX_WIDTH) review = review.resize({ width: REVIEW_MAX_WIDTH });
      const jpeg = review.toJPEG(REVIEW_JPEG_QUALITY);

      const missing = page.problems.length ? ` Note: ${page.problems.join(' ')}` : '';
      return {
        ...toolText(
          `Captured ${artifact.title} at ${viewport} (${shot.width}×${shot.height}): ${relPath}. The picture is attached — look at it before deciding what to change.${missing}`,
        ),
        images: [{ data: jpeg.toString('base64'), mimeType: 'image/jpeg' }],
        artifact: {
          kind: 'image-set',
          title: `Capture: ${artifact.title} (${viewport})`,
          payload: { items: [{ relPath, width: shot.width, height: shot.height }] },
        },
      };
    } catch (err) {
      return toolText(`Capture failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  },
};
